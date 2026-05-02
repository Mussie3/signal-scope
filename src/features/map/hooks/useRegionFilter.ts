import { useFilterStore } from "@/shared/store/filter.store"
import type { Service } from "../types"

export const useIsServiceInRegion = (service: Service): boolean => {
    const region = useFilterStore(s => s.region)
    return region === "All Region" || service.region === region
}

export const useIsConnectionInRegion = (
    source: Service,
    target: Service,
): boolean => {
    const region = useFilterStore(s => s.region)
    if (region === "All Region") return true
    return source.region === region || target.region === region
}
