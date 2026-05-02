import { useShallow } from "zustand/shallow"
import { useMapStore } from "./store"
import { useNow } from "@/shared/hooks/useNow"
import { useThemeStore } from "@/shared/store/theme.store"
import { useFilterStore } from "@/shared/store/filter.store"
import { deriveServiceStatus } from "./status"
import { STATUS_COLORS } from "./constants"
import { RANGE_TO_MS } from "@/shared/types/filter"
import ApiIcon from "@/shared/ui/icons/ApiIcon"
import DatabaseIcon from "@/shared/ui/icons/DatabaseIcon"
import CacheIcon from "@/shared/ui/icons/CacheIcon"
import type { ServiceKind, ServiceStatus } from "./types"

const KIND_ICON: Record<ServiceKind, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
    api: ApiIcon,
    database: DatabaseIcon,
    cache: CacheIcon,
}

const STATUS_LABEL: Record<ServiceStatus, string> = {
    healthy: "Healthy",
    slow: "Slow",
    failing: "Failing",
    down: "Down",
    no_data: "No data",
}

const Sidebar = () => {
    const services = useMapStore(useShallow(s => s.serviceIds.map(id => s.servicesById[id])))
    const connections = useMapStore(useShallow(s => s.connectionIds.map(id => s.connectionsById[id])))
    const selectedServiceId = useMapStore(s => s.selectedServiceId)
    const selectService = useMapStore(s => s.selectService)
    const theme = useThemeStore(s => s.theme)
    const search = useFilterStore(s => s.search)
    const region = useFilterStore(s => s.region)
    const range = useFilterStore(s => s.range)
    const now = useNow()

    const rangeMs = RANGE_TO_MS[range]
    const query = search.trim().toLowerCase()

    const filteredServices = services.filter(s => {
        if (region !== "All Region" && s.region !== region) return false
        if (query && !s.name.toLowerCase().includes(query) && !s.kind.includes(query)) return false
        return true
    })

    const isDark = theme === "dark"
    const containerStyles = isDark
        ? "bg-[#0a0a0a] border-white/10 text-white"
        : "bg-white border-black/10 text-black"
    const itemBase = isDark
        ? "hover:bg-white/[0.05]"
        : "hover:bg-black/[0.04]"
    const itemSelected = isDark
        ? "bg-white/[0.10] hover:bg-white/[0.10]"
        : "bg-black/[0.06] hover:bg-black/[0.06]"
    const countBadge = isDark
        ? "bg-white/[0.08] text-white/80"
        : "bg-black/[0.05] text-black/70"
    const dividerColor = isDark ? "border-white/[0.06]" : "border-black/[0.04]"
    const headerBg = isDark ? "bg-[#0a0a0a]/90" : "bg-white/90"

    return (
        <aside className={`w-64 flex-none h-full border-r overflow-y-auto ${containerStyles}`}>
            <div className={`flex items-center justify-between px-4 pt-5 pb-3 border-b ${dividerColor} sticky top-0 backdrop-blur-md ${headerBg}`}>
                <h2 className="text-xs uppercase tracking-[0.12em] font-semibold opacity-70">
                    Services
                </h2>
                <span className={`text-[11px] tabular-nums px-2 py-0.5 rounded-md ${countBadge}`}>
                    {filteredServices.length}
                    {filteredServices.length !== services.length && ` / ${services.length}`}
                </span>
            </div>
            <ul className="px-2 py-2 space-y-0.5">
                {filteredServices.length === 0 && (
                    <li className="px-3 py-8 text-sm opacity-50 text-center">
                        No services match
                        {query && (
                            <div className="font-medium mt-1 truncate">"{search}"</div>
                        )}
                        {region !== "All Region" && (
                            <div className="font-medium mt-1">in {region}</div>
                        )}
                    </li>
                )}
                {filteredServices.map(service => {
                    const incoming = connections.filter(c => c.targetId === service.id)
                    const status = deriveServiceStatus(incoming, now, rangeMs)
                    const color = STATUS_COLORS[status]
                    const Icon = KIND_ICON[service.kind]
                    const isSelected = selectedServiceId === service.id
                    return (
                        <li key={service.id}>
                            <button
                                type="button"
                                onClick={() => selectService(service.id)}
                                className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${itemBase} ${isSelected ? itemSelected : ""}`}
                            >
                                <span className="relative flex-none">
                                    <span
                                        className="block w-2 h-2 rounded-full"
                                        style={{ background: color }}
                                    />
                                    <span
                                        className="absolute inset-0 w-2 h-2 rounded-full animate-ping opacity-50"
                                        style={{ background: color, animationDuration: "2s" }}
                                    />
                                </span>
                                <Icon className="w-4 h-4 flex-none opacity-70" />
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium truncate">{service.name}</div>
                                    <div className="text-[10px] uppercase tracking-wider opacity-50 mt-0.5">
                                        {service.region} · {STATUS_LABEL[status]}
                                    </div>
                                </div>
                            </button>
                        </li>
                    )
                })}
            </ul>
        </aside>
    )
}

export default Sidebar
