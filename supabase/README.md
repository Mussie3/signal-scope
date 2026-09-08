# SignalScope — backend

The roadmap item was "replace the in-process simulation with a real event feed."
This is that, done Supabase-native: Postgres for storage and derivation,
Realtime Broadcast for the live stream, one Edge Function for collectors, and
pg_cron for retention and the demo simulator.

## The shape of it

Two stores, because they answer two different questions.

| | `request_events` | `metric_buckets` |
|---|---|---|
| Grain | one row per request | one-second rollup per connection |
| Retention | 15 min (`projects.retention_ms`) | 24 h |
| Feeds | the animated dots | every number the UI shows |

Scrubbing the timeline back an hour over raw events would mean scanning hundreds
of thousands of rows per frame. Over buckets it is 3,600 rows per connection,
already summed. That split is what lets raw retention be aggressive without
losing history.

Both are written by a single statement-level trigger on insert, so a metric is
never stale relative to the events behind it — there is no rollup job that can
fall behind.

### Why Broadcast and not Postgres Changes

Postgres Changes emits one message per row. At a few hundred events per second
that is a firehose the client spends its frame budget unpacking. The rollup
trigger instead emits **one broadcast message per ingest batch**, carrying the
whole batch — verified: a 360-event insert produced exactly one message.

## Migrations

| File | Contents |
|---|---|
| `…100100_extensions.sql` | pgcrypto, pg_cron |
| `…100200_topology.sql` | Projects, services, connections, ingest keys, RLS |
| `…100300_events.sql` | Raw events, buckets, the rollup + broadcast trigger |
| `…100400_derivation.sql` | `get_topology`, `window_metrics`, `service_statuses`, incidents |
| `…100500_simulation.sql` | The 90-second incident loop, in SQL |
| `…100600_maintenance.sql` | Retention, incident evaluation, cron schedule |
| `…100700_grants.sql` | Privileges — `anon` reads, writes nothing |
| `…100800_demo_project.sql` | `seed.ts` as rows: the public demo topology |
| `…100900_ingest_keys_api.sql` | Minting and revoking collector keys |

## Status derivation

`service_statuses()` is `src/features/map/status.ts`, in SQL, at the same
thresholds — which now live on the project row (`down_age_ms`,
`failing_error_rate`, `slow_latency_ms`) so the server owns them and the client
reads them, instead of two copies drifting apart.

Every function takes an explicit `p_at` timestamp instead of reading `now()`.
That is what makes replay work server-side for free: status was always a pure
function of `(events, at)`, so a past moment is just a different argument.

## The simulator moved to the server

The demo has to stay alive for a visitor who has never signed in, so the
simulation moved into SQL where pg_cron drives it — and every connected browser
now sees the *same* incident at the same moment, instead of each tab inventing
its own.

It is plain SQL rather than an Edge Function on purpose: no HTTP hop, no cold
start, no secret, and the whole tick is one `INSERT` — one trigger, one rollup,
one broadcast. Same 250 ms cadence, same 5% baseline error rate, same three
scheduled incidents on a 90-second loop.

Projects fed by a real collector leave `simulated = false` and the driver skips
them.

## Local

```sh
npx supabase start          # needs Docker running
npx supabase db reset
```

The `demo` project (6 services, 5 connections, simulated) is created by a
migration, not a seed file — it is part of the deployed product.

```sh
cp .env.example .env.local            # then fill in URL + anon key
npm run dev
```

`VITE_FEED=local` (the default) keeps the original in-process simulation, so a
fresh clone still runs with nothing configured.

## Deploying

```sh
npx supabase link --project-ref <your-project-ref>
npx supabase db push
npx supabase functions deploy ingest
```

No function secrets are needed — `ingest` uses only the platform-injected
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

## Feeding it real traffic

Mint a key (as the project owner):

```sql
select public.create_ingest_key('my-system', 'prod-collector');
```

The token is returned once and never stored — only its SHA-256 goes in the
table, so a database dump contains no usable credential.

Then post batches:

```sh
curl -X POST https://<ref>.supabase.co/functions/v1/ingest \
  -H "Authorization: Bearer sk_..." \
  -H "Content-Type: application/json" \
  -d '{
    "project": "my-system",
    "events": [
      { "connection": "frontend-auth-api-connection", "success": true, "latency": 142 },
      { "connection": "auth-api-user-db-connection",  "success": false, "latency": 2100 }
    ]
  }'
```

Batch. One HTTP call per observed request would cost more than the request being
observed, and each insert would fire its own rollup and its own broadcast. Max
1,000 events per call; `timestamp` is optional (ms epoch, defaults to now).

Events naming a connection the topology does not declare are reported back in
`unknownConnections` rather than silently dropped — a topology drifting out of
sync with reality is the thing an operator most needs told about.

## Access model

`anon` is a first-class reader here, unlike a typical app: the demo map must
render for a visitor with no account. What `anon` may actually read is decided by
`projects.is_public`, so the grant permits the attempt, not the data. The demo
project has no owner at all, which makes it readable by everyone and writable by
no one.
