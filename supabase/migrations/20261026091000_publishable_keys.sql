-- SignalScope :: publishable, origin-locked ingest keys
--
-- The browser collector cannot use an sk_ key. That key is matched by SHA-256
-- and never stored in plaintext precisely because it is a secret, and a secret
-- shipped inside a page is not a secret - it is scrapeable by anyone who opens
-- devtools.
--
-- So publishable keys work on a different footing, the same one Stripe's pk_ and
-- Google Maps keys use:
--
--   * The token is PUBLIC. It is stored in plaintext because the owner has to be
--     able to copy it into their page later; hashing it would protect nothing and
--     only make it unrecoverable.
--   * It is locked to an origin allowlist.
--   * It is rate limited.
--
-- Being honest about what the origin check buys: browsers send and cannot forge
-- Origin, so the allowlist stops OTHER SITES from spending your quota. It does
-- not stop someone with curl, who can send whatever Origin they like. The rate
-- limit is the control that actually bounds abuse. Anyone reading this later
-- should not mistake the allowlist for authentication.

alter table public.ingest_keys
  add column if not exists is_publishable  boolean not null default false,
  add column if not exists token           text,
  add column if not exists allowed_origins text[] not null default '{}',
  add column if not exists rate_limit_per_min integer not null default 600;

-- A publishable key is useless without a recoverable token and an allowlist; a
-- secret key must never keep its plaintext. Encode both as one constraint so
-- neither can be created wrong.
alter table public.ingest_keys
  drop constraint if exists publishable_shape;
-- coalesce is load-bearing: array_length('{}', 1) is NULL rather than 0, so
-- `NULL >= 1` is NULL, the whole expression is NULL, and a CHECK constraint
-- PASSES on NULL. Without this a publishable key could be created with an empty
-- allowlist - which fails safe at request time, since an empty array matches no
-- origin, but silently defeats the constraint's entire purpose.
alter table public.ingest_keys
  add constraint publishable_shape check (
    (is_publishable and token is not null and coalesce(array_length(allowed_origins, 1), 0) >= 1)
    or
    (not is_publishable and token is null)
  );

create index if not exists ingest_keys_publishable_idx
  on public.ingest_keys (project_id) where is_publishable;

-- ---------------------------------------------------------------------------
-- Rate limiting, bucketed per minute.
--
-- A counter row per (key, minute) rather than a rolling log: the question is
-- only "has this key exceeded its budget this minute", and one upserted integer
-- answers it without storing a row per request.
-- ---------------------------------------------------------------------------
create table if not exists public.ingest_rate_counters (
  key_id       uuid not null references public.ingest_keys (id) on delete cascade,
  window_start timestamptz not null,
  count        integer not null default 0,
  primary key (key_id, window_start)
);

-- ---------------------------------------------------------------------------
-- One call that authenticates, authorises the origin, and spends a unit of
-- quota. All three together, because doing them as separate round trips means
-- two concurrent batches can each see the counter under the limit and both
-- proceed.
--
-- Returns a single row. A NULL project_id means rejected, and `reason` says why
-- so the caller can pick an honest status code.
-- ---------------------------------------------------------------------------
create or replace function public.resolve_ingest_key(
  p_token  text,
  p_origin text default null
)
returns table (project_id uuid, reason text, allowed_origin text)
language plpgsql
security definer
set search_path = public
as $$
declare
  k            public.ingest_keys;
  v_window     timestamptz := date_trunc('minute', now());
  v_count      integer;
  v_origin_ok  boolean;
begin
  select * into k
  from public.ingest_keys
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');

  if k.id is null then
    return query select null::uuid, 'invalid key', null::text; return;
  end if;

  if k.revoked_at is not null then
    return query select null::uuid, 'revoked key', null::text; return;
  end if;

  -- Secret keys are not origin-bound: they run server-side where there is no
  -- Origin to check and none would be meaningful.
  if k.is_publishable then
    if p_origin is null then
      return query select null::uuid, 'origin required for a publishable key', null::text; return;
    end if;
    v_origin_ok := p_origin = any (k.allowed_origins);
    if not v_origin_ok then
      return query select null::uuid, 'origin not allowed', null::text; return;
    end if;
  end if;

  -- Spend quota. ON CONFLICT DO UPDATE makes the increment atomic, so two
  -- concurrent batches cannot both slip past the limit.
  insert into public.ingest_rate_counters (key_id, window_start, count)
  values (k.id, v_window, 1)
  on conflict (key_id, window_start) do update set count = public.ingest_rate_counters.count + 1
  returning count into v_count;

  if v_count > k.rate_limit_per_min then
    return query select null::uuid, 'rate limit exceeded', null::text; return;
  end if;

  update public.ingest_keys set last_used_at = now() where id = k.id;

  return query select k.project_id, null::text,
    case when k.is_publishable then p_origin else null end;
end;
$$;

revoke all on function public.resolve_ingest_key(text, text) from public, anon, authenticated;

comment on function public.resolve_ingest_key is
  'Authenticates an ingest key, checks the origin allowlist for publishable keys, and atomically spends a unit of per-minute quota. Service role only.';

-- ---------------------------------------------------------------------------
-- Minting a publishable key. Unlike create_ingest_key the token is returned on
-- every read, not just at creation, because it is meant to be public.
-- ---------------------------------------------------------------------------
create or replace function public.create_publishable_key(
  p_slug    text,
  p_origins text[],
  p_name    text default 'browser'
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_project uuid;
  v_token   text;
begin
  select id into v_project from public.projects
  where slug = p_slug and owner_id = (select auth.uid());

  if v_project is null then
    raise exception 'project % not found or not yours', p_slug using errcode = 'no_data_found';
  end if;

  if p_origins is null or array_length(p_origins, 1) is null then
    raise exception 'a publishable key needs at least one allowed origin'
      using errcode = 'check_violation';
  end if;

  -- pk_ rather than sk_, so a key that leaks into a repo is immediately
  -- identifiable as the harmless kind.
  v_token := 'pk_' || encode(extensions.gen_random_bytes(24), 'hex');

  insert into public.ingest_keys
    (project_id, name, token_hash, token_prefix, is_publishable, token, allowed_origins)
  values (
    v_project, p_name,
    encode(extensions.digest(v_token, 'sha256'), 'hex'),
    left(v_token, 11),
    true, v_token, p_origins
  );

  return jsonb_build_object('token', v_token, 'allowed_origins', p_origins);
end;
$$;

-- Owners may read their own publishable tokens back; the secret ones have no
-- plaintext to read. RLS on ingest_keys already scopes rows to the owner.
comment on function public.create_publishable_key is
  'Mints a public, origin-locked pk_ key for browser use. The token is stored in plaintext because it is meant to be embedded in a page.';

-- ---------------------------------------------------------------------------
-- Keep the counter table from growing without bound.
-- ---------------------------------------------------------------------------
create or replace function public.prune_rate_counters()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.ingest_rate_counters where window_start < now() - interval '2 hours';
$$;

select cron.unschedule('signalscope-prune-rate-counters')
where exists (select 1 from cron.job where jobname = 'signalscope-prune-rate-counters');

select cron.schedule('signalscope-prune-rate-counters', '7 * * * *',
  $cron$ select public.prune_rate_counters(); $cron$);
