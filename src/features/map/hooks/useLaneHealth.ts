import { useShallow } from "zustand/shallow"
import { useFilterStore } from "@/shared/store/filter.store"
import { RANGE_TO_MS } from "@/shared/types/filter"
import { useMapStore } from "../store"
import { deriveServiceStatus } from "../status"
import { usePlaybackTime } from "./usePlaybackTime"
import { EXTERNAL_LANE } from "../layout"
import type { ServiceStatus } from "../types"

/** How loudly a state should speak when summarising a group. */
const SEVERITY: Record<ServiceStatus, number> = {
    down: 4,
    failing: 3,
    slow: 2,
    no_data: 1,
    healthy: 0,
}

export const worstOf = (statuses: ServiceStatus[]): ServiceStatus =>
    statuses.reduce<ServiceStatus>((a, b) => (SEVERITY[b] > SEVERITY[a] ? b : a), "healthy")

/**
 * Worst status per lane, for the lane headers.
 *
 * Deliberately one store read rather than a useServiceStatus per service: hooks
 * cannot be called in a loop whose length depends on data, and a discovered
 * topology's length is exactly that. Deriving in a single selector also means
 * one subscription for the whole header row instead of one per node.
 */
export const useLaneHealth = (): Record<string, ServiceStatus> => {
    const range = useFilterStore(s => s.range)
    const now = usePlaybackTime()
    const rangeMs = RANGE_TO_MS[range]

    return useMapStore(
        useShallow(state => {
            const byLane: Record<string, ServiceStatus[]> = {}

            for (const id of state.serviceIds) {
                const service = state.servicesById[id]
                if (!service) continue
                const lane = service.kind === "external" ? EXTERNAL_LANE : service.region || "unknown"

                const incoming = state.connectionIds
                    .map(cid => state.connectionsById[cid])
                    .filter(c => c && c.targetId === id)

                ;(byLane[lane] ??= []).push(deriveServiceStatus(incoming, now, rangeMs))
            }

            const out: Record<string, ServiceStatus> = {}
            for (const [lane, statuses] of Object.entries(byLane)) out[lane] = worstOf(statuses)
            return out
        }),
    )
}
