import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0'
import { env } from './env.ts'

// Ingest writes under the service role. A collector is not a Postgres identity,
// so RLS has nothing to evaluate for it -- authorisation is the hashed ingest
// key checked in the function itself.
export const adminClient = (): SupabaseClient =>
  createClient(env.supabaseUrl(), env.serviceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
