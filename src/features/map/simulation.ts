import { useEffect } from "react"
import { useMapStore } from "./store"
import { PRUNE_WINDOW_MS } from "./constants"

const TICK_INTERVAL_MS = 250
const LATENCY_MIN_MS = 50
const LATENCY_MAX_MS = 500
const HIGH_LATENCY_MIN_MS = 1500
const HIGH_LATENCY_MAX_MS = 2500
const BASE_ERROR_RATE = 0.05
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
    { startMs: 30_000, endMs: 50_000, affectedServiceId: "auth-api", type: "errors" },
    { startMs: 50_000, endMs: 65_000, affectedServiceId: "product-cache", type: "outage" },
    { startMs: 65_000, endMs: 80_000, affectedServiceId: "product-db", type: "latency" },
]

const getActiveIncident = (loopT: number): Incident | null =>
    INCIDENTS.find(i => loopT >= i.startMs && loopT < i.endMs) ?? null

const randomBetween = (min: number, max: number) =>
    Math.floor(Math.random() * (max - min) + min)

export const useSimulation = (enabled = true) => {
    useEffect(() => {
        if (!enabled) return

        const startMs = Date.now()

        const interval = setInterval(() => {
            const { connectionsById, connectionIds, pushEvent, pruneEvents } = useMapStore.getState()
            const now = Date.now()
            const loopT = (now - startMs) % LOOP_MS
            const incident = getActiveIncident(loopT)

            const candidates = connectionIds.filter(id => {
                if (incident?.type === "outage") {
                    return connectionsById[id].targetId !== incident.affectedServiceId
                }
                return true
            })

            if (candidates.length > 0) {
                const connectionId = candidates[Math.floor(Math.random() * candidates.length)]
                const connection = connectionsById[connectionId]
                const isAffected = incident?.affectedServiceId === connection.targetId

                const errorRate = isAffected && incident.type === "errors"
                    ? ELEVATED_ERROR_RATE
                    : BASE_ERROR_RATE

                const latency = isAffected && incident.type === "latency"
                    ? randomBetween(HIGH_LATENCY_MIN_MS, HIGH_LATENCY_MAX_MS)
                    : randomBetween(LATENCY_MIN_MS, LATENCY_MAX_MS)

                pushEvent(connectionId, {
                    timestamp: now,
                    success: Math.random() > errorRate,
                    latency,
                })
            }

            pruneEvents(now - PRUNE_WINDOW_MS)
        }, TICK_INTERVAL_MS)

        return () => clearInterval(interval)
    }, [enabled])
}
