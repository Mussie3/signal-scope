import type { Service, Connection, Position } from "./types"
import { EXTERNAL_LANE, compareRegions, regionLabel } from "./regions"

export { EXTERNAL_LANE }

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
/** Advance width per character of a node label at ambient's 15px. */
const AMBIENT_LABEL_CH = 8.6
const LABEL_BREATHING_ROOM = 16
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

/**
 * Storage sits below compute, whatever the call graph says.
 *
 * Depth alone puts a cache that happens to be called early on the same row as
 * the APIs calling it, and a database two rows above another database, so the
 * map reads as an arbitrary scatter of shapes rather than as tiers of a system.
 * Pushing caches below every API, and databases below every cache, gives the
 * horizontal bands people actually expect: edge, services, cache, storage.
 *
 * It only ever pushes a node DOWN, so the guarantee that a caller sits above
 * its callee survives — a database is already at or below everything calling
 * it, and moving it further down cannot break that.
 */
const KIND_FLOOR: Partial<Record<Service["kind"], number>> = { cache: 1, database: 2 }

const bandByKind = (services: Service[], tiers: Record<string, number>): Record<string, number> => {
    let deepestCompute = 0
    for (const s of services) {
        if (s.kind === "external" || KIND_FLOOR[s.kind] !== undefined) continue
        deepestCompute = Math.max(deepestCompute, tiers[s.id] ?? 0)
    }

    const banded = { ...tiers }
    for (const s of services) {
        const floor = KIND_FLOOR[s.kind]
        if (floor === undefined) continue
        banded[s.id] = Math.max(tiers[s.id] ?? 0, deepestCompute + floor)
    }
    return banded
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

    const tiers = bandByKind(services, assignTiers(ownIds, ownEdges))

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

    /**
     * Lane order, with unknown and external always last.
     *
     * Real regions sort by declaration order, NOT by how many services they
     * hold. Headcount order looks sensible until one region gains a service and
     * every lane on the map slides sideways — the person watching has to
     * re-find everything, mid-incident, for no reason.
     */
    const laneKeys = [...laneOf.keys()].sort((a, b) => {
        const rank = (k: string) => (k === EXTERNAL_LANE ? 2 : k === "unknown" ? 1 : 0)
        return rank(a) - rank(b) || compareRegions(a, b)
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

        /**
         * Spacing follows the LABELS, not just the node count.
         *
         * A fixed 112px gap fits a circle and the word "auth" with room to
         * spare, and runs "legacy-batch" straight into "report-worker" — which
         * on a map of fifty identically-shaped nodes is the one channel left
         * for telling them apart. Ambient mode sets the labels at 15px, so the
         * widest name in the lane decides the gap for everything in it.
         */
        const longest = Math.max(...members.map(m => m.name.length))
        const gap = Math.max(NODE_GAP, longest * AMBIENT_LABEL_CH + LABEL_BREATHING_ROOM)
        const widest = Math.max(...[...rows.values()].map((r) => r.length))
        const laneWidth = Math.max(MIN_LANE_W, widest * gap + LANE_PADDING * 2)

        for (const [tier, row] of rows) {
            // Deterministic order within a row, so a node does not hop sideways
            // between frames just because the map data arrived in a new order.
            row.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
            row.forEach((s, i) => {
                const centre = cursorX + laneWidth / 2
                const offset = (i - (row.length - 1) / 2) * gap
                positions[s.id] = { x: centre + offset, y: TOP_PADDING + tier * TIER_GAP }
            })
        }

        lanes.push({
            key,
            label: regionLabel(key),
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
