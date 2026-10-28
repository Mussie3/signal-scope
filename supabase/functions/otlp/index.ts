// SignalScope :: OTLP/HTTP trace receiver
//
// Deliberately speaks a standard rather than a bespoke format. Anything that
// already exports OpenTelemetry — browser SDK, Node auto-instrumentation, the
// Collector, or SignalScope's own snippet — can point an exporter here and get a
// live topology without writing collector code or declaring a single service.
//
// Scope is narrow on purpose: OTLP/HTTP with JSON encoding, traces only. No
// protobuf, no gRPC, no metrics, no logs. That subset is what every SDK can emit
// and is a fraction of the spec surface.
//
// Accepts two kinds of key:
//   sk_  server-side, secret, no origin binding. Header only.
//   pk_  public, origin-locked, rate limited. Header or ?key= for sendBeacon.

import { derive } from '../_shared/otlp.ts'
import { adminClient } from '../_shared/supabase.ts'
import { jsonReflecting, preflightReflecting } from '../_shared/http.ts'
import { extractKey, isTracesPath, keyCameFromUrl, keyIsPublishable, requestOrigin } from '../_shared/ingest-auth.ts'

/** Rejection reason from resolve_ingest_key -> the status an exporter should see.
 *  429 tells a conformant exporter to back off and retry; 401 and 403 tell it to
 *  stop rather than hammer a key that will never work. */
const statusForReason = (reason: string): number => {
  if (reason.includes('rate limit')) return 429
  if (reason.includes('origin')) return 403
  return 401
}

/** OTLP defines success as an empty ExportTraceServiceResponse. Extra fields are
 *  ignored by conformant exporters, so diagnostics ride along for humans using
 *  curl without breaking an SDK. */
const otlpOk = (req: Request, extra: Record<string, unknown> = {}) => jsonReflecting(req, extra, 200)

/** A malformed batch is reported as partialSuccess rather than an error: an
 *  exporter retrying rubbish forever helps nobody. */
const otlpRejected = (req: Request, rejected: number, message: string) =>
  jsonReflecting(req, { partialSuccess: { rejectedSpans: rejected, errorMessage: message } }, 200)

Deno.serve(async (req) => {
  const pre = preflightReflecting(req)
  if (pre) return pre

  if (req.method !== 'POST') return jsonReflecting(req, { error: 'POST required' }, 405)

  if (!isTracesPath(new URL(req.url).pathname)) {
    return jsonReflecting(req, { error: 'unknown path; expected /v1/traces' }, 404)
  }

  // Protobuf is the default for some SDKs. Say so plainly rather than failing to
  // parse and reporting something misleading.
  if ((req.headers.get('content-type') ?? '').includes('protobuf')) {
    return jsonReflecting(
      req,
      { error: 'only OTLP/HTTP with JSON encoding is supported; set the exporter protocol to http/json' },
      415,
    )
  }

  const key = extractKey(req)
  if (!key) return jsonReflecting(req, { error: 'missing ingest key' }, 401)

  // A secret key must never be accepted from a URL. Query strings land in access
  // logs, proxy logs and Referer headers, so an sk_ there is a genuine leak —
  // and silently honouring it would train people to send it that way.
  if (keyCameFromUrl(req) && !keyIsPublishable(key)) {
    return jsonReflecting(
      req,
      { error: 'a secret key may not be passed in the url; use an Authorization header, or mint a publishable pk_ key' },
      400,
    )
  }

  const admin = adminClient()
  const origin = requestOrigin(req)

  // Authenticate, authorise the origin, and spend a unit of quota in one call,
  // so two concurrent batches cannot both slip past the rate limit.
  const { data: rows, error: authErr } = await admin.rpc('resolve_ingest_key', {
    p_token: key,
    p_origin: origin,
  })
  if (authErr) return jsonReflecting(req, { error: `key resolution failed: ${authErr.message}` }, 500)

  const resolved = Array.isArray(rows) ? rows[0] : rows
  if (!resolved?.project_id) {
    const reason = resolved?.reason ?? 'invalid key'
    return jsonReflecting(req, { error: reason }, statusForReason(reason))
  }

  let payload: unknown
  try {
    payload = await req.json()
  } catch {
    return otlpRejected(req, 0, 'body is not valid JSON')
  }

  const graph = derive(payload)

  if (graph.events.length === 0) {
    // Not an error: a batch of purely internal spans legitimately yields no
    // edges. Report why, so a quiet pipeline is debuggable.
    return otlpOk(req, {
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
    p_project_id: resolved.project_id,
    p_graph: graph,
  })

  // 500 so the exporter retries: the batch was well-formed and our side failed.
  if (error) return jsonReflecting(req, { error: `ingest failed: ${error.message}` }, 500)

  return otlpOk(req, {
    signalscope: {
      ...(result ?? {}),
      skipped: graph.skipped.slice(0, 20),
      // Two service names that slugify to one key merge into a single node.
      // Surfaced rather than silently collapsed, so it is diagnosable.
      nameCollisions: graph.nameCollisions,
    },
  })
})
