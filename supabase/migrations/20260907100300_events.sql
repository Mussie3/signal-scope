-- SignalScope :: the event stream
--
-- Two stores, because they answer two different questions.
--
--   request_events -- individual requests, kept for PRUNE_WINDOW_MS (15 min).
--                     This is what the animated dots travel along, and it is the
--                     only place a single request exists as a row.
--
--   metric_buckets -- one-second rollups per connection, kept far longer.
--                     Every number the UI shows (throughput, error rate, avg
--                     latency, last seen) is a sum over these.
--
-- The split is what makes the timeline scrubber affordable. Scrubbing back an
-- hour over raw events would mean scanning hundreds of thousands of rows on
-- every frame; over buckets it is 3,600 rows per connection, already aggregated.
-- Retention on the raw table can then be aggressive without losing history.

create table if not exists public.request_events (
  id            bigint generated always as identity primary key,
  project_id    uuid not null references public.projects (id) on delete cascade,
  connection_id uuid not null references public.connections (id) on delete cascade,
  ts            timestamptz not null default now(),
  success       boolean not null,
  latency_ms    integer not null,

  constraint latency_sane check (latency_ms >= 0 and latency_ms < 600000)
);

-- The live query is always "this connection, this window", newest first.
create index if not exists request_events_conn_ts_idx
  on public.request_events (connection_id, ts desc);

-- Retention sweeps by time across the whole project.
create index if not exists request_events_project_ts_idx
  on public.request_events (project_id, ts);

create table if not exists public.metric_buckets (
  connection_id uuid not null references public.connections (id) on delete cascade,
  bucket_start  timestamptz not null,
  project_id    uuid not null references public.projects (id) on delete cascade,
  event_count   integer not null default 0,
  error_count   integer not null default 0,
  latency_sum   bigint  not null default 0,
  latency_max   integer not null default 0,
  last_event_at timestamptz not null,

  primary key (connection_id, bucket_start)
);

create index if not exists metric_buckets_project_time_idx
  on public.metric_buckets (project_id, bucket_start desc);

-- ---------------------------------------------------------------------------
-- Rollup + fan-out, in one statement-level trigger.
--
-- FOR EACH STATEMENT with a transition table, not FOR EACH ROW: an ingest batch
-- of 500 events fires this once and does one grouped upsert, instead of 500
-- round trips through the executor. At the volumes this table is built for,
-- that difference is the whole design.
--
-- Buckets are updated in the same transaction as the insert, so a metric is
-- never stale relative to the events behind it -- no rollup job to fall behind,
-- and no window where the UI shows numbers that disagree with the stream.
-- ---------------------------------------------------------------------------
create or replace function public.rollup_and_broadcast_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  proj uuid;
  slug text;
  payload jsonb;
begin
  insert into public.metric_buckets as b
    (connection_id, bucket_start, project_id, event_count, error_count, latency_sum, latency_max, last_event_at)
  select
    n.connection_id,
    date_trunc('second', n.ts),
    n.project_id,
    count(*),
    count(*) filter (where not n.success),
    sum(n.latency_ms),
    max(n.latency_ms),
    max(n.ts)
  from new_events n
  group by n.connection_id, date_trunc('second', n.ts), n.project_id
  on conflict (connection_id, bucket_start) do update
    set event_count   = b.event_count + excluded.event_count,
        error_count   = b.error_count + excluded.error_count,
        latency_sum   = b.latency_sum + excluded.latency_sum,
        latency_max   = greatest(b.latency_max, excluded.latency_max),
        last_event_at = greatest(b.last_event_at, excluded.last_event_at);

  -- Fan out to connected browsers as ONE broadcast message carrying the whole
  -- batch. Postgres Changes would emit one message per row, which at a few
  -- hundred events per second is a firehose the client spends its frame budget
  -- unpacking. One message per batch keeps the socket quiet and lets the client
  -- append to its buffers in a single pass.
  select p.id, p.slug into proj, slug
  from public.projects p
  where p.id = (select n.project_id from new_events n limit 1);

  if slug is null then
    return null;
  end if;

  select jsonb_agg(jsonb_build_object(
           'connectionId', n.connection_id,
           'timestamp',    (extract(epoch from n.ts) * 1000)::bigint,
           'success',      n.success,
           'latency',      n.latency_ms
         ))
    into payload
  from new_events n;

  perform realtime.send(
    jsonb_build_object('events', payload),
    'events',
    'signalscope:' || slug,
    false  -- public channel: the demo map is viewable without a session
  );

  return null;
end;
$$;

drop trigger if exists request_events_rollup on public.request_events;
create trigger request_events_rollup
  after insert on public.request_events
  referencing new table as new_events
  for each statement execute function public.rollup_and_broadcast_events();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.request_events enable row level security;
alter table public.metric_buckets enable row level security;

-- Reads follow the project. Writes come from the ingest function under the
-- service role -- a collector's bearer token is checked there, not here, because
-- it is not a Postgres identity.
drop policy if exists request_events_read on public.request_events;
create policy request_events_read on public.request_events
  for select to anon, authenticated
  using (public.can_read_project(project_id));

drop policy if exists metric_buckets_read on public.metric_buckets;
create policy metric_buckets_read on public.metric_buckets
  for select to anon, authenticated
  using (public.can_read_project(project_id));
