-- SignalScope :: the demo topology
--
-- This is src/features/map/seed.ts, moved into the database. It ships as a
-- migration rather than a dev-only seed because the public demo is part of the
-- deployed product -- a visitor with no account must land on a map that is
-- already alive.

do $$
declare
  proj_id uuid;
begin
  insert into public.projects (slug, name, is_public, simulated, owner_id)
  values ('demo', 'Demo System', true, true, null)
  on conflict (slug) do update set name = excluded.name
  returning id into proj_id;

  insert into public.services (project_id, key, name, kind, region, position_x, position_y)
  values
    (proj_id, 'frontend',      'Frontend',      'api',      'US East',      500, 100),
    (proj_id, 'auth-api',      'Auth API',      'api',      'US East',      280, 280),
    (proj_id, 'product-api',   'Product API',   'api',      'EU Central',   720, 280),
    (proj_id, 'user-db',       'User DB',       'database', 'US East',      200, 480),
    (proj_id, 'product-db',    'Product DB',    'database', 'EU Central',   620, 480),
    (proj_id, 'product-cache', 'Product Cache', 'cache',    'Asia Pacific', 870, 480)
  on conflict (project_id, key) do update
    set name = excluded.name,
        kind = excluded.kind,
        region = excluded.region,
        position_x = excluded.position_x,
        position_y = excluded.position_y;

  insert into public.connections (project_id, key, source_id, target_id)
  select
    proj_id,
    e.key,
    src.id,
    tgt.id
  from (values
    ('frontend-auth-api-connection',            'frontend',    'auth-api'),
    ('auth-api-user-db-connection',             'auth-api',    'user-db'),
    ('frontend-product-api-connection',         'frontend',    'product-api'),
    ('product-api-product-db-connection',       'product-api', 'product-db'),
    ('product-api-product-cache-connection',    'product-api', 'product-cache')
  ) as e(key, source_key, target_key)
  join public.services src on src.project_id = proj_id and src.key = e.source_key
  join public.services tgt on tgt.project_id = proj_id and tgt.key = e.target_key
  on conflict (project_id, key) do nothing;
end
$$;
