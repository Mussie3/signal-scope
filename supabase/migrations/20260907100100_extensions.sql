-- SignalScope :: extensions and shared helpers

-- pgcrypto provides gen_random_bytes and digest, used to mint and hash ingest
-- keys (20260907100900).
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_cron;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
