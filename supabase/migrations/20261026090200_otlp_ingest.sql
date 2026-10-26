-- SignalScope :: one-round-trip OTLP graph ingest
--
-- The Edge Function derives a graph from a trace batch and hands the whole thing
-- over at once. Doing the upserts here rather than in Deno matters for three
-- reasons:
--
--   1. Atomicity. A batch either lands completely or not at all, so the map can
--      never show an edge whose endpoints were not also recorded.
--   2. Round trips. A naive implementation is N selects + N inserts per batch;
--      this is three statements regardless of batch size.
--   3. Batched rollup. request_events has a FOR EACH STATEMENT trigger over a
--      transition table, so a single multi-row insert produces one rollup and
--      one realtime broadcast. Inserting row by row would produce one broadcast
--      per span, which is the firehose the batching was designed to avoid.

create or replace function public.ingest_otlp(
  p_project_id uuid,
  p_graph      jsonb   -- { services: [...], connections: [...], events: [...] }
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_services    integer := 0;
  v_connections integer := 0;
  v_events      integer := 0;
begin
  -- 1. Services. ON CONFLICT DO UPDATE on name/region only: a node's kind is
  -- settled by whoever saw it first, so a later batch that happens to observe a
  -- database purely as a CLIENT peer cannot flip an API's kind underneath it.
  with incoming as (
    select
      (s ->> 'key')::text                      as key,
      (s ->> 'name')::text                     as name,
      (s ->> 'kind')::public.service_kind      as kind,
      coalesce(s ->> 'region', 'unknown')      as region
    from jsonb_array_elements(coalesce(p_graph -> 'services', '[]'::jsonb)) as s
  ), upserted as (
    insert into public.services (project_id, key, name, kind, region)
    select p_project_id, key, name, kind, region from incoming
    on conflict (project_id, key) do update
      set name = excluded.name, region = excluded.region
    returning 1
  )
  select count(*) into v_services from upserted;

  -- 2. Connections, resolving service keys to ids in the same statement. Rows
  -- naming a service that is not present are silently absent rather than an
  -- error: the join simply does not match.
  with incoming as (
    select
      (c ->> 'key')::text    as key,
      (c ->> 'source')::text as source_key,
      (c ->> 'target')::text as target_key
    from jsonb_array_elements(coalesce(p_graph -> 'connections', '[]'::jsonb)) as c
  ), resolved as (
    select i.key, src.id as source_id, tgt.id as target_id
    from incoming i
    join public.services src on src.project_id = p_project_id and src.key = i.source_key
    join public.services tgt on tgt.project_id = p_project_id and tgt.key = i.target_key
    where src.id <> tgt.id
  ), upserted as (
    insert into public.connections (project_id, key, source_id, target_id)
    select p_project_id, key, source_id, target_id from resolved
    -- The pair is the real identity; the key is a label. A pair already present
    -- under a different key keeps the key it has.
    on conflict (source_id, target_id) do nothing
    returning 1
  )
  select count(*) into v_connections from upserted;

  -- 3. Events. ONE insert statement, so the rollup trigger fires once.
  with incoming as (
    select
      (e ->> 'source')::text         as source_key,
      (e ->> 'target')::text         as target_key,
      (e ->> 'latency_ms')::integer  as latency_ms,
      (e ->> 'success')::boolean     as success
    from jsonb_array_elements(coalesce(p_graph -> 'events', '[]'::jsonb)) as e
  ), resolved as (
    select conn.id as connection_id, i.latency_ms, i.success
    from incoming i
    join public.services src  on src.project_id = p_project_id and src.key = i.source_key
    join public.services tgt  on tgt.project_id = p_project_id and tgt.key = i.target_key
    join public.connections conn on conn.source_id = src.id and conn.target_id = tgt.id
    where i.latency_ms is not null
      and i.latency_ms >= 0
      and i.latency_ms < 600000   -- matches the latency_sane check on the table
      and i.success is not null
  ), inserted as (
    insert into public.request_events (project_id, connection_id, success, latency_ms)
    select p_project_id, connection_id, success, latency_ms from resolved
    returning 1
  )
  select count(*) into v_events from inserted;

  return jsonb_build_object(
    'services', v_services,
    'connections', v_connections,
    'events', v_events
  );
end;
$$;

-- Only the ingest function, running as the service role, may call this. An
-- authenticated user must not be able to write events into a project by RPC.
revoke all on function public.ingest_otlp(uuid, jsonb) from public, anon, authenticated;

comment on function public.ingest_otlp is
  'Upserts a derived OTLP service graph and its events in three statements. Service role only.';
