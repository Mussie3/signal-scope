import { useShallow } from "zustand/shallow"
import { useFilterStore } from "@/shared/store/filter.store"
import { ALL_REGIONS } from "@/shared/types/filter"
import { useMapStore } from "../store"
import type { Service } from "../types"

export const useIsServiceInRegion = (service: Service): boolean => {
    const region = useFilterStore(s => s.region)
    return region === ALL_REGIONS || service.region === region
}

export const useIsConnectionInRegion = (
    source: Service,
    target: Service,
): boolean => {
    const region = useFilterStore(s => s.region)
    if (region === ALL_REGIONS) return true
    return source.region === region || target.region === region
}

/**
 * The regions actually present in the current topology.
 *
 * Derived rather than listed, because a topology discovered from traces reports
 * whatever regions its services declared. A hardcoded list offers options that
 * match nothing and omits the ones that exist — so picking a region hid every
 * service instead of filtering to it.
 *
 * useShallow keeps this from re-rendering on every store change: the array is
 * rebuilt each call, so only a change in its contents should count.
 */
export const useAvailableRegions = (): string[] =>
    useMapStore(
        useShallow(state => {
            const seen = new Set<string>()
            for (const id of state.serviceIds) {
                const region = state.servicesById[id]?.region
                if (region) seen.add(region)
            }
            return [ALL_REGIONS, ...[...seen].sort()]
        }),
    )
