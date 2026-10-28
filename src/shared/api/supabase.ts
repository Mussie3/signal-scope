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

/**
 * Which project's map to show.
 *
 * ?project= wins over the build-time default, because a build-time slug means
 * one deployment can only ever show one estate. That is fine for a demo and
 * wrong for a tool whose whole premise is that anyone can point it at their
 * own system -- a second project should not require a second deployment.
 *
 * The default stays, so the public URL still opens on the demo rather than an
 * empty canvas.
 */
const slugFromUrl = (): string | null => {
  if (typeof location === 'undefined') return null
  const raw = new URLSearchParams(location.search).get('project')
  if (!raw) return null
  // Slugs are a closed character set server-side; anything else is someone
  // experimenting with the query string and should fall back rather than be
  // forwarded to the API.
  return /^[a-z0-9][a-z0-9-]{0,62}$/.test(raw) ? raw : null
}

export const projectSlug = slugFromUrl() ?? import.meta.env.VITE_PROJECT_SLUG ?? 'demo'
