import { useEffect } from "react"
import { useMapStore } from "./store"

const TICK_INTERVAL_MS = 250
const PRUNE_WINDOW_MS = 60_000
const LATENCY_MIN_MS = 50
const LATENCY_MAX_MS = 500


export const useSimulation = () => {
    useEffect(() => {
        const interval = setInterval(() => {
            const { connectionIds, pushEvent, pruneEvents } = useMapStore.getState();
            const randomConnectionId = connectionIds[Math.floor(Math.random() * connectionIds.length)]
            const randomEvent = { timestamp: Date.now(), success: true, latency: Math.floor(Math.random()*(LATENCY_MAX_MS - LATENCY_MIN_MS) + LATENCY_MIN_MS) }
            pushEvent(randomConnectionId, randomEvent)
            pruneEvents(Date.now() - PRUNE_WINDOW_MS)
        }, TICK_INTERVAL_MS)

        return () => {
            clearInterval(interval)
        }
    }, [])
}