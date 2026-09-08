import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(url ?? '', anonKey ?? '', {
  auth: { persistSession: true, autoRefreshToken: true },
  realtime: {
    // The rollup trigger emits one message per ingest batch, not per event, so
    // the socket stays quiet even under real traffic. This ceiling is a
    // backstop, not the expected rate.
    params: { eventsPerSecond: 20 },
  },
})

/**
 * Which feed drives the map.
 *
 * 'local'  -- the original in-process simulation. No backend, no network; the
 *             demo still runs on a clone with nothing configured.
 * 'remote' -- topology and events come from Supabase.
 */
export const feedMode: 'local' | 'remote' =
  import.meta.env.VITE_FEED === 'remote' && url && anonKey ? 'remote' : 'local'

export const projectSlug = import.meta.env.VITE_PROJECT_SLUG ?? 'demo'
