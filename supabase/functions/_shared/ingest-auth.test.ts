// SignalScope :: ingest auth plumbing tests
//
// Run: npx deno@2 test supabase/functions/_shared/ingest-auth.test.ts
//
// Small, fiddly rules about where a credential may travel. Exactly the sort of
// thing that is quietly wrong for months, so it is tested directly rather than
// only through a live request.

import { extractKey, isTracesPath, keyCameFromUrl, keyIsPublishable, requestOrigin } from './ingest-auth.ts'

const eq = <T>(actual: T, expected: T, what: string) => {
  if (actual !== expected) throw new Error(`${what}: expected ${String(expected)}, got ${String(actual)}`)
}

const reqWith = (opts: { url?: string; headers?: Record<string, string> } = {}) =>
  new Request(opts.url ?? 'https://p.supabase.co/functions/v1/otlp/v1/traces', {
    method: 'POST',
    headers: opts.headers,
    body: '{}',
  })

Deno.test('a key is read from the Authorization header', () => {
  eq(extractKey(reqWith({ headers: { authorization: 'Bearer sk_abc' } })), 'sk_abc', 'bearer key')
  eq(extractKey(reqWith({ headers: { authorization: 'bearer sk_abc' } })), 'sk_abc', 'lowercase scheme')
})

Deno.test('a key is read from ?key= for the sendBeacon path', () => {
  // sendBeacon cannot set headers at all, and it is the only send that survives
  // page unload, so a query parameter is the only option there.
  eq(extractKey(reqWith({ url: 'https://p.supabase.co/x/v1/traces?key=pk_abc' })), 'pk_abc', 'query key')
})

Deno.test('the header wins when both are present', () => {
  const r = reqWith({ url: 'https://p.supabase.co/x/v1/traces?key=pk_query', headers: { authorization: 'Bearer pk_header' } })
  eq(extractKey(r), 'pk_header', 'header should take precedence')
})

Deno.test('a missing or empty key is null, not an empty string', () => {
  eq(extractKey(reqWith()), null, 'no key at all')
  eq(extractKey(reqWith({ headers: { authorization: 'Bearer    ' } })), null, 'whitespace bearer')
  eq(extractKey(reqWith({ url: 'https://p.supabase.co/x/v1/traces?key=' })), null, 'empty query key')
})

Deno.test('only pk_ keys are publishable', () => {
  eq(keyIsPublishable('pk_abc'), true, 'pk_')
  eq(keyIsPublishable('sk_abc'), false, 'sk_')
  eq(keyIsPublishable('abc'), false, 'unprefixed')
})

Deno.test('a url-borne key is detected so secrets can be refused there', () => {
  eq(keyCameFromUrl(reqWith({ url: 'https://p.supabase.co/x/v1/traces?key=pk_abc' })), true, 'from url')
  eq(keyCameFromUrl(reqWith({ headers: { authorization: 'Bearer sk_abc' } })), false, 'from header')
  // A header present alongside a query param means the header was used, so this
  // must not report a url key and wrongly reject a legitimate secret.
  eq(
    keyCameFromUrl(reqWith({ url: 'https://p.supabase.co/x/v1/traces?key=pk_q', headers: { authorization: 'Bearer sk_h' } })),
    false,
    'header present means not url-borne',
  )
})

Deno.test('origin comes from the Origin header', () => {
  eq(requestOrigin(reqWith({ headers: { origin: 'https://app.example.com' } })), 'https://app.example.com', 'origin')
})

Deno.test("a literal 'null' origin is treated as absent", () => {
  // Sandboxed iframes and some privacy modes send the string "null", which must
  // never match an allowlist entry.
  eq(requestOrigin(reqWith({ headers: { origin: 'null' } })), null, 'null origin')
})

Deno.test('origin falls back to the Referer, reduced to an origin', () => {
  eq(
    requestOrigin(reqWith({ headers: { referer: 'https://app.example.com/dashboard?x=1' } })),
    'https://app.example.com',
    'referer fallback',
  )
})

Deno.test('a malformed Referer yields null rather than throwing', () => {
  eq(requestOrigin(reqWith({ headers: { referer: 'not a url' } })), null, 'bad referer')
})

Deno.test('no origin and no referer is null', () => {
  eq(requestOrigin(reqWith()), null, 'neither header')
})

Deno.test('the traces path is recognised in the forms exporters actually use', () => {
  eq(isTracesPath('/functions/v1/otlp/v1/traces'), true, 'exporter-appended path')
  eq(isTracesPath('/functions/v1/otlp'), true, 'bare root')
  eq(isTracesPath('/functions/v1/otlp/'), true, 'trailing slash')
  eq(isTracesPath('/functions/v1/otlp/v1/metrics'), false, 'metrics is out of scope')
  eq(isTracesPath('/functions/v1/ingest'), false, 'the other function')
})
