/// <reference lib="dom" />
// SignalScope :: browser collector
//
// A drop-in script that reports what a page actually talks to, as OTLP traces.
// No build step, no dependencies, no declared topology: the browser already
// knows every endpoint a page calls, so the map builds itself from real traffic.
//
// Deliberately NOT @opentelemetry/sdk-trace-web. That stack is well over 100KB
// gzipped, which is indefensible for a tag whose entire job is to observe page
// performance. Emitting OTLP/HTTP JSON by hand is a few KB, and the wire format
// is the part that matters for compatibility - not which library produced it.
//
// ---------------------------------------------------------------------------
// Split on purpose: `createCollector` is pure and testable in any runtime, and
// `install` is the thin browser-only binding that feeds it. The interesting
// logic is in the former so it can be verified without a headless browser.
// ---------------------------------------------------------------------------

export type CollectorConfig = {
  /** Becomes service.name - the node this page appears as on the map. */
  serviceName: string
  /** Full URL of the OTLP receiver, e.g. https://<ref>.supabase.co/functions/v1/otlp */
  endpoint: string
  /** Publishable key. Public by design, so it is origin-locked and rate-limited
   *  server-side rather than kept secret. */
  apiKey: string
  /** Origins that are YOUR backend rather than somebody else's service. This is
   *  the whole point of the distinction: "my API is slow" and "Stripe is slow"
   *  are different incidents with different owners, and from inside a browser
   *  every call looks external unless told otherwise. */
  firstPartyOrigins?: string[]
  /** Fraction of calls to report. A busy page makes hundreds of requests and
   *  nobody needs all of them to see a topology. */
  sampleRate?: number
  /** Spans buffered before an automatic flush. */
  batchSize?: number
  /** Optional region, surfaced as cloud.region. */
  region?: string
  /** Origins to never report, beyond the receiver itself.
   *
   *  The collector is usually served FROM somewhere, and fetching it is not a
   *  service call. Without this the host serving the script becomes a
   *  dependency node on every map that uses it -- the monitoring tool
   *  appearing on its own map, which is the one node guaranteed to be wrong. */
  ignoreOrigins?: string[]
  /** How often to ship whatever is buffered, in ms. 0 disables the timer.
   *  Page-hide flushing alone is not enough for an installed PWA, which can
   *  stay visible for hours. */
  flushIntervalMs?: number
  /** Overrides how a batch leaves the page. Defaults to fetch, with sendBeacon
   *  on page hide. Supplying this routes telemetry through your own proxy - and
   *  makes the collector testable without a network or a browser. */
  transport?: (url: string, body: string, opts: { beacon?: boolean }) => void | Promise<void>
  /** Injectable for tests. */
  now?: () => number
  random?: () => number
}

type Span = {
  traceId: string
  spanId: string
  name: string
  kind: number
  startTimeUnixNano: string
  endTimeUnixNano: string
  status: { code: number }
  attributes: Array<{ key: string; value: { stringValue?: string; intValue?: number } }>
}

export type Call = {
  url: string
  method?: string
  startMs: number
  endMs: number
  status?: number
  failed?: boolean
  /** Reuse a span id already sent downstream as traceparent, so the backend's
   *  SERVER span names this exact span as its parent. */
  spanId?: string
}

const SPAN_KIND_CLIENT = 3
const STATUS_OK = 1
const STATUS_ERROR = 2

const hex = (bytes: number, random: () => number) => {
  let s = ''
  for (let i = 0; i < bytes * 2; i++) s += Math.floor(random() * 16).toString(16)
  return s
}

const originOf = (url: string): string | null => {
  try {
    return new URL(url, typeof location !== 'undefined' ? location.href : 'http://localhost').origin
  } catch {
    return null
  }
}

/**
 * Resolving against the page URL is deliberate: `fetch('/api/orders')` is how
 * most same-origin calls are written, and those must land as your own API rather
 * than being discarded. The cost is that `new URL(x, base)` does not throw on
 * rubbish - it happily treats it as a relative path - so implausible input has
 * to be rejected explicitly:
 *   - unencoded whitespace never appears in a real URL
 *   - non-HTTP schemes (data:, blob:, javascript:) are not network dependencies
 *     and would otherwise spawn a node per inline image
 */
const hostOf = (url: string): string | null => {
  if (!url || /\s/.test(url)) return null
  try {
    const u = new URL(url, typeof location !== 'undefined' ? location.href : 'http://localhost')
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u.host
  } catch {
    return null
  }
}

export const createCollector = (config: CollectorConfig) => {
  const {
    serviceName,
    endpoint,
    apiKey,
    firstPartyOrigins = [],
    sampleRate = 1,
    batchSize = 20,
    ignoreOrigins = [],
    region,
    transport,
    now = () => Date.now(),
    random = Math.random,
  } = config

  let buffer: Span[] = []
  // One trace id per page view. A browser has no inbound request to inherit a
  // trace from, so every call it makes is a root in its own right; grouping them
  // under one page-view trace is what makes the frontend read as a single node
  // rather than N disconnected ones.
  const pageTraceId = hex(16, random)

  const record = (call: Call) => {
    if (random() >= sampleRate) return

    const host = hostOf(call.url)
    if (!host) return

    const origin = originOf(call.url)
    // Never report calls to the receiver itself, or to wherever the collector
    // was served from. Either one makes the map grow a node for the monitoring
    // tool rather than for the system being monitored.
    if (origin && endpoint.startsWith(origin)) return
    if (origin && ignoreOrigins.includes(origin)) return

    const isFirstParty = !!origin && firstPartyOrigins.includes(origin)
    const ok = !call.failed && (call.status === undefined || call.status < 400)

    buffer.push({
      traceId: pageTraceId,
      spanId: call.spanId ?? hex(8, random),
      name: `${call.method ?? 'GET'} ${host}`,
      kind: SPAN_KIND_CLIENT,
      startTimeUnixNano: String(Math.round(call.startMs * 1e6)),
      endTimeUnixNano: String(Math.round(call.endMs * 1e6)),
      status: { code: ok ? STATUS_OK : STATUS_ERROR },
      attributes: [
        { key: 'server.address', value: { stringValue: host } },
        // Non-standard, and honoured by SignalScope's derivation only. Without
        // it a browser can never distinguish your own API from a third party,
        // because from inside the page both are just another origin.
        { key: 'signalscope.peer.kind', value: { stringValue: isFirstParty ? 'api' : 'external' } },
        ...(call.status !== undefined
          ? [{ key: 'http.response.status_code', value: { intValue: call.status } }]
          : []),
      ],
    })

    if (buffer.length >= batchSize) void flush()
  }

  const buildPayload = (spans: Span[]) => ({
    resourceSpans: [
      {
        resource: {
          attributes: [
            { key: 'service.name', value: { stringValue: serviceName } },
            ...(region ? [{ key: 'cloud.region', value: { stringValue: region } }] : []),
          ],
        },
        scopeSpans: [{ scope: { name: 'signalscope-browser' }, spans }],
      },
    ],
  })

  /** `beacon` is used on page hide: fetch is cancelled during unload, which is
   *  exactly when the last and most interesting batch would otherwise be lost. */
  const flush = async (opts: { beacon?: boolean } = {}) => {
    if (buffer.length === 0) return
    const spans = buffer
    buffer = []
    const body = JSON.stringify(buildPayload(spans))

    if (transport) {
      await transport(`${endpoint}/v1/traces`, body, opts)
      return
    }

    if (opts.beacon && typeof navigator !== 'undefined' && navigator.sendBeacon) {
      // sendBeacon cannot set an Authorization header, so the key rides in the
      // query string for this path only. It is a publishable, origin-locked key,
      // so appearing in a URL is not a new exposure.
      navigator.sendBeacon(`${endpoint}/v1/traces?key=${encodeURIComponent(apiKey)}`, body)
      return
    }

    try {
      await fetch(`${endpoint}/v1/traces`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body,
        keepalive: true,
      })
    } catch {
      // A collector that breaks the host page is worse than no collector.
      // Dropped telemetry is the correct failure mode here.
    }
  }

  return { record, flush, buildPayload, pending: () => buffer.length, traceId: pageTraceId, newSpanId: () => hex(8, random), _now: now }
}

export type Collector = ReturnType<typeof createCollector>

// ---------------------------------------------------------------------------
// Browser binding. Wraps fetch and XHR, and sweeps Resource Timing so calls
// made before install - or by third-party scripts that bypass fetch entirely -
// still show up.
// ---------------------------------------------------------------------------
export const install = (config: CollectorConfig): Collector => {
  const collector = createCollector(config)
  if (typeof window === 'undefined') return collector

  const { flushIntervalMs = 15_000, firstPartyOrigins = [] } = config
  const selfOrigin = location.origin

  /**
   * Whether to hand this request a traceparent.
   *
   * ONLY first-party origins, and this restriction is not caution -- it is
   * correctness. traceparent is not a CORS-safelisted header, so adding it to
   * a cross-origin request forces a preflight, and a third party that does not
   * answer OPTIONS with the right Access-Control-Allow-Headers will have the
   * request fail outright. Instrumenting a page must never break the page, and
   * Stripe does not need our trace id anyway.
   *
   * Same-origin calls are included: an API served from the page's own origin
   * is still a backend worth joining the trace to.
   */
  const shouldTrace = (url: string): boolean => {
    const origin = originOf(url)
    if (!origin) return false
    return origin === selfOrigin || firstPartyOrigins.includes(origin)
  }

  /** W3C trace context: version-traceid-spanid-flags. 01 = sampled. */
  const traceparent = (spanId: string) => `00-${collector.traceId}-${spanId}-01`

  const origFetch = window.fetch
  window.fetch = async function (...args: Parameters<typeof fetch>) {
    const start = performance.timeOrigin + performance.now()
    const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url ?? String(args[0])
    const method = (args[1]?.method ?? (args[0] as Request)?.method ?? 'GET').toUpperCase()

    // The span id is minted HERE, before the call, so the header sent
    // downstream and the span reported upstream carry the same id. Generating
    // it at record() time would send one id and report another, and the
    // backend's SERVER span would name a parent that does not exist.
    let spanId: string | undefined
    if (shouldTrace(url)) {
      spanId = collector.newSpanId()
      try {
        if (args[0] instanceof Request) {
          // A Request's headers are immutable once constructed, so the only
          // way to add one is to build a new Request from it.
          const headers = new Headers(args[0].headers)
          headers.set('traceparent', traceparent(spanId))
          args[0] = new Request(args[0], { headers })
        } else {
          const init = (args[1] ?? {}) as RequestInit
          const headers = new Headers(init.headers)
          headers.set('traceparent', traceparent(spanId))
          args[1] = { ...init, headers }
        }
      } catch {
        // Header injection is best effort. If anything about this request
        // resists it, report the call untraced rather than fail it.
        spanId = undefined
      }
    }

    try {
      const res = await origFetch.apply(this, args)
      collector.record({ url, method, spanId, startMs: start, endMs: performance.timeOrigin + performance.now(), status: res.status })
      return res
    } catch (err) {
      collector.record({ url, method, spanId, startMs: start, endMs: performance.timeOrigin + performance.now(), failed: true })
      throw err
    }
  }

  /**
   * XHR, which is not a legacy concern.
   *
   * The Resource Timing sweep below skips xmlhttprequest entries on the
   * grounds that they are "already wrapped" -- but nothing wrapped them, so
   * until now XHR traffic was reported by neither path and simply did not
   * exist on the map. axios still uses XHR in browsers by default, so for a
   * large share of apps that meant no API calls at all.
   */
  const XhrProto = XMLHttpRequest.prototype
  const origOpen = XhrProto.open
  const origSend = XhrProto.send

  type Tracked = XMLHttpRequest & { __ss?: { url: string; method: string; start: number; spanId?: string } }

  // Typed through the real signatures rather than cast away: `any` here would
  // hide a genuine mistake, since open() and send() have overloads whose
  // argument shapes differ.
  type OpenArgs = Parameters<typeof XMLHttpRequest.prototype.open>
  type SendArgs = Parameters<typeof XMLHttpRequest.prototype.send>

  XhrProto.open = function (this: Tracked, ...args: OpenArgs) {
    this.__ss = { url: String(args[1]), method: String(args[0]).toUpperCase(), start: 0 }
    return origOpen.apply(this, args)
  }

  XhrProto.send = function (this: Tracked, ...args: SendArgs) {
    const meta = this.__ss
    if (meta) {
      meta.start = performance.timeOrigin + performance.now()
      if (shouldTrace(meta.url)) {
        meta.spanId = collector.newSpanId()
        try {
          this.setRequestHeader('traceparent', traceparent(meta.spanId))
        } catch {
          // setRequestHeader throws if the request is not OPEN. Report it
          // untraced rather than let instrumentation break the call.
          meta.spanId = undefined
        }
      }
      this.addEventListener('loadend', () => {
        collector.record({
          url: meta.url,
          method: meta.method,
          spanId: meta.spanId,
          startMs: meta.start,
          endMs: performance.timeOrigin + performance.now(),
          // status is 0 when the request failed or was aborted.
          ...(this.status ? { status: this.status } : { failed: true }),
        })
      })
    }
    return origSend.apply(this, args)
  }

  // Resource Timing catches what fetch and XHR wrapping cannot: images,
  // scripts, beacons, and anything loaded before this script ran.
  if (typeof PerformanceObserver !== 'undefined') {
    try {
      // Loading your own JavaScript is not a service call.
      //
      // Resource Timing reports every script, stylesheet, font and image the
      // page pulls from its own origin. Reported as spans, those become a
      // dependency node for the host that serves the app to itself - on a
      // static deploy that is one bogus node carrying almost all the traffic,
      // drowning the real backend it sits next to.
      //
      // Same-origin fetch and XHR still count: an app whose API shares its
      // origin is making genuine calls, and those come through the wrapper
      // above rather than through here.
      const ASSET_TYPES = new Set(['script', 'link', 'css', 'img', 'image', 'font', 'other'])
      const obs = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as PerformanceResourceTiming[]) {
          if (entry.initiatorType === 'fetch' || entry.initiatorType === 'xmlhttprequest') continue // already wrapped
          if (originOf(entry.name) === selfOrigin && ASSET_TYPES.has(entry.initiatorType)) continue
          collector.record({
            url: entry.name,
            method: 'GET',
            startMs: performance.timeOrigin + entry.startTime,
            endMs: performance.timeOrigin + entry.responseEnd,
          })
        }
      })
      obs.observe({ type: 'resource', buffered: true })
    } catch {
      /* Resource Timing unavailable; fetch wrapping still works. */
    }
  }

  // Page hide is the only reliable "last chance" event on mobile Safari.
  // It is NOT sufficient on its own: an installed PWA left open on a counter
  // all day never hides, so without a timer its spans sit in the buffer for
  // hours and the map shows a service that stopped reporting.
  addEventListener('pagehide', () => void collector.flush({ beacon: true }))
  addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void collector.flush({ beacon: true })
  })

  if (flushIntervalMs > 0) {
    setInterval(() => {
      if (collector.pending() > 0) void collector.flush()
    }, flushIntervalMs)
  }

  return collector
}
