-- SignalScope :: get_topology must return the ids that events are keyed by
--
-- The remote feed has never delivered a single event, and this is why.
--
-- get_topology returned the human-readable KEY as each id:
--     {"id": "frontend-auth-api-connection", "sourceId": "frontend", ...}
--
-- while the realtime broadcast carries request_events.connection_id, which is
-- the UUID primary key:
--     {"connectionId": "9b24ed96-c9a7-439e-a9f8-dce55fd5c461", ...}
--
-- Those are the same edge under two different names, so the client's
--     if (!connectionsById[event.connectionId]) continue
-- dropped every event that ever arrived. The socket was healthy, the payloads
-- were correct, the map read "No data" — the two halves were each verified in
-- isolation and never against each other.
--
-- Fixed by returning the real UUIDs, because that is what the event stream is
-- keyed by and the client has no other way to join the two. The readable key is
-- kept alongside as `key`: it is genuinely useful for debugging and for anyone
-- reading a payload by hand, it just cannot be the identity.

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
        -- The UUID, not the key: events reference services and connections by
        -- their primary keys, and the map has to be able to match them.
        'id',       s.id,
        'key',      s.key,
        'name',     s.name,
        'kind',     s.kind,
        'region',   s.region,
        'position', jsonb_build_object('x', s.position_x, 'y', s.position_y)
      ) order by s.created_at)
      from public.services s where s.project_id = p.id
    ), '[]'::jsonb),
    'connections', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',       c.id,
        'key',      c.key,
        'sourceId', src.id,
        'targetId', tgt.id
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

comment on function public.get_topology is
  'Topology for the map. Ids are UUIDs so they join against request_events.connection_id; the readable key travels alongside as `key`.';
