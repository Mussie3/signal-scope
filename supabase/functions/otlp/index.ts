// SignalScope :: OTLP/HTTP trace receiver
//
// Deliberately speaks a standard rather than a bespoke format. Anything that
// already exports OpenTelemetry — browser SDK, Node auto-instrumentation, the
// Collector — can point a second exporter here and get a live topology without
// writing a line of collector code or declaring a single service.
//
// Scope is narrow on purpose: OTLP/HTTP with JSON encoding, traces only. No
// protobuf, no gRPC, no metrics, no logs. That subset is what every SDK can emit
// and is a fraction of the spec surface.
//
// Endpoint shape: an OTel exporter configured with endpoint
//   https://<ref>.supabase.co/functions/v1/otlp
// appends /v1/traces itself, so both that path and the bare root are accepted.

import { derive } from '../_shared/otlp.ts'
import { adminClient } from '../_shared/supabase.ts'
import { corsHeaders, preflight } from '../_shared/http.ts'

const sha256Hex = async (s: string): Promise<string> => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** OTLP defines the success response as an empty ExportTraceServiceResponse.
 *  Extra fields are ignored by conformant exporters, so diagnostics ride along
 *  for humans using curl without breaking an SDK. */
const otlpOk = (extra: Record<string, unknown> = {}) =>
  new Response(JSON.stringify(extra), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

/** A rejection an exporter should NOT retry is reported as partialSuccess with
 *  a message; retrying a malformed batch forever helps nobody. */
const otlpRejected = (rejected: number, message: string) =>
  new Response(JSON.stringify({ partialSuccess: { rejectedSpans: rejected, errorMessage: message } }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const fail = (message: string, status: number) =>
  new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  const pre = preflight(req)
  if (pre) return pre

  if (req.method !== 'POST') return fail('POST required', 405)

  const path = new URL(req.url).pathname
  if (!(path.endsWith('/v1/traces') || path.endsWith('/otlp') || path.endsWith('/otlp/'))) {
    return fail('unknown path; expected /v1/traces', 404)
  }

  // Protobuf is the OTLP default for some SDKs. Say so plainly rather than
  // failing to parse and reporting something misleading.
  const contentType = req.headers.get('content-type') ?? ''
  if (contentType.includes('protobuf')) {
    return fail('only OTLP/HTTP with JSON encoding is supported; set the exporter protocol to http/json', 415)
  }

  const bearer = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!bearer) return fail('missing ingest key', 401)

  const admin = adminClient()

  // The key identifies the project, so an OTLP payload needs no project field —
  // which is just as well, since the spec has nowhere to put one.
  const { data: key } = await admin
    .from('ingest_keys')
    .select('id, project_id, revoked_at')
    .eq('token_hash', await sha256Hex(bearer))
    .maybeSingle()

  if (!key || key.revoked_at) return fail('invalid or revoked ingest key', 401)

  let payload: unknown
  try {
    payload = await req.json()
  } catch {
    return otlpRejected(0, 'body is not valid JSON')
  }

  const graph = derive(payload)

  if (graph.events.length === 0) {
    // Not an error: a batch of purely internal spans legitimately yields no
    // edges. Report why so a quiet pipeline is debuggable.
    return otlpOk({
      signalscope: {
        services: graph.services.length,
        connections: 0,
        events: 0,
        skipped: graph.skipped.slice(0, 20),
        note: 'no cross-service edges in this batch',
      },
    })
  }

  const { data: result, error } = await admin.rpc('ingest_otlp', {
    p_project_id: key.project_id,
    p_graph: graph,
  })

  if (error) {
    // 500 so the exporter retries: the batch was well-formed and our side failed.
    return fail(`ingest failed: ${error.message}`, 500)
  }

  return otlpOk({
    signalscope: {
      ...(result ?? {}),
      skipped: graph.skipped.slice(0, 20),
      // Two service names that slugify to the same key merge into one node.
      // Surfaced rather than silently collapsed, so it is diagnosable.
      nameCollisions: graph.nameCollisions,
    },
  })
})
