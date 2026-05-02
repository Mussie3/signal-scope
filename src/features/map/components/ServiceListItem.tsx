import { useMapStore } from "../store"
import { useServiceStatus } from "../hooks/useServiceStatus"
import { KIND_ICON } from "../kinds"
import type { Service } from "../types"
import StatusDot from "./StatusDot"

type Props = {
    service: Service
    isDark: boolean
}

const ServiceListItem = ({ service, isDark }: Props) => {
    const { color, label } = useServiceStatus(service.id)
    const selectedServiceId = useMapStore(s => s.selectedServiceId)
    const selectService = useMapStore(s => s.selectService)
    const Icon = KIND_ICON[service.kind]
    const isSelected = selectedServiceId === service.id

    const itemBase = isDark
        ? "hover:bg-white/[0.05]"
        : "hover:bg-black/[0.04]"
    const itemSelected = isDark
        ? "bg-white/[0.10] hover:bg-white/[0.10]"
        : "bg-black/[0.06] hover:bg-black/[0.06]"

    return (
        <button
            type="button"
            onClick={() => selectService(service.id)}
            className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${itemBase} ${isSelected ? itemSelected : ""}`}
        >
            <StatusDot color={color} />
            <Icon className="w-4 h-4 flex-none opacity-70" />
            <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{service.name}</div>
                <div className="text-[10px] uppercase tracking-wider opacity-50 mt-0.5">
                    {service.region} · {label}
                </div>
            </div>
        </button>
    )
}

export default ServiceListItem
