// POST /functions/v1/ingest
//
// The real-traffic counterpart to the SQL simulator. A collector on the
// monitored system posts batches of request observations:
//
//   Authorization: Bearer <ingest key>
//   {
//     "project": "demo",
//     "events": [
//       { "connection": "frontend-auth-api-connection",
//         "timestamp": 1757260000000,   // optional, ms epoch; defaults to now
//         "success": true,
//         "latency": 142 }
//     ]
//   }
//
// Batched by design. One HTTP call per request observed would cost more than the
// request being observed, and each insert would fire its own rollup and its own
// broadcast. A batch is one insert, one rollup, one message to every viewer.

import { preflight, json, fail } from '../_shared/http.ts'
import { adminClient } from '../_shared/supabase.ts'

// Bounded so one caller cannot hand over a payload large enough to stall the
// statement trigger for everyone else on the instance.
const MAX_EVENTS = 1000

type IncomingEvent = {
  connection?: string
  timestamp?: number
  success?: boolean
  latency?: number
}

type Body = { project?: string; events?: IncomingEvent[] }

const sha256Hex = async (value: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

Deno.serve(async (req: Request) => {
  const pre = preflight(req)
  if (pre) return pre
  if (req.method !== 'POST') return fail('method not allowed', 405)

  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!bearer) return fail('missing ingest key', 401)

  const body = (await req.json().catch(() => ({}))) as Body
  if (!body.project) return fail('project slug is required')
  if (!Array.isArray(body.events) || body.events.length === 0) return fail('events[] is required')
  if (body.events.length > MAX_EVENTS) {
    return fail(`batch too large: ${body.events.length} events, max ${MAX_EVENTS}`, 413)
  }

  const admin = adminClient()

  // Only the hash is stored, so the lookup is by hash. A database dump therefore
  // contains no usable credential.
  const { data: key } = await admin
    .from('ingest_keys')
    .select('id, project_id, revoked_at, projects ( slug )')
    .eq('token_hash', await sha256Hex(bearer))
    .maybeSingle()

  if (!key || key.revoked_at) return fail('invalid or revoked ingest key', 401)

  const keyProject = (key.projects as unknown as { slug: string } | null)?.slug
  // The key names the project; the body naming a different one is either a
  // misconfigured collector or an attempt to write somewhere it shouldn't.
  if (keyProject !== body.project) return fail('ingest key does not match project', 403)

  // Resolve connection keys to ids in one query rather than per event.
  const { data: connections, error: connErr } = await admin
    .from('connections')
    .select('id, key')
    .eq('project_id', key.project_id)

  if (connErr) return fail(`loading topology: ${connErr.message}`, 500)

  const idByKey = new Map((connections ?? []).map((c) => [c.key as string, c.id as string]))

  const rows: Array<Record<string, unknown>> = []
  const unknownConnections = new Set<string>()

  for (const event of body.events) {
    const connectionId = event.connection ? idByKey.get(event.connection) : undefined
    if (!connectionId) {
      // Collected but undeclared. Recorded and reported rather than silently
      // dropped -- a topology drifting out of sync with reality is the thing an
      // operator most needs told about.
      if (event.connection) unknownConnections.add(event.connection)
      continue
    }
    if (typeof event.latency !== 'number' || event.latency < 0) continue

    rows.push({
      project_id: key.project_id,
      connection_id: connectionId,
      ts: new Date(event.timestamp ?? Date.now()).toISOString(),
      success: event.success !== false,
      latency_ms: Math.round(event.latency),
    })
  }

  if (rows.length === 0) {
    return json({ accepted: 0, rejected: body.events.length, unknownConnections: [...unknownConnections] })
  }

  const { error: insertErr } = await admin.from('request_events').insert(rows)
  if (insertErr) return fail(`inserting events: ${insertErr.message}`, 500)

  // Best-effort; a failed timestamp update must not fail an accepted batch.
  await admin.from('ingest_keys').update({ last_used_at: new Date().toISOString() }).eq('id', key.id)

  return json({
    accepted: rows.length,
    rejected: body.events.length - rows.length,
    unknownConnections: [...unknownConnections],
  })
})
