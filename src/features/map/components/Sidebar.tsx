import { useFilterStore } from "@/shared/store/filter.store"
import { useThemeStore } from "@/shared/store/theme.store"
import { useFilteredServices } from "../hooks/useFilteredServices"
import { useMapStore } from "../store"
import ServiceListItem from "./ServiceListItem"

const Sidebar = () => {
    const filteredServices = useFilteredServices()
    const totalServices = useMapStore(s => s.serviceIds.length)
    const search = useFilterStore(s => s.search)
    const region = useFilterStore(s => s.region)
    const theme = useThemeStore(s => s.theme)

    const isDark = theme === "dark"
    const containerStyles = isDark
        ? "bg-[#0a0a0a] border-white/10 text-white"
        : "bg-white border-black/10 text-black"
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
                    {filteredServices.length !== totalServices && ` / ${totalServices}`}
                </span>
            </div>
            <ul className="px-2 py-2 space-y-0.5">
                {filteredServices.length === 0 && (
                    <li className="px-3 py-8 text-sm opacity-50 text-center">
                        No services match
                        {search && (
                            <div className="font-medium mt-1 truncate">"{search}"</div>
                        )}
                        {region !== "All Region" && (
                            <div className="font-medium mt-1">in {region}</div>
                        )}
                    </li>
                )}
                {filteredServices.map(service => (
                    <li key={service.id}>
                        <ServiceListItem service={service} isDark={isDark} />
                    </li>
                ))}
            </ul>
        </aside>
    )
}

export default Sidebar
