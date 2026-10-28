import type { Service, Connection, Position } from "./types"

/**
 * Layered layout: lanes by region, tiers by dependency depth.
 *
 * Replaces the force-directed layout, for two reasons.
 *
 * Readability. A force graph of six nodes is charming and a force graph of fifty
 * is spaghetti, and a derived topology's size is not under our control — it is
 * however many services happen to be instrumented. Layering by dependency depth
 * puts callers above callees, so the direction traffic flows is the direction
 * the eye travels, and a failure cascades visibly downward.
 *
 * Cost. The force layout was O(n^2) per iteration across 400 iterations on the
 * main thread: ~11ms at six nodes, 311ms at two hundred, 1.3s at four hundred.
 * This is O(V + E) once.
 */

const LANE_GAP = 48
const LANE_PADDING = 28
const NODE_GAP = 112
const TIER_GAP = 128
const TOP_PADDING = 76
const MIN_LANE_W = 220

export interface Lane {
    /** Region id, or EXTERNAL_LANE for third parties. */
    key: string
    label: string
    x: number
    width: number
}

export interface LayoutResult {
    positions: Record<string, Position>
    lanes: Lane[]
    width: number
    height: number
    /** Tier index per service, so edges can tell "downward" from "sideways". */
    tiers: Record<string, number>
}

export const EXTERNAL_LANE = "__external__"

/**
 * Third parties are laned separately rather than by region.
 *
 * Partly because "which AWS region is Stripe in" is not a question anyone asks,
 * and partly because they break tiering: a CDN calls your frontend, so counting
 * it as a dependency depth would push every one of your own services down a
 * level and leave the top tier occupied by somebody else's infrastructure.
 */
const laneKeyFor = (s: Service): string => (s.kind === "external" ? EXTERNAL_LANE : s.region || "unknown")

/**
 * Longest-path layering: a node sits one level below its deepest caller.
 *
 * Cycles are real in traces — two services that call each other produce one, and
 * so does a retry path — and a naive longest-path walk never terminates on them.
 * Back edges found during the depth-first pass are dropped for layering only;
 * they are still drawn, they just do not get a vote on depth.
 */
const assignTiers = (ids: string[], edges: Array<[string, string]>): Record<string, number> => {
    const out = new Map<string, string[]>()
    const indegree = new Map<string, number>()
    for (const id of ids) {
        out.set(id, [])
        indegree.set(id, 0)
    }

    // Drop back edges with an iterative DFS. Recursion would blow the stack on a
    // deep estate, and "deep" here is attacker-ish input: whatever the traces say.
    const WHITE = 0, GREY = 1, BLACK = 2
    const colour = new Map(ids.map((id) => [id, WHITE]))
    const adjacency = new Map<string, string[]>(ids.map((id) => [id, []]))
    for (const [from, to] of edges) {
        if (adjacency.has(from) && adjacency.has(to)) adjacency.get(from)!.push(to)
    }

    const keep: Array<[string, string]> = []
    for (const root of ids) {
        if (colour.get(root) !== WHITE) continue
        const stack: Array<{ id: string; next: number }> = [{ id: root, next: 0 }]
        colour.set(root, GREY)
        while (stack.length) {
            const frame = stack[stack.length - 1]
            const neighbours = adjacency.get(frame.id)!
            if (frame.next >= neighbours.length) {
                colour.set(frame.id, BLACK)
                stack.pop()
                continue
            }
            const next = neighbours[frame.next++]
            const c = colour.get(next)
            if (c === GREY) continue // back edge: part of a cycle, ignore for depth
            keep.push([frame.id, next])
            if (c === WHITE) {
                colour.set(next, GREY)
                stack.push({ id: next, next: 0 })
            }
        }
    }

    for (const [from, to] of keep) {
        out.get(from)!.push(to)
        indegree.set(to, (indegree.get(to) ?? 0) + 1)
    }

    const tier: Record<string, number> = {}
    const queue: string[] = []
    for (const id of ids) {
        tier[id] = 0
        if ((indegree.get(id) ?? 0) === 0) queue.push(id)
    }

    while (queue.length) {
        const id = queue.shift()!
        for (const next of out.get(id)!) {
            if (tier[next] < tier[id] + 1) tier[next] = tier[id] + 1
            indegree.set(next, indegree.get(next)! - 1)
            if (indegree.get(next) === 0) queue.push(next)
        }
    }
    return tier
}

export const computeLayout = (services: Service[], connections: Connection[]): LayoutResult => {
    if (services.length === 0) {
        return { positions: {}, lanes: [], width: 0, height: 0, tiers: {} }
    }

    const ownIds = services.filter((s) => s.kind !== "external").map((s) => s.id)
    const ownSet = new Set(ownIds)

    // Only edges between your own services inform depth; see laneKeyFor.
    const ownEdges = connections
        .filter((c) => ownSet.has(c.sourceId) && ownSet.has(c.targetId))
        .map((c) => [c.sourceId, c.targetId] as [string, string])

    const tiers = assignTiers(ownIds, ownEdges)

    // Externals are stacked in their own lane in a stable order rather than
    // tiered, so the column does not reshuffle as traffic moves.
    const externals = services
        .filter((s) => s.kind === "external")
        .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
    externals.forEach((s, i) => { tiers[s.id] = i })

    // Group into lanes, then into tiers within each lane.
    const laneOf = new Map<string, Service[]>()
    for (const s of services) {
        const key = laneKeyFor(s)
        if (!laneOf.has(key)) laneOf.set(key, [])
        laneOf.get(key)!.push(s)
    }

    // Busiest region first; unknown and external always last, because they are
    // the lanes you look at least.
    const laneKeys = [...laneOf.keys()].sort((a, b) => {
        const rank = (k: string) => (k === EXTERNAL_LANE ? 2 : k === "unknown" ? 1 : 0)
        if (rank(a) !== rank(b)) return rank(a) - rank(b)
        const diff = laneOf.get(b)!.length - laneOf.get(a)!.length
        return diff !== 0 ? diff : a.localeCompare(b)
    })

    const positions: Record<string, Position> = {}
    const lanes: Lane[] = []
    let cursorX = 0
    let maxTier = 0

    for (const key of laneKeys) {
        const members = laneOf.get(key)!
        const rows = new Map<number, Service[]>()
        for (const s of members) {
            const t = tiers[s.id] ?? 0
            if (!rows.has(t)) rows.set(t, [])
            rows.get(t)!.push(s)
            if (t > maxTier) maxTier = t
        }

        const widest = Math.max(...[...rows.values()].map((r) => r.length))
        const laneWidth = Math.max(MIN_LANE_W, widest * NODE_GAP + LANE_PADDING * 2)

        for (const [tier, row] of rows) {
            // Deterministic order within a row, so a node does not hop sideways
            // between frames just because the map data arrived in a new order.
            row.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
            row.forEach((s, i) => {
                const centre = cursorX + laneWidth / 2
                const offset = (i - (row.length - 1) / 2) * NODE_GAP
                positions[s.id] = { x: centre + offset, y: TOP_PADDING + tier * TIER_GAP }
            })
        }

        lanes.push({
            key,
            label: key === EXTERNAL_LANE ? "Outside your system" : key,
            x: cursorX,
            width: laneWidth,
        })
        cursorX += laneWidth + LANE_GAP
    }

    // Externals can out-number the deepest tier; the canvas has to fit both.
    const deepest = Math.max(maxTier, externals.length ? externals.length - 1 : 0)

    return {
        positions,
        lanes,
        width: Math.max(0, cursorX - LANE_GAP),
        height: TOP_PADDING * 2 + deepest * TIER_GAP,
        tiers,
    }
}

/** Kept for the manual/auto toggle: the seeded positions a project ships with. */
export const seededPositions = (services: Service[]): Record<string, Position> =>
    Object.fromEntries(services.map((s) => [s.id, s.position]))
