import { useShallow } from "zustand/shallow"
import { useFilterStore } from "@/shared/store/filter.store"
import { useMapStore } from "../store"
import type { Service } from "../types"

export const useFilteredServices = (): Service[] => {
    const services = useMapStore(useShallow(s =>
        s.serviceIds.map(id => s.servicesById[id]),
    ))
    const region = useFilterStore(s => s.region)
    const search = useFilterStore(s => s.search)

    const query = search.trim().toLowerCase()
    return services.filter(service => {
        if (region !== "All Region" && service.region !== region) return false
        if (query) {
            const inName = service.name.toLowerCase().includes(query)
            const inKind = service.kind.includes(query)
            if (!inName && !inKind) return false
        }
        return true
    })
}
