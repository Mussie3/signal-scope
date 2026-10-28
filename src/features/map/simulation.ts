import { useEffect } from "react"
import { useMapStore } from "./store"
import { PRUNE_WINDOW_MS } from "./constants"

const TICK_INTERVAL_MS = 250
/**
 * Healthy traffic has to sit clearly BELOW the thresholds it is judged against,
 * not next to them.
 *
 * Baseline latency used to be uniform 50-500ms against a 300ms "slow" line: a
 * mean of 275ms, so any service whose handful of samples drifted high was
 * reported slow, and about half the estate was amber at any moment. Likewise a
 * 5% baseline error rate against a 10% "failing" line flips to red as soon as
 * two of fifteen samples happen to fail.
 *
 * With a healthy service averaging ~110ms and erroring 1% of the time, amber
 * and red mean the scripted incident and nothing else — which is the entire
 * point of showing them.
 */
const LATENCY_MIN_MS = 40
const LATENCY_MAX_MS = 180
const HIGH_LATENCY_MIN_MS = 1500
const HIGH_LATENCY_MAX_MS = 2500
const BASE_ERROR_RATE = 0.01
const ELEVATED_ERROR_RATE = 0.4

const LOOP_MS = 90_000

type IncidentType = "outage" | "errors" | "latency"

type Incident = {
    startMs: number
    endMs: number
    affectedServiceId: string
    type: IncidentType
}

const INCIDENTS: Incident[] = [
    // Ids must match the seed, or an incident silently never fires — the map
    // just looks healthy forever and nobody knows the script is broken.
    { startMs: 30_000, endMs: 50_000, affectedServiceId: "eu-central-1:orders-db", type: "errors" },
    { startMs: 50_000, endMs: 65_000, affectedServiceId: "us-east-1:catalog-cache", type: "outage" },
    { startMs: 65_000, endMs: 80_000, affectedServiceId: "ap-southeast-1:checkout", type: "latency" },
]

const getActiveIncident = (loopT: number): Incident | null =>
    INCIDENTS.find(i => loopT >= i.startMs && loopT < i.endMs) ?? null

const randomBetween = (min: number, max: number) =>
    Math.floor(Math.random() * (max - min) + min)

export const useSimulation = (enabled = true) => {
    useEffect(() => {
        if (!enabled) return

        const startMs = Date.now()
        let cursor = 0

        const interval = setInterval(() => {
            const { connectionsById, connectionIds, pushEvents, pruneEvents } = useMapStore.getState()
            const now = Date.now()
            const loopT = (now - startMs) % LOOP_MS
            const incident = getActiveIncident(loopT)

            const candidates = connectionIds.filter(id => {
                if (incident?.type === "outage") {
                    return connectionsById[id].targetId !== incident.affectedServiceId
                }
                return true
            })

            /**
             * Emit a SLICE of the topology each tick, not a single edge.
             *
             * One event per tick covered a six-node demo, but a real topology
             * has a hundred-odd edges: at 250ms each link would wait twenty
             * seconds between events, sail past the five-second down threshold,
             * and the map would show a system-wide outage that is really just a
             * starved generator.
             *
             * A fifth of the edges per tick means every link is exercised
             * roughly once a second, comfortably inside the window, while still
             * leaving the jitter that makes the map look alive.
             */
            const perTick = Math.max(1, Math.ceil(candidates.length * 0.2))

            /**
             * Round-robin, not a random sample.
             *
             * Sampling a fifth of the edges at random covers a fifth of them
             * per tick on average, but "on average" is not a guarantee: an
             * unlucky edge can go unpicked for twenty-odd ticks, cross the
             * five-second silence threshold, and report its target DOWN. The
             * map then shows an outage the simulation never scripted, which is
             * indistinguishable from a real one and much more confusing.
             *
             * Walking the list in order bounds the gap: every edge is exercised
             * once per ceil(n / perTick) ticks — about 1.25s here — so silence
             * on the map only ever means silence in the script.
             */
            const slice: string[] = []
            for (let i = 0; i < perTick && candidates.length > 0; i++) {
                slice.push(candidates[cursor % candidates.length])
                cursor += 1
            }

            const batch: Array<{ connectionId: string; event: { timestamp: number; success: boolean; latency: number } }> = []
            for (const connectionId of slice) {
                const connection = connectionsById[connectionId]
                if (!connection) continue
                const isAffected = incident?.affectedServiceId === connection.targetId

                const errorRate = isAffected && incident.type === "errors"
                    ? ELEVATED_ERROR_RATE
                    : BASE_ERROR_RATE

                const latency = isAffected && incident.type === "latency"
                    ? randomBetween(HIGH_LATENCY_MIN_MS, HIGH_LATENCY_MAX_MS)
                    : randomBetween(LATENCY_MIN_MS, LATENCY_MAX_MS)

                batch.push({
                    connectionId,
                    event: { timestamp: now, success: Math.random() > errorRate, latency },
                })
            }
            pushEvents(batch)

            pruneEvents(now - PRUNE_WINDOW_MS)
        }, TICK_INTERVAL_MS)

        return () => clearInterval(interval)
    }, [enabled])
}
