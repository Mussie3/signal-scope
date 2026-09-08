-- SignalScope :: derived state
--
-- The browser derives status from raw events with a pure function
-- (src/features/map/status.ts). These functions are the same logic, over the
-- same inputs, at the same thresholds -- so the server and the client cannot
-- disagree about whether a service is failing.
--
-- Every one of them takes an explicit `p_at` timestamp rather than reading
-- now(). That is what makes replay work: the timeline scrubber passes a past
-- moment and gets back exactly what the map showed then, because status was
-- always a pure function of (events, at).

-- Thresholds live on the project so the server owns them and the client can
-- read them, instead of two copies drifting apart. Defaults mirror
-- src/features/map/constants.ts.
alter table public.projects
  add column if not exists down_age_ms       integer not null default 5000,
  add column if not exists failing_error_rate double precision not null default 0.1,
  add column if not exists slow_latency_ms   integer not null default 300,
  add column if not exists retention_ms      integer not null default 900000;  -- 15 min

-- ---------------------------------------------------------------------------
-- Topology, in the shape features/map/seed.ts already produces.
-- ---------------------------------------------------------------------------
create or replace function public.get_topology(p_slug text)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'project', jsonb_build_object(
      'id', p.id,
      'slug', p.slug,
      'name', p.name,
      'thresholds', jsonb_build_object(
        'downAgeMs',        p.down_age_ms,
        'failingErrorRate', p.failing_error_rate,
        'slowLatencyMs',    p.slow_latency_ms,
        'retentionMs',      p.retention_ms
      )
    ),
    'services', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',       s.key,
        'name',     s.name,
        'kind',     s.kind,
        'region',   s.region,
        'position', jsonb_build_object('x', s.position_x, 'y', s.position_y)
      ) order by s.created_at)
      from public.services s where s.project_id = p.id
    ), '[]'::jsonb),
    'connections', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',       c.key,
        'sourceId', src.key,
        'targetId', tgt.key
      ) order by c.created_at)
      from public.connections c
      join public.services src on src.id = c.source_id
      join public.services tgt on tgt.id = c.target_id
      where c.project_id = p.id
    ), '[]'::jsonb)
  )
  from public.projects p
  where p.slug = p_slug;
$$;

-- ---------------------------------------------------------------------------
-- Per-connection metrics over a rolling window.
--
-- Reads metric_buckets, never request_events. A 15-minute window over raw rows
-- is tens of thousands of records; over one-second buckets it is at most 900 per
-- connection, and the sums are already done.
-- ---------------------------------------------------------------------------
create or replace function public.window_metrics(
  p_slug text,
  p_at timestamptz default now(),
  p_range_ms integer default 60000
)
returns table (
  connection_key text,
  source_key     text,
  target_key     text,
  event_count    bigint,
  error_count    bigint,
  error_rate     double precision,
  avg_latency_ms double precision,
  max_latency_ms integer,
  last_event_at  timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    c.key,
    src.key,
    tgt.key,
    coalesce(sum(b.event_count), 0)::bigint,
    coalesce(sum(b.error_count), 0)::bigint,
    case when coalesce(sum(b.event_count), 0) = 0 then 0
         else sum(b.error_count)::double precision / sum(b.event_count) end,
    case when coalesce(sum(b.event_count), 0) = 0 then 0
         else sum(b.latency_sum)::double precision / sum(b.event_count) end,
    coalesce(max(b.latency_max), 0),
    max(b.last_event_at)
  from public.connections c
  join public.projects p on p.id = c.project_id and p.slug = p_slug
  join public.services src on src.id = c.source_id
  join public.services tgt on tgt.id = c.target_id
  -- LEFT JOIN, so a connection with no traffic in the window still comes back
  -- with zeros. Dropping it would make the map lose an edge exactly when the
  -- interesting thing (silence) is happening.
  left join public.metric_buckets b
    on b.connection_id = c.id
   and b.bucket_start >  p_at - make_interval(secs => p_range_ms / 1000.0)
   and b.bucket_start <= p_at
  group by c.key, src.key, tgt.key;
$$;

-- ---------------------------------------------------------------------------
-- Service status -- the direct translation of deriveServiceStatus().
--
-- A service is judged by its INCOMING edges, because that is where evidence of
-- it serving traffic lives. A leaf database with no outgoing edges still has a
-- status; a node with no incoming edges reads no_data, which is correct.
-- ---------------------------------------------------------------------------
create or replace function public.service_statuses(
  p_slug text,
  p_at timestamptz default now(),
  p_range_ms integer default 60000
)
returns table (
  service_key    text,
  status         text,
  event_count    bigint,
  error_rate     double precision,
  avg_latency_ms double precision,
  last_event_at  timestamptz,
  incoming_edges bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with proj as (
    select * from public.projects where slug = p_slug
  ),
  rolled as (
    select
      s.key as service_key,
      count(distinct c.id)                          as incoming_edges,
      coalesce(sum(b.event_count), 0)::bigint       as event_count,
      coalesce(sum(b.error_count), 0)::bigint       as error_count,
      coalesce(sum(b.latency_sum), 0)::bigint       as latency_sum,
      max(b.last_event_at)                          as last_event_at
    from proj p
    join public.services s on s.project_id = p.id
    left join public.connections c on c.target_id = s.id
    left join public.metric_buckets b
      on b.connection_id = c.id
     and b.bucket_start >  p_at - make_interval(secs => p_range_ms / 1000.0)
     and b.bucket_start <= p_at
    group by s.key
  )
  select
    r.service_key,
    -- Ordered exactly as status.ts orders it: no_data, then down, then failing,
    -- then slow, then healthy. The order is the semantics -- a service that is
    -- both silent and previously erroring reads 'down', not 'failing'.
    case
      when r.event_count = 0 then 'no_data'
      when extract(epoch from (p_at - r.last_event_at)) * 1000 > p.down_age_ms then 'down'
      when r.error_count::double precision / r.event_count > p.failing_error_rate then 'failing'
      when r.latency_sum::double precision / r.event_count > p.slow_latency_ms then 'slow'
      else 'healthy'
    end,
    r.event_count,
    case when r.event_count = 0 then 0
         else r.error_count::double precision / r.event_count end,
    case when r.event_count = 0 then 0
         else r.latency_sum::double precision / r.event_count end,
    r.last_event_at,
    r.incoming_edges
  from rolled r
  cross join proj p;
$$;

-- ---------------------------------------------------------------------------
-- Incidents
--
-- Status is derived on demand, which is right for a live map but means nothing
-- remembers that Auth API was failing between 14:02 and 14:05. This table is
-- that memory: a periodic evaluation opens a row when a service leaves
-- 'healthy' and closes it when the service comes back.
-- ---------------------------------------------------------------------------
create table if not exists public.incidents (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete cascade,
  status     text not null,
  started_at timestamptz not null default now(),
  ended_at   timestamptz
);

-- At most one open incident per service. The partial unique index enforces that
-- at the storage level, so a double evaluation cannot open a duplicate.
create unique index if not exists incidents_one_open_per_service_idx
  on public.incidents (service_id) where ended_at is null;

create index if not exists incidents_project_started_idx
  on public.incidents (project_id, started_at desc);

alter table public.incidents enable row level security;

drop policy if exists incidents_read on public.incidents;
create policy incidents_read on public.incidents
  for select to anon, authenticated
  using (public.can_read_project(project_id));

create or replace function public.evaluate_incidents(p_range_ms integer default 60000)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  touched integer := 0;
  rec record;
begin
  for rec in
    select
      p.id as project_id,
      s.id as service_id,
      st.status
    from public.projects p
    join public.services s on s.project_id = p.id
    join lateral public.service_statuses(p.slug, now(), p_range_ms) st
      on st.service_key = s.key
  loop
    if rec.status in ('failing', 'slow', 'down') then
      insert into public.incidents (project_id, service_id, status)
      values (rec.project_id, rec.service_id, rec.status)
      on conflict (service_id) where ended_at is null do update
        -- A service that degrades further (slow -> failing) keeps one incident
        -- and updates its severity, rather than fragmenting one outage into
        -- three rows nobody can correlate.
        set status = excluded.status;
      touched := touched + 1;
    else
      update public.incidents
         set ended_at = now()
       where service_id = rec.service_id and ended_at is null;
    end if;
  end loop;

  return touched;
end;
$$;
