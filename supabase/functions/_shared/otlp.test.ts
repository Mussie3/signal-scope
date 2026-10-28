// SignalScope :: derivation tests
//
// Run: npx deno@2 test --allow-none supabase/functions/_shared/otlp.test.ts
//
// This is the one piece of logic where a subtle error draws a map that is
// confidently wrong rather than visibly broken, so it is also the one piece
// worth testing properly. Assertions are hand-rolled to keep the suite
// hermetic — no registry fetch to run it.

import { derive, slugify, SPAN_KIND } from './otlp.ts'

const eq = <T>(actual: T, expected: T, what: string) => {
  if (actual !== expected) throw new Error(`${what}: expected ${String(expected)}, got ${String(actual)}`)
}
const ok = (cond: boolean, what: string) => {
  if (!cond) throw new Error(what)
}

const ns = (ms: number) => String(BigInt(ms) * 1_000_000n)
const res = (name: string, spans: unknown[], region?: string) => ({
  resource: {
    attributes: [
      { key: 'service.name', value: { stringValue: name } },
      ...(region ? [{ key: 'cloud.region', value: { stringValue: region } }] : []),
    ],
  },
  scopeSpans: [{ spans }],
})

// A browser -> api -> {postgres, redis, stripe} trace in the shape OTLP/HTTP
// JSON actually arrives: service.name as a resource attribute, nanos as strings.
const payload = {
  resourceSpans: [
    res('web-frontend', [
      { traceId: 't1', spanId: 'a1', name: 'GET /dashboard', kind: SPAN_KIND.CLIENT,
        startTimeUnixNano: ns(0), endTimeUnixNano: ns(240), status: { code: 1 },
        attributes: [{ key: 'server.address', value: { stringValue: 'api.internal' } }] },
      { traceId: 't1', spanId: 'a9', name: 'render', kind: SPAN_KIND.INTERNAL, parentSpanId: 'a1',
        startTimeUnixNano: ns(240), endTimeUnixNano: ns(260), status: { code: 1 } },
    ], 'eu-central-1'),
    res('orders-api', [
      { traceId: 't1', spanId: 'b1', parentSpanId: 'a1', name: 'GET /dashboard', kind: SPAN_KIND.SERVER,
        startTimeUnixNano: ns(10), endTimeUnixNano: ns(230), status: { code: 1 } },
      { traceId: 't1', spanId: 'b2', parentSpanId: 'b1', name: 'SELECT orders', kind: SPAN_KIND.CLIENT,
        startTimeUnixNano: ns(20), endTimeUnixNano: ns(120), status: { code: 1 },
        attributes: [
          { key: 'db.system', value: { stringValue: 'postgresql' } },
          { key: 'db.name', value: { stringValue: 'shopdb' } },
        ] },
      { traceId: 't1', spanId: 'b3', parentSpanId: 'b1', name: 'GET session', kind: SPAN_KIND.CLIENT,
        startTimeUnixNano: ns(125), endTimeUnixNano: ns(133), status: { code: 1 },
        attributes: [{ key: 'db.system', value: { stringValue: 'redis' } }] },
      { traceId: 't1', spanId: 'b4', parentSpanId: 'b1', name: 'POST /charges', kind: SPAN_KIND.CLIENT,
        startTimeUnixNano: ns(140), endTimeUnixNano: ns(600), status: { code: 2 },
        attributes: [{ key: 'peer.service', value: { stringValue: 'stripe' } }] },
      { traceId: 't1', spanId: 'b5', parentSpanId: 'b1', name: 'serialize', kind: SPAN_KIND.INTERNAL,
        startTimeUnixNano: ns(200), endTimeUnixNano: ns(210), status: { code: 1 } },
      { traceId: 't2', spanId: 'c1', parentSpanId: 'MISSING', name: 'GET /health', kind: SPAN_KIND.SERVER,
        startTimeUnixNano: ns(0), endTimeUnixNano: ns(5), status: { code: 1 } },
    ]),
  ],
}

const out = derive(payload)
const svc = (k: string) => out.services.find((s) => s.key === k)
const edge = (s: string, t: string) => out.connections.some((c) => c.source === s && c.target === t)
const ev = (s: string, t: string) => out.events.find((e) => e.source === s && e.target === t)

Deno.test('edge exists, and points caller -> callee', () => {
  ok(edge('web-frontend', 'orders-api'), 'frontend -> api edge missing')
  ok(!edge('orders-api', 'web-frontend'), 'edge direction is reversed')
})

Deno.test('edge latency is the CLIENT duration, not the server span', () => {
  // 240 is what the caller waited; 220 is what the callee spent. The map answers
  // "is this link slow for whoever depends on it", so network and queueing count.
  eq(ev('web-frontend', 'orders-api')?.latency_ms, 240, 'frontend->api latency')
})

Deno.test('a service that CALLS a database is not itself a database', () => {
  // db.system on an outbound CLIENT span describes the callee. Reading it as the
  // caller's own kind labels every API that touches Postgres a database.
  eq(svc('orders-api')?.kind, 'api', 'orders-api kind')
})

Deno.test('a service with no inbound spans is an entry point', () => {
  eq(svc('web-frontend')?.kind, 'frontend', 'web-frontend kind')
})

Deno.test('uninstrumented peers are synthesised from attributes', () => {
  eq(svc('postgresql-shopdb')?.kind, 'database', 'postgres kind')
  eq(svc('stripe')?.kind, 'external', 'stripe kind')
})

Deno.test('redis is a cache, not a database', () => {
  // It speaks a db protocol, but 8ms is healthy for a cache and the thresholds
  // that matter are different.
  eq(svc('redis')?.kind, 'cache', 'redis kind')
})

Deno.test('span status ERROR becomes success=false', () => {
  eq(ev('orders-api', 'stripe')?.success, false, 'failed third-party call')
})

Deno.test('database latency is the query duration', () => {
  eq(ev('orders-api', 'postgresql-shopdb')?.latency_ms, 100, 'db latency')
})

Deno.test('same-service work produces no edge', () => {
  ok(!out.connections.some((c) => c.source === c.target), 'self-edge present')
  eq(out.connections.length, 4, 'connection count')
})

Deno.test('orphan spans are skipped, never invented', () => {
  ok(out.skipped.some((s) => s.reason.startsWith('orphan')), 'orphan not skipped')
  ok(!!svc('orders-api'), 'orphan span should still register its service')
})

Deno.test('no duplicate edges', () => {
  const keys = out.connections.map((c) => `${c.source}>${c.target}`)
  eq(new Set(keys).size, keys.length, 'duplicate edges')
})

Deno.test('cloud.region is carried onto the service', () => {
  eq(svc('web-frontend')?.region, 'eu-central-1', 'frontend region')
  eq(svc('orders-api')?.region, 'unknown', 'api region falls back')
})

// ---------------------------------------------------------------------------
// slugify: services.key is constrained to ^[a-z0-9][a-z0-9-]{0,62}$ but
// service.name is free text, so every real-world name has to survive the trip.
// ---------------------------------------------------------------------------
const KEY_SHAPE = /^[a-z0-9][a-z0-9-]{0,62}$/

Deno.test('slugify always satisfies the services.key constraint', () => {
  const nasty = [
    'My Service', 'checkout_api', 'api.example.com', 'postgresql:orders',
    'Orders-API', '  spaced  out  ', '___', '!!!', 'ÜberService', 'a'.repeat(200),
    'trailing-', '-leading', '9lives', '',
  ]
  for (const n of nasty) {
    const s = slugify(n)
    ok(KEY_SHAPE.test(s), `slugify(${JSON.stringify(n)}) = ${JSON.stringify(s)} violates the key constraint`)
  }
})

Deno.test('slugify keeps already-clean names untouched', () => {
  eq(slugify('orders-api'), 'orders-api', 'clean name')
  eq(slugify('web-frontend'), 'web-frontend', 'clean name')
})

Deno.test('the readable original is preserved in name', () => {
  const p = { resourceSpans: [res('My Checkout Service', [
    { traceId: 't', spanId: 'x1', name: 'q', kind: SPAN_KIND.CLIENT,
      startTimeUnixNano: ns(0), endTimeUnixNano: ns(5), status: { code: 1 },
      attributes: [{ key: 'db.system', value: { stringValue: 'postgresql' } }] },
  ])] }
  const d = derive(p)
  const s = d.services.find((x) => x.key === 'my-checkout-service')
  eq(s?.name, 'My Checkout Service', 'original name preserved')
})

Deno.test('names that collide on one key are reported, not silently merged', () => {
  const p = { resourceSpans: [
    res('My Service', [{ traceId: 't', spanId: 'p1', name: 'a', kind: SPAN_KIND.CLIENT,
      startTimeUnixNano: ns(0), endTimeUnixNano: ns(1), status: { code: 1 },
      attributes: [{ key: 'peer.service', value: { stringValue: 'z' } }] }]),
    res('my_service', [{ traceId: 't', spanId: 'p2', name: 'b', kind: SPAN_KIND.CLIENT,
      startTimeUnixNano: ns(0), endTimeUnixNano: ns(1), status: { code: 1 },
      attributes: [{ key: 'peer.service', value: { stringValue: 'z' } }] }]),
  ] }
  const d = derive(p)
  const c = d.nameCollisions.find((x) => x.key === 'my-service')
  ok(!!c, 'collision not reported')
  eq(c?.names.length, 2, 'collision should list both names')
})

Deno.test('malformed input does not throw', () => {
  for (const bad of [{}, { resourceSpans: null }, { resourceSpans: [{}] }, { resourceSpans: [{ scopeSpans: [{}] }] }]) {
    const d = derive(bad)
    eq(d.events.length, 0, 'malformed payload should yield no events')
  }
})
