import { useShallow } from "zustand/shallow"
import { useMapStore } from "./store"
import { useNow } from "@/shared/hooks/useNow"
import { useThemeStore } from "@/shared/store/theme.store"
import { useFilterStore } from "@/shared/store/filter.store"
import { deriveServiceStatus } from "./status"
import { STATUS_COLORS } from "./constants"
import ApiIcon from "@/shared/ui/icons/ApiIcon"
import DatabaseIcon from "@/shared/ui/icons/DatabaseIcon"
import CacheIcon from "@/shared/ui/icons/CacheIcon"
import type { ServiceKind } from "./types"

const KIND_ICON: Record<ServiceKind, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
    api: ApiIcon,
    database: DatabaseIcon,
    cache: CacheIcon,
}

const Sidebar = () => {
    const services = useMapStore(useShallow(s => s.serviceIds.map(id => s.servicesById[id])))
    const connections = useMapStore(useShallow(s => s.connectionIds.map(id => s.connectionsById[id])))
    const selectedServiceId = useMapStore(s => s.selectedServiceId)
    const selectService = useMapStore(s => s.selectService)
    const theme = useThemeStore(s => s.theme)
    const search = useFilterStore(s => s.search)
    const now = useNow()

    const query = search.trim().toLowerCase()
    const filteredServices = query
        ? services.filter(s =>
            s.name.toLowerCase().includes(query) || s.kind.includes(query),
        )
        : services

    const isDark = theme === "dark"
    const containerStyles = isDark
        ? "bg-[#0a0a0a] border-white/10 text-white"
        : "bg-[#fafafa] border-black/10 text-black"
    const itemBase = isDark
        ? "hover:bg-white/[0.06]"
        : "hover:bg-black/[0.04]"
    const itemSelected = isDark
        ? "bg-white/[0.10]"
        : "bg-black/[0.06]"

    return (
        <aside className={`w-64 flex-none h-full border-r overflow-y-auto ${containerStyles}`}>
            <div className="px-4 pt-4 pb-2 text-xs uppercase tracking-wider opacity-60">
                Services
            </div>
            <ul className="px-2 pb-4 space-y-1">
                {filteredServices.length === 0 && (
                    <li className="px-3 py-6 text-sm opacity-50 text-center">
                        No services match "{search}"
                    </li>
                )}
                {filteredServices.map(service => {
                    const incoming = connections.filter(c => c.targetId === service.id)
                    const status = deriveServiceStatus(incoming, now)
                    const color = STATUS_COLORS[status]
                    const Icon = KIND_ICON[service.kind]
                    const isSelected = selectedServiceId === service.id
                    return (
                        <li key={service.id}>
                            <button
                                type="button"
                                onClick={() => selectService(service.id)}
                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${itemBase} ${isSelected ? itemSelected : ""}`}
                            >
                                <span
                                    className="inline-block w-2 h-2 rounded-full flex-none"
                                    style={{ background: color }}
                                />
                                <Icon className="w-4 h-4 flex-none opacity-80" />
                                <span className="flex-1 text-sm truncate">{service.name}</span>
                                <span className="text-[10px] uppercase tracking-wider opacity-50">
                                    {service.kind}
                                </span>
                            </button>
                        </li>
                    )
                })}
            </ul>
        </aside>
    )
}

export default Sidebar
