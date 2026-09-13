-- SignalScope :: retention and background work
--
-- An event stream with no retention policy is a disk-space incident waiting to
-- happen. At the demo's own rate (4 events/sec) that is ~345k rows a day from
-- one project; a real collector is orders of magnitude more.

-- ---------------------------------------------------------------------------
-- Retention
--
-- Raw events are deleted past each project's retention_ms (default 15 min,
-- matching PRUNE_WINDOW_MS in the frontend). Buckets outlive them by a day, so
-- the timeline scrubber can still reach back well past the raw window -- the
-- dots stop, the metrics do not.
-- ---------------------------------------------------------------------------
create or replace function public.prune_request_events()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removed integer;
begin
  delete from public.request_events e
  using public.projects p
  where p.id = e.project_id
    and e.ts < now() - make_interval(secs => p.retention_ms / 1000.0);

  get diagnostics removed = row_count;
  return removed;
end;
$$;

create or replace function public.prune_metric_buckets(p_keep interval default interval '24 hours')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removed integer;
begin
  delete from public.metric_buckets where bucket_start < now() - p_keep;
  get diagnostics removed = row_count;
  return removed;
end;
$$;

-- ---------------------------------------------------------------------------
-- Simulator driver: one tick per simulated project.
-- ---------------------------------------------------------------------------
create or replace function public.simulate_all(p_seconds numeric default 10)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  total integer := 0;
  rec record;
begin
  for rec in select slug from public.projects where simulated loop
    total := total + public.simulate_tick(rec.slug, p_seconds);
  end loop;
  return total;
end;
$$;

-- ---------------------------------------------------------------------------
-- Schedule
--
-- pg_cron supports sub-minute intervals, which the simulator needs: at one tick
-- a minute the map would jump in 60-second steps instead of streaming.
-- ---------------------------------------------------------------------------
select cron.unschedule(jobname)
from cron.job
where jobname in (
  'signalscope-simulate',
  'signalscope-evaluate-incidents',
  'signalscope-prune-events',
  'signalscope-prune-buckets'
);

-- Each tick backfills the 10 seconds it covers, so the stream stays continuous
-- even though the driver only wakes six times a minute.
select cron.schedule('signalscope-simulate', '10 seconds',
  $cron$ select public.simulate_all(10); $cron$);

select cron.schedule('signalscope-evaluate-incidents', '30 seconds',
  $cron$ select public.evaluate_incidents(60000); $cron$);

select cron.schedule('signalscope-prune-events', '* * * * *',
  $cron$ select public.prune_request_events(); $cron$);

select cron.schedule('signalscope-prune-buckets', '0 * * * *',
  $cron$ select public.prune_metric_buckets(); $cron$);
