// SignalScope :: browser collector tests
//
// Run: npx deno@2 test snippet/signalscope.test.ts
//
// The point of these is the ROUND TRIP. It is not enough that the collector
// emits something OTLP-shaped - the server's derivation has to turn that exact
// payload into the right graph. Asserting on the payload's shape would pass
// happily while producing a wrong map, so every meaningful test here captures
// what the collector would actually send and runs it through the real derive().

import { createCollector } from './signalscope.ts'
import { derive } from '../supabase/functions/_shared/otlp.ts'

const eq = <T>(actual: T, expected: T, what: string) => {
  if (actual !== expected) throw new Error(`${what}: expected ${String(expected)}, got ${String(actual)}`)
}
const ok = (cond: boolean, what: string) => {
  if (!cond) throw new Error(what)
}

/** Deterministic PRNG: reproducible span ids and sampling decisions. Always
 *  returns < 1, so sampleRate=1 always records. */
const prng = (seed = 1) => {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    return (s % 1000) / 1000
  }
}

const ENDPOINT = 'https://proj.supabase.co/functions/v1/otlp'
const FIRST_PARTY = 'https://api.example-shop.com'

/** A collector whose batches are captured instead of sent. */
const capturing = (over: Record<string, unknown> = {}) => {
  const sent: unknown[] = []
  const beacons: boolean[] = []
  const c = createCollector({
    serviceName: 'Storefront Web',
    endpoint: ENDPOINT,
    apiKey: 'pk_test',
    firstPartyOrigins: [FIRST_PARTY],
    region: 'eu-central-1',
    batchSize: Number.MAX_SAFE_INTEGER, // no auto-flush mid-test
    random: prng(),
    transport: (_url, body, opts) => {
      sent.push(JSON.parse(body))
      beacons.push(!!opts.beacon)
    },
    // deno-lint-ignore no-explicit-any
    ...(over as any),
  })
  return { c, sent, beacons }
}

// ---------------------------------------------------------------------------
// The test that matters: real page traffic -> collector -> derive -> graph.
// ---------------------------------------------------------------------------
Deno.test('round trip: page traffic becomes the right topology', async () => {
  const { c, sent } = capturing()

  c.record({ url: `${FIRST_PARTY}/orders`, method: 'GET', startMs: 1000, endMs: 1240, status: 200 })
  c.record({ url: 'https://js.stripe.com/v3/', method: 'GET', startMs: 1000, endMs: 1460, status: 200 })
  c.record({ url: `${FIRST_PARTY}/sync`, method: 'POST', startMs: 1500, endMs: 2100, status: 500 })

  await c.flush()
  eq(sent.length, 1, 'one batch should have been sent')

  const d = derive(sent[0])
  const svc = (k: string) => d.services.find((s) => s.key === k)
  const ev = (t: string) => d.events.filter((e) => e.target === t)

  // The page itself: only outbound calls, no inbound spans, so an entry point.
  eq(svc('storefront-web')?.kind, 'frontend', 'page node kind')
  eq(svc('storefront-web')?.name, 'Storefront Web', 'readable name preserved')
  eq(svc('storefront-web')?.region, 'eu-central-1', 'region carried through')

  // The distinction the whole snippet exists to make.
  eq(svc('api-example-shop-com')?.kind, 'api', 'first-party origin should be an api')
  eq(svc('js-stripe-com')?.kind, 'external', 'third party should be external')

  // Edges run page -> dependency, never the reverse.
  ok(d.connections.some((x) => x.source === 'storefront-web' && x.target === 'api-example-shop-com'), 'api edge')
  ok(d.connections.some((x) => x.source === 'storefront-web' && x.target === 'js-stripe-com'), 'stripe edge')
  ok(!d.connections.some((x) => x.target === 'storefront-web'), 'nothing should point AT the page')

  // Latencies survive the ms -> nanos -> ms round trip intact.
  const apiLatencies = ev('api-example-shop-com').map((e) => e.latency_ms).sort((a, b) => a - b)
  eq(apiLatencies.join(','), '240,600', 'api call durations')
  eq(ev('js-stripe-com')[0]?.latency_ms, 460, 'stripe duration')

  // HTTP 500 is a failure even though the request itself completed.
  const failed = ev('api-example-shop-com').filter((e) => !e.success)
  eq(failed.length, 1, 'one failed api call')
  eq(failed[0]?.latency_ms, 600, 'the 500 is the slow one')

  eq(d.skipped.length, 0, 'nothing should be skipped')
})

Deno.test('a 4xx counts as a failure, a 304 does not', async () => {
  const { c, sent } = capturing()
  c.record({ url: `${FIRST_PARTY}/missing`, startMs: 0, endMs: 10, status: 404 })
  c.record({ url: `${FIRST_PARTY}/cached`, startMs: 0, endMs: 10, status: 304 })
  await c.flush()
  const d = derive(sent[0])
  const evs = d.events.filter((e) => e.target === 'api-example-shop-com')
  eq(evs.filter((e) => !e.success).length, 1, 'only the 404 should fail')
  eq(evs.filter((e) => e.success).length, 1, 'the 304 should succeed')
})

Deno.test('a network failure with no status is a failure', async () => {
  const { c, sent } = capturing()
  c.record({ url: `${FIRST_PARTY}/offline`, startMs: 0, endMs: 50, failed: true })
  await c.flush()
  const d = derive(sent[0])
  eq(d.events[0]?.success, false, 'failed fetch')
})

Deno.test('the collector never reports its own receiver', async () => {
  const { c, sent } = capturing()
  c.record({ url: `${ENDPOINT}/v1/traces`, method: 'POST', startMs: 0, endMs: 5, status: 200 })
  c.record({ url: `${FIRST_PARTY}/orders`, startMs: 0, endMs: 10, status: 200 })
  await c.flush()
  const d = derive(sent[0])
  ok(!d.services.some((s) => s.key.includes('supabase')), 'monitoring tool must not appear on its own map')
  eq(d.connections.length, 1, 'only the real dependency')
})

Deno.test('sampleRate 0 sends nothing at all', async () => {
  const { c, sent } = capturing({ sampleRate: 0 })
  for (let i = 0; i < 50; i++) c.record({ url: `${FIRST_PARTY}/x${i}`, startMs: 0, endMs: 1, status: 200 })
  await c.flush()
  eq(sent.length, 0, 'fully sampled out')
  eq(c.pending(), 0, 'nothing buffered')
})

Deno.test('batchSize triggers an automatic flush', async () => {
  const { c, sent } = capturing({ batchSize: 3 })
  for (let i = 0; i < 3; i++) c.record({ url: `${FIRST_PARTY}/x${i}`, startMs: 0, endMs: 1, status: 200 })
  // Auto-flush is fire-and-forget; give the microtask queue a turn.
  await Promise.resolve()
  eq(sent.length, 1, 'batch should have auto-flushed')
  eq(c.pending(), 0, 'buffer drained')
})

Deno.test('flush is a no-op when there is nothing buffered', async () => {
  const { c, sent } = capturing()
  await c.flush()
  eq(sent.length, 0, 'empty flush should not send')
})

Deno.test('page-hide flush is marked as a beacon', async () => {
  const { c, beacons } = capturing()
  c.record({ url: `${FIRST_PARTY}/orders`, startMs: 0, endMs: 10, status: 200 })
  await c.flush({ beacon: true })
  eq(beacons[0], true, 'beacon path should be requested on page hide')
})

Deno.test('rubbish and non-http schemes are dropped, never thrown', async () => {
  const { c, sent } = capturing()
  c.record({ url: 'not a url ::::', startMs: 0, endMs: 1 })           // whitespace
  c.record({ url: 'data:image/png;base64,iVBORw0KGgo=', startMs: 0, endMs: 1 }) // inline asset
  c.record({ url: 'blob:https://x/abc', startMs: 0, endMs: 1 })        // object URL
  c.record({ url: '', startMs: 0, endMs: 1 })                          // empty
  c.record({ url: `${FIRST_PARTY}/ok`, startMs: 0, endMs: 1, status: 200 })
  await c.flush()
  const d = derive(sent[0] ?? { resourceSpans: [] })
  eq(d.connections.length, 1, 'only the real dependency should survive')
  eq(d.connections[0]?.target, 'api-example-shop-com', 'surviving edge')
})

Deno.test('a relative url resolves to the page origin, not discarded', async () => {
  // This is the common case for a same-origin API: fetch('/api/orders'). It has
  // to resolve, or the backend never appears on the map at all.
  const { c, sent } = capturing({
    // No `location` in Deno, so the fallback base applies.
    firstPartyOrigins: ['http://localhost'],
  })
  c.record({ url: '/api/orders', method: 'GET', startMs: 0, endMs: 42, status: 200 })
  await c.flush()
  const d = derive(sent[0])
  eq(d.connections.length, 1, 'relative url should produce an edge')
  eq(d.services.find((s) => s.key === 'localhost')?.kind, 'api', 'same-origin call is first-party')
  eq(d.events[0]?.latency_ms, 42, 'latency preserved')
})

Deno.test('all spans in a page view share one trace id', async () => {
  const { c, sent } = capturing()
  c.record({ url: `${FIRST_PARTY}/a`, startMs: 0, endMs: 1, status: 200 })
  c.record({ url: `${FIRST_PARTY}/b`, startMs: 0, endMs: 1, status: 200 })
  await c.flush()
  // deno-lint-ignore no-explicit-any
  const spans = (sent[0] as any).resourceSpans[0].scopeSpans[0].spans
  eq(new Set(spans.map((s: { traceId: string }) => s.traceId)).size, 1, 'one trace per page view')
  eq(new Set(spans.map((s: { spanId: string }) => s.spanId)).size, 2, 'distinct span ids')
})
