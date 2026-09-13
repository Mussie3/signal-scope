-- SignalScope :: minting ingest keys
--
-- The plaintext token is returned exactly once, at creation, and never stored.
-- Only its SHA-256 goes into the table, so the token cannot be recovered from a
-- database dump, a backup, or a support query -- losing it means rotating it,
-- which is the correct tradeoff for a credential that can write to a stream.

create or replace function public.create_ingest_key(p_slug text, p_name text default 'default')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  proj_id uuid;
  token   text;
begin
  select id into proj_id from public.projects where slug = p_slug;

  -- SECURITY DEFINER bypasses RLS, so ownership is checked explicitly here.
  -- Without this line any signed-in user could mint a write key for any project.
  if proj_id is null or not public.owns_project(proj_id) then
    raise exception 'project % not found', p_slug using errcode = 'no_data_found';
  end if;

  -- 32 random bytes, hex-encoded. gen_random_bytes is a CSPRNG; random() is not,
  -- and a guessable ingest key is a write endpoint left open.
  token := 'sk_' || encode(extensions.gen_random_bytes(32), 'hex');

  insert into public.ingest_keys (project_id, name, token_hash, token_prefix)
  values (
    proj_id,
    p_name,
    encode(extensions.digest(token, 'sha256'), 'hex'),
    left(token, 11)
  );

  return jsonb_build_object(
    'token', token,
    'prefix', left(token, 11),
    'note', 'Store this now. It is not recoverable.'
  );
end;
$$;

grant execute on function public.create_ingest_key(text, text) to authenticated;
revoke all on function public.create_ingest_key(text, text) from anon;

create or replace function public.revoke_ingest_key(p_key_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
begin
  -- SECURITY INVOKER: the ingest_keys RLS policy already restricts this to the
  -- project owner, so no second ownership check is needed.
  update public.ingest_keys set revoked_at = now()
   where id = p_key_id and revoked_at is null;
  return found;
end;
$$;

grant execute on function public.revoke_ingest_key(uuid) to authenticated;
