// SignalScope :: OpenTelemetry trace -> service graph
//
// Why this exists: requiring collectors to declare a topology is the step where
// self-serve adoption dies. Every OTel-instrumented system already describes its
// own graph in its spans, so the graph can be derived instead of declared.
//
// ---------------------------------------------------------------------------
// The shape of the problem
//
// A cross-service call emits TWO spans:
//   - a CLIENT span in the caller  (duration = what the caller waited)
//   - a SERVER span in the callee  (its parent is the CLIENT span)
//
// So an edge is CLIENT.service -> SERVER.service, and the latency recorded is
// the CLIENT duration: SignalScope's map answers "is this link slow for whoever
// depends on it", which must include network and queueing, not just the callee's
// own work.
//
// Two cases break that neat pair, and both matter:
//   - Databases and caches are almost never instrumented, so a query arrives as
//     a lone CLIENT span carrying db.system, with no SERVER child. Without
//     synthesising the far side, the database never appears on the map at all.
//   - Third-party HTTP is the same shape with peer.service / server.address.
// ---------------------------------------------------------------------------

export const SPAN_KIND = {
  UNSPECIFIED: 0,
  INTERNAL: 1,
  SERVER: 2,
  CLIENT: 3,
  PRODUCER: 4,
  CONSUMER: 5,
} as const

const STATUS_ERROR = 2

export type ServiceKind = 'api' | 'database' | 'cache' | 'frontend' | 'external'

export type DerivedService = { key: string; name: string; kind: ServiceKind; region: string }
export type DerivedConnection = { key: string; source: string; target: string }
export type DerivedEvent = { source: string; target: string; latency_ms: number; success: boolean }

export type Derived = {
  services: DerivedService[]
  connections: DerivedConnection[]
  events: DerivedEvent[]
  skipped: { span: string; reason: string }[]
  /** Distinct service.name values that slugify to the same key, so an operator
   *  can see why two services merged into one node instead of guessing. */
  nameCollisions: { key: string; names: string[] }[]
}

// deno-lint-ignore no-explicit-any
type Any = any

const attr = (attrs: Any[] | undefined, key: string): string | undefined => {
  const found = (attrs ?? []).find((a) => a?.key === key)
  if (!found) return undefined
  const v = found.value ?? {}
  const raw = v.stringValue ?? v.intValue ?? v.boolValue
  return raw === undefined || raw === null ? undefined : String(raw)
}

const durationMs = (span: Any): number => {
  try {
    const d = BigInt(span.endTimeUnixNano ?? 0) - BigInt(span.startTimeUnixNano ?? 0)
    return Math.max(0, Math.round(Number(d) / 1e6))
  } catch {
    return 0
  }
}

/**
 * services.key is constrained to ^[a-z0-9][a-z0-9-]{0,62}$, but service.name is
 * free text — "My Service", "checkout_api", "postgresql:orders" are all normal
 * and all rejected by that constraint. The readable original is preserved in
 * services.name; this only produces the key.
 */
export const slugify = (raw: string): string => {
  let s = raw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  if (s.length > 63) s = s.slice(0, 63).replace(/-+$/g, '')
  if (!s) return 'unknown'
  if (!/^[a-z0-9]/.test(s)) s = `s-${s}`.slice(0, 63).replace(/-+$/g, '')
  return s
}

const flatten = (payload: Any): Array<Any & { _service: string; _region: string }> => {
  const spans: Array<Any & { _service: string; _region: string }> = []
  for (const rs of payload?.resourceSpans ?? []) {
    const service = attr(rs?.resource?.attributes, 'service.name') ?? 'unknown'
    // cloud.region is a standard OTel resource attribute; services.region is
    // NOT NULL with no default, so something has to fill it.
    const region = attr(rs?.resource?.attributes, 'cloud.region') ?? 'unknown'
    for (const ss of rs?.scopeSpans ?? []) {
      for (const span of ss?.spans ?? []) spans.push({ ...span, _service: service, _region: region })
    }
  }
  return spans
}

/** Name the implicit peer on the far side of a lone CLIENT span. */
const inferPeer = (span: Any): { name: string; kind: ServiceKind } | null => {
  const dbSystem = attr(span.attributes, 'db.system')
  if (dbSystem) {
    const dbName = attr(span.attributes, 'db.name')
    // Redis and Memcached speak a db protocol but are caches: different health
    // thresholds, different meaning on the map. 8ms is fine for a cache and
    // alarming for nothing; 800ms is fine for neither.
    const kind: ServiceKind = ['redis', 'memcached'].includes(dbSystem) ? 'cache' : 'database'
    return { name: dbName ? `${dbSystem}:${dbName}` : dbSystem, kind }
  }
  // A browser cannot tell your API from a third party: from inside the page both
  // are just another origin. The browser collector therefore states which it is,
  // and that hint is trusted over the default when present. Without it every
  // frontend dependency would be classified 'external', and "my API is slow" and
  // "Stripe is slow" would be the same incident.
  const hinted = attr(span.attributes, 'signalscope.peer.kind')
  const hintedKind: ServiceKind | null =
    hinted === 'api' || hinted === 'database' || hinted === 'cache' || hinted === 'external'
      ? hinted
      : null

  const peer = attr(span.attributes, 'peer.service')
  if (peer) return { name: peer, kind: hintedKind ?? 'external' }
  const host = attr(span.attributes, 'server.address') ?? attr(span.attributes, 'net.peer.name')
  if (host) return { name: host, kind: hintedKind ?? 'external' }
  return null
}

export const derive = (payload: Any): Derived => {
  const spans = flatten(payload)
  const byId = new Map(spans.map((s) => [s.spanId, s]))

  const services = new Map<string, DerivedService>()
  const namesByKey = new Map<string, Set<string>>()
  const edges = new Map<string, DerivedConnection>()
  const events: DerivedEvent[] = []
  const skipped: { span: string; reason: string }[] = []

  const noteService = (name: string, kind: ServiceKind, region: string, authoritative = false) => {
    const key = slugify(name)
    if (!namesByKey.has(key)) namesByKey.set(key, new Set())
    namesByKey.get(key)!.add(name)
    // A synthesised peer's kind is read straight off db.system / peer.service and
    // is authoritative. A service's own kind is inferred and must never overwrite
    // a peer classification.
    if (authoritative || !services.has(key)) services.set(key, { key, name, kind, region })
    return key
  }

  const noteEdge = (sourceKey: string, targetKey: string, latency: number, ok: boolean) => {
    if (sourceKey === targetKey) return // same service: internal work, not a link
    const key = `${sourceKey}-to-${targetKey}`.slice(0, 63)
    edges.set(`${sourceKey}>${targetKey}`, { key, source: sourceKey, target: targetKey })
    events.push({ source: sourceKey, target: targetKey, latency_ms: latency, success: ok })
  }

  // A service's own kind comes from the ROLES its spans play, never from a CLIENT
  // span's attributes: db.system on an outbound span describes the thing being
  // called, so reading it as the caller's own kind labels every API that queries
  // Postgres a "database". Serving inbound requests makes you an api; only making
  // outbound calls makes you an entry point.
  const roles = new Map<string, { server: boolean; client: boolean; region: string }>()
  for (const s of spans) {
    const r = roles.get(s._service) ?? { server: false, client: false, region: s._region }
    if (s.kind === SPAN_KIND.SERVER) r.server = true
    if (s.kind === SPAN_KIND.CLIENT || s.kind === SPAN_KIND.PRODUCER) r.client = true
    roles.set(s._service, r)
  }
  for (const [name, r] of roles) {
    noteService(name, r.server ? 'api' : r.client ? 'frontend' : 'api', r.region)
  }

  // Which CLIENT spans already have a SERVER child in another service? Those are
  // real pairs; the leftovers need a synthesised peer.
  const clientHasServerChild = new Set<string>()
  for (const s of spans) {
    if (s.kind !== SPAN_KIND.SERVER || !s.parentSpanId) continue
    const parent = byId.get(s.parentSpanId)
    if (parent && parent._service !== s._service) clientHasServerChild.add(parent.spanId)
  }

  for (const s of spans) {
    const ok = (s.status?.code ?? 0) !== STATUS_ERROR

    // Case 1: SERVER span whose parent is a CLIENT in another service.
    if (s.kind === SPAN_KIND.SERVER && s.parentSpanId) {
      const parent = byId.get(s.parentSpanId)
      if (parent && parent._service !== s._service) {
        noteEdge(slugify(parent._service), slugify(s._service), durationMs(parent), ok)
        continue
      }
      if (!parent) {
        // The parent arrived in a batch we do not have. The service is real, but
        // attributing an edge would mean inventing topology.
        skipped.push({ span: s.name ?? '(unnamed)', reason: 'orphan - parent span not in payload' })
        continue
      }
    }

    // Case 2: lone CLIENT/PRODUCER span - the far side is not instrumented.
    if (s.kind === SPAN_KIND.CLIENT || s.kind === SPAN_KIND.PRODUCER) {
      if (clientHasServerChild.has(s.spanId)) continue // already handled as a pair
      const peer = inferPeer(s)
      if (!peer) {
        skipped.push({ span: s.name ?? '(unnamed)', reason: 'client span with no identifiable peer' })
        continue
      }
      const targetKey = noteService(peer.name, peer.kind, s._region, true)
      noteEdge(slugify(s._service), targetKey, durationMs(s), ok)
      continue
    }

    // INTERNAL / CONSUMER / unspecified: real work, but not a link between
    // services. Drawing them would clutter the map with self-edges.
  }

  const nameCollisions = [...namesByKey.entries()]
    .filter(([, names]) => names.size > 1)
    .map(([key, names]) => ({ key, names: [...names] }))

  return {
    services: [...services.values()].sort((a, b) => a.key.localeCompare(b.key)),
    connections: [...edges.values()].sort((a, b) => a.key.localeCompare(b.key)),
    events,
    skipped,
    nameCollisions,
  }
}
