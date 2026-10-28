import { useMemo } from "react"
import { useShallow } from "zustand/shallow"
import { useFilterStore } from "@/shared/store/filter.store"
import { RANGE_TO_MS } from "@/shared/types/filter"
import { useMapStore } from "../store"
import { deriveServiceStatus } from "../status"
import { usePlaybackTime } from "./usePlaybackTime"
import type { ServiceStatus } from "../types"

export interface BlastRadius {
    /** Services that are themselves unhealthy. */
    unhealthy: string[]
    /** Everything that transitively depends on one of them. */
    affected: Set<string>
    /** unhealthy + affected: what incident mode keeps lit. */
    focus: Set<string>
    statusById: Record<string, ServiceStatus>
}

/**
 * What else is in trouble because this is.
 *
 * Walks UPSTREAM from each failing service — the things that call it, and the
 * things that call those. A database falling over does not hurt the disk it
 * sits on, it hurts everyone waiting on a query.
 *
 * External services are deliberately excluded. You cannot fix Stripe, and
 * listing a third party among the things you need to deal with turns a blast
 * radius into noise at exactly the moment attention is scarcest.
 *
 * ---------------------------------------------------------------------------
 * On the shape of this hook
 *
 * The derivation happens in useMemo rather than inside the store selector, and
 * that is not stylistic. useShallow compares ONE level deep, so a selector
 * returning fresh arrays, Sets or objects produces a value that never compares
 * equal to the last one — React re-renders, the selector runs again, and the
 * component loops until React gives up with "Maximum update depth exceeded".
 *
 * So the subscriptions return only shallow-comparable things: flat string
 * arrays, or a raw store reference that genuinely changes when the data does.
 */
export const useBlastRadius = (): BlastRadius => {
    const range = useFilterStore(s => s.range)
    const now = usePlaybackTime()
    const rangeMs = RANGE_TO_MS[range]

    const serviceIds = useMapStore(useShallow(s => s.serviceIds))
    const connectionIds = useMapStore(useShallow(s => s.connectionIds))
    const servicesById = useMapStore(s => s.servicesById)
    const connectionsById = useMapStore(s => s.connectionsById)

    return useMemo(() => {
        const statusById: Record<string, ServiceStatus> = {}
        const unhealthy: string[] = []

        // Callers of each service, built once rather than per lookup.
        const callersOf = new Map<string, string[]>()
        for (const cid of connectionIds) {
            const c = connectionsById[cid]
            if (!c) continue
            const callers = callersOf.get(c.targetId)
            if (callers) callers.push(c.sourceId)
            else callersOf.set(c.targetId, [c.sourceId])
        }

        for (const id of serviceIds) {
            const incoming = connectionIds
                .map(cid => connectionsById[cid])
                .filter(c => c && c.targetId === id)
            const status = deriveServiceStatus(incoming, now, rangeMs)
            statusById[id] = status
            // "No data" is not a failure — it usually means nothing is calling
            // this yet. Treating it as one would light up every idle service.
            if (status === "failing" || status === "down" || status === "slow") unhealthy.push(id)
        }

        const unhealthySet = new Set(unhealthy)
        const affected = new Set<string>()
        const stack = [...unhealthy]
        while (stack.length) {
            const id = stack.pop()!
            for (const caller of callersOf.get(id) ?? []) {
                const service = servicesById[caller]
                if (!service || service.kind === "external") continue
                if (affected.has(caller) || unhealthySet.has(caller)) continue
                affected.add(caller)
                stack.push(caller)
            }
        }

        return { unhealthy, affected, focus: new Set([...unhealthy, ...affected]), statusById }
    }, [serviceIds, connectionIds, servicesById, connectionsById, now, rangeMs])
}
