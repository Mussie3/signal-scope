-- SignalScope :: explicit privileges
--
-- Unlike Composer Studio, anon is a first-class reader here: the live demo map
-- must render for a visitor with no account. What anon may read is still decided
-- by RLS (projects.is_public), so this grants the *attempt*, not the data.

grant usage on schema public to anon, authenticated;

grant select on public.projects       to anon, authenticated;
grant select on public.services       to anon, authenticated;
grant select on public.connections    to anon, authenticated;
grant select on public.request_events to anon, authenticated;
grant select on public.metric_buckets to anon, authenticated;
grant select on public.incidents      to anon, authenticated;

-- Owners manage their own topology.
grant insert, update, delete on public.projects    to authenticated;
grant insert, update, delete on public.services    to authenticated;
grant insert, update, delete on public.connections to authenticated;
grant select, insert, update, delete on public.ingest_keys to authenticated;

grant execute on function public.get_topology(text)                          to anon, authenticated;
grant execute on function public.window_metrics(text, timestamptz, integer)  to anon, authenticated;
grant execute on function public.service_statuses(text, timestamptz, integer) to anon, authenticated;
grant execute on function public.can_read_project(uuid)                      to anon, authenticated;
grant execute on function public.owns_project(uuid)                          to authenticated;

-- Ingest, retention, incident evaluation and the simulator are the service
-- role's and pg_cron's. No client calls them.
revoke all on function public.prune_request_events()          from public, anon, authenticated;
revoke all on function public.prune_metric_buckets(interval)  from public, anon, authenticated;
revoke all on function public.evaluate_incidents(integer)     from public, anon, authenticated;
revoke all on function public.simulate_all(numeric)           from public, anon, authenticated;
revoke all on table public.request_events from anon, authenticated;
grant  select on table public.request_events to anon, authenticated;
