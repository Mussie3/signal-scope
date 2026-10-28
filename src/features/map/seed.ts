import type { Service, Connection, ServiceKind } from "./types"

/**
 * The demo topology.
 *
 * Deliberately the size of a real system rather than the six nodes that fit on
 * a slide. A map's whole problem is legibility at scale: lanes, tiering, edge
 * routing and dimming are all answers to a question six services never ask, and
 * a demo that never asks it demonstrates nothing.
 *
 * Shaped like an estate that actually exists — the same service names repeated
 * per region, a couple of jobs nobody assigned a region to, and third parties
 * you depend on but cannot fix.
 */

const REGIONS = ["eu-central-1", "us-east-1", "ap-southeast-1"] as const

/** Tiers only set the seed positions; real depth is computed by the layout. */
const TIERS: Array<Array<[string, ServiceKind]>> = [
    [["web", "frontend"], ["mobile-gw", "frontend"]],
    [["users", "api"], ["auth", "api"], ["catalog", "api"], ["search", "api"], ["checkout", "api"]],
    [["notify", "api"], ["inventory", "api"], ["orders", "api"], ["payments", "api"]],
    [["session-cache", "cache"], ["catalog-cache", "cache"]],
    [["users-db", "database"], ["catalog-db", "database"], ["orders-db", "database"]],
]

const LOCAL_EDGES = [
    "web>auth", "web>catalog", "web>search", "web>checkout",
    "mobile-gw>users", "mobile-gw>auth", "mobile-gw>catalog", "mobile-gw>checkout",
    "users>users-db", "auth>users-db", "auth>session-cache",
    "catalog>catalog-cache", "catalog>catalog-db", "search>catalog-cache",
    "checkout>orders", "checkout>payments", "checkout>inventory", "checkout>session-cache",
    "orders>orders-db", "orders>notify", "payments>orders-db",
    "inventory>catalog-db", "inventory>orders-db",
]

/** A CDN calls you; you call everyone else. Direction matters for the layout. */
const EXTERNAL_EDGES = [
    "ext:cloudflare>web",
    "payments>ext:stripe",
    "notify>ext:sendgrid",
    "notify>ext:twilio",
    "catalog>ext:s3",
]

/**
 * Names are NOT prettified.
 *
 * "orders-db" is what the service calls itself in its OTel resource
 * attributes, what its deployment is named, and what someone will grep for.
 * Rendering it as "Orders DB" makes the map read like marketing and breaks the
 * one thing a label is for: matching what you already have on screen
 * elsewhere.
 */
const build = () => {
    const services: Service[] = []
    const connections: Connection[] = []
    const seen = new Set<string>()

    const connect = (from: string, to: string) => {
        const id = `${from}>${to}`
        if (seen.has(id) || from === to) return
        seen.add(id)
        connections.push({ id, sourceId: from, targetId: to, buffer: [] })
    }

    REGIONS.forEach((region, r) => {
        const laneX = r * 620
        TIERS.forEach((tier, t) => {
            tier.forEach(([name, kind], i) => {
                services.push({
                    id: `${region}:${name}`,
                    name,
                    kind,
                    region,
                    position: { x: laneX + 260 + (i - (tier.length - 1) / 2) * 104, y: 90 + t * 128 },
                })
            })
        })
        LOCAL_EDGES.forEach(e => {
            const [a, b] = e.split(">")
            connect(`${region}:${a}`, `${region}:${b}`)
        })
        EXTERNAL_EDGES.forEach(e => {
            const [a, b] = e.split(">")
            connect(a.startsWith("ext:") ? a : `${region}:${a}`, b.startsWith("ext:") ? b : `${region}:${b}`)
        })
    })

    // Jobs nobody assigned a region to. They exist in every real estate, and
    // they are the reason "unknown" is a lane rather than an error.
    const unassigned: Array<[string, ServiceKind]> = [
        ["legacy-batch", "api"], ["report-worker", "api"], ["archive-db", "database"],
    ]
    unassigned.forEach(([name, kind], i) => {
        services.push({
            id: `unknown:${name}`,
            name,
            kind,
            region: "unknown",
            position: { x: 3 * 620 + 120, y: 90 + (i + 1) * 128 },
        })
    })
    connect("unknown:legacy-batch", "unknown:archive-db")
    connect("unknown:report-worker", "unknown:archive-db")
    // One cross-region dependency, because they always exist and they are the
    // edges nobody remembers until they break.
    connect("unknown:report-worker", "eu-central-1:orders-db")

    // Third parties: observable, not fixable.
    const externals = ["cloudflare", "stripe", "sendgrid", "twilio", "s3"]
    externals.forEach((name, i) => {
        services.push({
            id: `ext:${name}`,
            name,
            kind: "external",
            region: "third-party",
            position: { x: 3 * 620 + 420, y: 90 + i * 128 },
        })
    })

    return { services, connections }
}

const { services, connections } = build()

export const seedServices: Service[] = services
export const seedConnections: Connection[] = connections
