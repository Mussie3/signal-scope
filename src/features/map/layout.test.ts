// Layered layout tests.
//
// Run: npx deno@2 test --no-check src/features/map/layout.test.ts
//
// The topology is DISCOVERED, so this code meets whatever the traces describe:
// cycles, orphans, a single node, a hundred. The force layout it replaces could
// not produce a wrong answer, only a slow or ugly one — this can, so it is
// tested rather than eyeballed.

import { computeLayout, EXTERNAL_LANE } from "./layout.ts"

const eq = <T>(actual: T, expected: T, what: string) => {
    if (actual !== expected) throw new Error(`${what}: expected ${String(expected)}, got ${String(actual)}`)
}
const ok = (cond: boolean, what: string) => {
    if (!cond) throw new Error(what)
}

// deno-lint-ignore no-explicit-any
const svc = (id: string, kind: string, region = "eu-central-1"): any =>
    ({ id, key: id, name: id, kind, region, position: { x: 0, y: 0 } })
// deno-lint-ignore no-explicit-any
const conn = (from: string, to: string): any =>
    ({ id: `${from}>${to}`, sourceId: from, targetId: to, buffer: [] })

Deno.test("callers sit above callees", () => {
    // Asserted as an ordering, not as fixed tier numbers: storage is banded
    // below compute, so a database's exact tier depends on how deep the
    // compute graph above it runs. What must never change is the direction.
    const { tiers } = computeLayout(
        [svc("web", "frontend"), svc("api", "api"), svc("db", "database")],
        [conn("web", "api"), conn("api", "db")],
    )
    eq(tiers["web"], 0, "web tier")
    ok(tiers["api"] > tiers["web"], "api sits below web")
    ok(tiers["db"] > tiers["api"], "db sits below api")
})

Deno.test("depth is the LONGEST path, not the shortest", () => {
    // web -> api -> db, and also web -> db directly. db must sit below api, or
    // the direct edge would be drawn travelling upwards.
    const { tiers } = computeLayout(
        [svc("web", "frontend"), svc("api", "api"), svc("db", "database")],
        [conn("web", "api"), conn("api", "db"), conn("web", "db")],
    )
    ok(tiers["db"] > tiers["api"], "db should take the deeper path")
})

Deno.test("storage is banded below compute, whatever the call graph says", () => {
    // notify is called by orders, so it sits deep in the compute graph. The
    // cache and the database are called from the shallow end, so depth alone
    // would leave them level with the APIs above them. Both must still land in
    // their own bands underneath everything that computes.
    const { tiers } = computeLayout(
        [
            svc("web", "frontend"), svc("orders", "api"), svc("notify", "api"),
            svc("cache", "cache"), svc("db", "database"),
        ],
        [conn("web", "orders"), conn("orders", "notify"), conn("web", "cache"), conn("web", "db")],
    )
    ok(tiers["cache"] > tiers["notify"], "cache sits below the deepest api")
    ok(tiers["db"] > tiers["cache"], "storage sits below cache")
})

Deno.test("a cycle does not hang, and every node still gets a tier", () => {
    // Two services calling each other is normal in real traces, and a naive
    // longest-path walk never terminates on it.
    const { tiers, positions } = computeLayout(
        [svc("a", "api"), svc("b", "api"), svc("c", "api")],
        [conn("a", "b"), conn("b", "c"), conn("c", "a")],
    )
    for (const id of ["a", "b", "c"]) {
        ok(Number.isFinite(tiers[id]), `${id} has a finite tier`)
        ok(positions[id] !== undefined, `${id} was positioned`)
    }
})

Deno.test("a self-edge is survivable", () => {
    const { tiers, positions } = computeLayout([svc("a", "api")], [conn("a", "a")])
    ok(Number.isFinite(tiers["a"]), "self-looping node has a tier")
    ok(positions["a"] !== undefined, "self-looping node is positioned")
})

Deno.test("third parties are laned separately and do not deepen your graph", () => {
    // A CDN calls your frontend. Counting that as depth would push every one of
    // your services down a level and leave the top tier occupied by Cloudflare.
    const { tiers, lanes } = computeLayout(
        [svc("cdn", "external", "unknown"), svc("web", "frontend"), svc("api", "api")],
        [conn("cdn", "web"), conn("web", "api")],
    )
    eq(tiers["web"], 0, "your frontend stays at the top")
    eq(tiers["api"], 1, "api is one below")
    ok(lanes.some((l) => l.key === EXTERNAL_LANE), "an external lane exists")
    ok(lanes[lanes.length - 1].key === EXTERNAL_LANE, "externals are laned last")
})

Deno.test("lane order follows the declared regions, not headcount", () => {
    // us-east-1 holds three services to eu-central-1's one, so an order driven
    // by headcount would put it first. It must not: lanes that reshuffle when a
    // region gains a service force everyone to re-find the whole map.
    const { lanes } = computeLayout(
        [
            svc("a", "api", "us-east-1"), svc("b", "api", "us-east-1"), svc("c", "api", "us-east-1"),
            svc("d", "api", "eu-central-1"),
            svc("e", "api", "unknown"),
            svc("f", "external", "unknown"),
        ],
        [],
    )
    eq(lanes.map((l) => l.key).join(","), "eu-central-1,us-east-1,unknown,__external__", "lane order")
})

Deno.test("an undeclared region still gets a stable lane, after the known ones", () => {
    const { lanes } = computeLayout(
        [
            svc("a", "api", "ap-southeast-1"),
            svc("b", "api", "mars-north-1"),
            svc("c", "api", "eu-central-1"),
        ],
        [],
    )
    eq(lanes.map((l) => l.key).join(","), "eu-central-1,ap-southeast-1,mars-north-1", "lane order")
})

Deno.test("lanes do not overlap", () => {
    const { lanes } = computeLayout(
        [svc("a", "api", "eu"), svc("b", "api", "us"), svc("c", "api", "ap")],
        [],
    )
    for (let i = 1; i < lanes.length; i++) {
        ok(lanes[i].x >= lanes[i - 1].x + lanes[i - 1].width, `lane ${i} starts after lane ${i - 1} ends`)
    }
})

Deno.test("nodes land inside their own lane", () => {
    const services = [
        svc("a", "api", "eu"), svc("b", "api", "eu"),
        svc("c", "api", "us"),
        svc("x", "external", "unknown"),
    ]
    const { lanes, positions } = computeLayout(services, [])
    const laneByKey = Object.fromEntries(lanes.map((l) => [l.key, l]))
    for (const s of services) {
        const lane = laneByKey[s.kind === "external" ? EXTERNAL_LANE : s.region]
        const p = positions[s.id]
        ok(p.x >= lane.x && p.x <= lane.x + lane.width, `${s.id} is inside lane ${lane.key}`)
    }
})

Deno.test("an orphan with no edges is still placed", () => {
    const { tiers, positions } = computeLayout([svc("lonely", "api")], [])
    eq(tiers["lonely"], 0, "orphan tier")
    ok(positions["lonely"] !== undefined, "orphan positioned")
})

Deno.test("an edge naming a service we do not have is ignored", () => {
    const { positions } = computeLayout([svc("a", "api")], [conn("a", "ghost"), conn("ghost", "a")])
    ok(positions["a"] !== undefined, "real node survives a dangling edge")
    ok(positions["ghost"] === undefined, "phantom node is not invented")
})

Deno.test("empty input does not throw", () => {
    const r = computeLayout([], [])
    eq(r.width, 0, "width")
    eq(r.lanes.length, 0, "lanes")
})

Deno.test("layout is deterministic across input order", () => {
    const a = [svc("x", "api"), svc("y", "api"), svc("z", "api")]
    const b = [svc("z", "api"), svc("y", "api"), svc("x", "api")]
    const edges = [conn("x", "y")]
    const first = computeLayout(a, edges).positions
    const second = computeLayout(b, edges).positions
    for (const id of ["x", "y", "z"]) {
        eq(second[id].x, first[id].x, `${id} x is stable regardless of input order`)
        eq(second[id].y, first[id].y, `${id} y is stable`)
    }
})

Deno.test("scales to a realistic estate without pathological geometry", () => {
    // 120 services, tiered, with cross-links — roughly what a real instrumented
    // system produces, and well past where the force layout became unusable.
    // deno-lint-ignore no-explicit-any
    const services: any[] = []
    // deno-lint-ignore no-explicit-any
    const edges: any[] = []
    const regions = ["eu-central-1", "us-east-1", "ap-southeast-1"]
    for (let r = 0; r < 3; r++) {
        for (let i = 0; i < 40; i++) {
            const kind = i < 4 ? "frontend" : i < 28 ? "api" : i < 34 ? "cache" : "database"
            services.push(svc(`r${r}-s${i}`, kind, regions[r]))
            if (i >= 4) edges.push(conn(`r${r}-s${Math.floor((i - 4) / 3)}`, `r${r}-s${i}`))
        }
    }
    const t0 = performance.now()
    const { positions, lanes, width, height, tiers } = computeLayout(services, edges)
    const ms = performance.now() - t0

    eq(Object.keys(positions).length, 120, "every service positioned")
    eq(lanes.length, 3, "three lanes")
    ok(width > 0 && height > 0, "canvas has size")
    ok(Math.max(...Object.values(tiers)) < 40, "tiers do not degenerate into a staircase")
    ok(ms < 50, `layout should be fast, took ${ms.toFixed(1)}ms`)
    console.log(`  120 services laid out in ${ms.toFixed(2)}ms (force layout was ~100ms at this size)`)
})
