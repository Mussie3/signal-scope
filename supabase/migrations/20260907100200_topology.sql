-- SignalScope :: topology
--
-- The frontend's seed.ts becomes rows: services and the directed connections
-- between them. Everything else in the system -- status, metrics, incidents,
-- replay -- is derived from events flowing along these connections, exactly as
-- it is in the browser today.

create table if not exists public.projects (
  id         uuid primary key default gen_random_uuid(),
  -- Nullable on purpose: the public demo project belongs to nobody. An
  -- unowned project can be read by anyone (is_public) and written by no one,
  -- since `owner_id = auth.uid()` is never true for NULL.
  owner_id   uuid default auth.uid() references auth.users (id) on delete cascade,
  slug       text not null unique,
  name       text not null,
  -- The live demo has to be readable by someone who has never signed in, which
  -- is a property of the project rather than a hole in the policies.
  is_public  boolean not null default false,
  -- Whether the SQL simulator generates traffic for this project. A project fed
  -- by a real collector leaves this off.
  simulated  boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint slug_shape check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$')
);

drop trigger if exists projects_updated_at on public.projects;
create trigger projects_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

do $$
begin
  if not exists (select 1 from pg_type where typname = 'service_kind') then
    create type public.service_kind as enum ('api', 'database', 'cache');
  end if;
end
$$;

create table if not exists public.services (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  -- Stable human key ('auth-api'). Collectors report against this, so it has to
  -- survive a row being recreated -- which is why it, not the uuid, is what an
  -- ingest payload names.
  key        text not null,
  name       text not null,
  kind       public.service_kind not null,
  region     text not null,
  position_x double precision not null default 0,
  position_y double precision not null default 0,
  created_at timestamptz not null default now(),

  unique (project_id, key),
  constraint key_shape check (key ~ '^[a-z0-9][a-z0-9-]{0,62}$')
);

create table if not exists public.connections (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  key        text not null,
  source_id  uuid not null references public.services (id) on delete cascade,
  target_id  uuid not null references public.services (id) on delete cascade,
  created_at timestamptz not null default now(),

  unique (project_id, key),
  -- One edge per direction per pair; the map draws a single line for each.
  unique (source_id, target_id),
  constraint no_self_edge check (source_id <> target_id)
);

create index if not exists connections_project_idx on public.connections (project_id);
create index if not exists connections_target_idx  on public.connections (target_id);

-- ---------------------------------------------------------------------------
-- Ingest keys
--
-- A collector is a process on someone's infrastructure, not a person. It cannot
-- hold a user session, so it authenticates with a bearer token scoped to one
-- project. Only the SHA-256 of the token is stored: a leaked database dump does
-- not hand over working credentials.
-- ---------------------------------------------------------------------------
create table if not exists public.ingest_keys (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects (id) on delete cascade,
  name         text not null default 'default',
  token_hash   text not null unique,
  -- First 8 chars of the token, so the UI can tell two keys apart without ever
  -- storing enough to use one.
  token_prefix text not null,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at   timestamptz
);

create index if not exists ingest_keys_project_idx on public.ingest_keys (project_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.projects    enable row level security;
alter table public.services    enable row level security;
alter table public.connections enable row level security;
alter table public.ingest_keys enable row level security;

create or replace function public.can_read_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.projects p
    where p.id = p_project_id
      and (p.is_public or p.owner_id = (select auth.uid()))
  );
$$;

create or replace function public.owns_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.projects p
    where p.id = p_project_id and p.owner_id = (select auth.uid())
  );
$$;

drop policy if exists projects_read on public.projects;
create policy projects_read on public.projects
  for select to anon, authenticated
  using (is_public or owner_id = (select auth.uid()));

drop policy if exists projects_write_own on public.projects;
create policy projects_write_own on public.projects
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists services_read on public.services;
create policy services_read on public.services
  for select to anon, authenticated
  using (public.can_read_project(project_id));

drop policy if exists services_write_own on public.services;
create policy services_write_own on public.services
  for all to authenticated
  using (public.owns_project(project_id))
  with check (public.owns_project(project_id));

drop policy if exists connections_read on public.connections;
create policy connections_read on public.connections
  for select to anon, authenticated
  using (public.can_read_project(project_id));

drop policy if exists connections_write_own on public.connections;
create policy connections_write_own on public.connections
  for all to authenticated
  using (public.owns_project(project_id))
  with check (public.owns_project(project_id));

-- Deliberately no anon policy, and no SELECT of token_hash worth having: keys
-- are managed by their owner only.
drop policy if exists ingest_keys_own on public.ingest_keys;
create policy ingest_keys_own on public.ingest_keys
  for all to authenticated
  using (public.owns_project(project_id))
  with check (public.owns_project(project_id));
