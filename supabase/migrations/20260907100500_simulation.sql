-- SignalScope :: server-side traffic simulator
--
-- The in-browser simulation is what makes the demo legible: a visitor gets a
-- full 90-second incident cycle without anyone standing up a collector. Moving
-- the backend under the app must not cost that, so the simulator moves too --
-- into SQL, where pg_cron can drive it and every connected browser sees the same
-- incident at the same moment instead of each tab inventing its own.
--
-- It is plain SQL rather than an Edge Function on purpose: no HTTP hop, no cold
-- start, no secret to hold, and the whole tick is one INSERT -- which means one
-- statement-trigger firing, one rollup, one broadcast.
--
-- Mirrors src/features/map/simulation.ts: 250 ms cadence, 5% baseline error
-- rate, 50-500 ms baseline latency, and the same three scheduled incidents on a
-- 90-second loop.

create or replace function public.simulate_tick(p_slug text, p_seconds numeric default 10)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  proj public.projects;
  inserted integer := 0;
begin
  select * into proj from public.projects where slug = p_slug and simulated;
  if proj.id is null then
    return 0;
  end if;

  -- One INSERT for the whole tick. Looping row by row would fire the rollup
  -- trigger once per event and emit one broadcast message per event, which is
  -- exactly the firehose the batching design exists to avoid.
  with ticks as (
    select
      gs.ts,
      -- Loop phase from wall clock, so every viewer and every backend process
      -- agrees on where in the 90-second cycle we are.
      (extract(epoch from gs.ts) * 1000)::bigint % 90000 as loop_t
    from generate_series(
      now() - make_interval(secs => p_seconds),
      now() - interval '250 milliseconds',
      interval '250 milliseconds'
    ) as gs(ts)
  ),
  scenario as (
    select
      t.ts,
      case
        when t.loop_t >= 30000 and t.loop_t < 50000 then 'auth-api'
        when t.loop_t >= 50000 and t.loop_t < 65000 then 'product-cache'
        when t.loop_t >= 65000 and t.loop_t < 80000 then 'product-db'
      end as affected_key,
      case
        when t.loop_t >= 30000 and t.loop_t < 50000 then 'errors'
        when t.loop_t >= 50000 and t.loop_t < 65000 then 'outage'
        when t.loop_t >= 65000 and t.loop_t < 80000 then 'latency'
      end as incident
    from ticks t
  ),
  picked as (
    select
      s.ts,
      s.incident,
      s.affected_key,
      conn.id as connection_id,
      conn.target_key
    from scenario s
    cross join lateral (
      select c.id, tg.key as target_key
      from public.connections c
      join public.services tg on tg.id = c.target_id
      where c.project_id = proj.id
        -- During an outage the target stops answering at all, so its incoming
        -- edges carry no events -- which is what eventually ages the node past
        -- the down threshold. coalesce keeps this a plain false when no incident
        -- is active; without it the NULL comparison filters out every row.
        and not (coalesce(s.incident, '') = 'outage' and tg.key = coalesce(s.affected_key, ''))
      order by random()
      limit 1
    ) conn
  )
  insert into public.request_events (project_id, connection_id, ts, success, latency_ms)
  select
    proj.id,
    p.connection_id,
    p.ts,
    random() > case
      when p.incident = 'errors' and p.target_key = p.affected_key then 0.4
      else 0.05
    end,
    case
      when p.incident = 'latency' and p.target_key = p.affected_key
        then (1500 + random() * 1000)::integer
      else (50 + random() * 450)::integer
    end
  from picked p;

  get diagnostics inserted = row_count;
  return inserted;
end;
$$;

revoke all on function public.simulate_tick(text, numeric) from public, anon, authenticated;

comment on function public.simulate_tick is
  'Generates simulated traffic for a project flagged `simulated`. Driven by pg_cron; not callable by clients.';
