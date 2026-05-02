import { useShallow } from "zustand/shallow"
import { useMapStore } from "./store"
import { useNow } from "@/shared/hooks/useNow"
import { useThemeStore } from "@/shared/store/theme.store"
import { useFilterStore } from "@/shared/store/filter.store"
import { deriveServiceStatus } from "./status"
import { STATUS_COLORS } from "./constants"
import { RANGE_TO_MS } from "@/shared/types/filter"
import type { ServiceStatus } from "./types"

const STATUS_LABEL: Record<ServiceStatus, string> = {
    healthy: "Healthy",
    slow: "Slow",
    failing: "Failing",
    down: "Down",
    no_data: "No data",
}

const Stat = ({ label, value }: { label: string; value: string }) => (
    <div className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0 border-b border-current/[0.06] last:border-b-0">
        <span className="text-[11px] uppercase tracking-wider opacity-55">{label}</span>
        <span className="text-sm font-medium tabular-nums">{value}</span>
    </div>
)

const RightPanel = () => {
    const selectedServiceId = useMapStore(s => s.selectedServiceId)
    const service = useMapStore(s =>
        selectedServiceId ? s.servicesById[selectedServiceId] : null,
    )
    const incoming = useMapStore(useShallow(s =>
        selectedServiceId
            ? s.connectionIds
                .map(id => s.connectionsById[id])
                .filter(c => c.targetId === selectedServiceId)
            : [],
    ))
    const selectService = useMapStore(s => s.selectService)
    const theme = useThemeStore(s => s.theme)
    const range = useFilterStore(s => s.range)
    const now = useNow()

    const rangeMs = RANGE_TO_MS[range]
    const isDark = theme === "dark"
    const containerStyles = isDark
        ? "bg-[#0a0a0a] border-white/10 text-white"
        : "bg-white border-black/10 text-black"
    const closeButtonStyles = isDark
        ? "hover:bg-white/[0.10] text-white/80 hover:text-white"
        : "hover:bg-black/[0.06] text-black/60 hover:text-black"
    const cardStyles = isDark
        ? "bg-white/[0.04] border-white/[0.06]"
        : "bg-black/[0.02] border-black/[0.05]"
    const dividerColor = isDark ? "border-white/[0.06]" : "border-black/[0.05]"

    if (!service) {
        return (
            <aside className={`w-80 flex-none h-full border-l overflow-y-auto ${containerStyles}`}>
                <div className="px-6 pt-16 text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-4 border border-dashed border-current/20">
                        <span className="text-2xl opacity-40">?</span>
                    </div>
                    <h3 className="text-sm font-medium mb-1">No service selected</h3>
                    <p className="text-xs opacity-50 leading-relaxed">
                        Click any node on the map or row in the sidebar to inspect its live metrics.
                    </p>
                </div>
            </aside>
        )
    }

    const allEvents = incoming.flatMap(c => c.buffer)
    const events = allEvents.filter(e => now - e.timestamp <= rangeMs)
    const status = deriveServiceStatus(incoming, now, rangeMs)
    const totalEvents = events.length
    const errorCount = events.filter(e => !e.success).length
    const errorRate = totalEvents > 0 ? errorCount / totalEvents : 0
    const avgLatency = totalEvents > 0
        ? events.reduce((sum, e) => sum + e.latency, 0) / totalEvents
        : 0
    const lastSeenAt = totalEvents > 0
        ? Math.max(...events.map(e => e.timestamp))
        : null
    const lastSeenAgoSec = lastSeenAt !== null
        ? Math.max(0, now - lastSeenAt) / 1000
        : null
    const eventsPerSecond = totalEvents / (rangeMs / 1000)
    const statusColor = STATUS_COLORS[status]

    return (
        <aside className={`w-80 flex-none h-full border-l overflow-y-auto ${containerStyles}`}>
            <div className={`flex items-start justify-between px-5 pt-5 pb-4 border-b ${dividerColor}`}>
                <div className="min-w-0 flex-1">
                    <div className="text-[10px] uppercase tracking-[0.14em] opacity-50 mb-1.5">
                        {service.kind} · {service.region}
                    </div>
                    <h2 className="text-lg font-semibold truncate">{service.name}</h2>
                </div>
                <button
                    type="button"
                    onClick={() => selectService(null)}
                    className={`w-7 h-7 rounded-md flex items-center justify-center text-xl leading-none transition-colors flex-none ml-3 ${closeButtonStyles}`}
                    aria-label="Close panel"
                >
                    ×
                </button>
            </div>

            <div className="px-5 py-4">
                <div
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg border"
                    style={{
                        background: `${statusColor}14`,
                        borderColor: `${statusColor}3a`,
                    }}
                >
                    <span className="relative flex-none">
                        <span
                            className="block w-2.5 h-2.5 rounded-full"
                            style={{ background: statusColor }}
                        />
                        <span
                            className="absolute inset-0 w-2.5 h-2.5 rounded-full animate-ping opacity-60"
                            style={{ background: statusColor, animationDuration: "2s" }}
                        />
                    </span>
                    <span className="text-sm font-medium" style={{ color: statusColor }}>
                        {STATUS_LABEL[status]}
                    </span>
                </div>
            </div>

            <div className="px-5 pb-3">
                <div className="text-[10px] uppercase tracking-[0.14em] opacity-50 mb-2">
                    {range}
                </div>
                <div className={`px-3 rounded-lg border ${cardStyles}`}>
                    <Stat label="Events" value={totalEvents.toString()} />
                    <Stat label="Throughput" value={`${eventsPerSecond.toFixed(2)} req/s`} />
                    <Stat label="Error rate" value={`${(errorRate * 100).toFixed(1)}%`} />
                    <Stat label="Avg latency" value={`${Math.round(avgLatency)} ms`} />
                </div>
            </div>

            <div className="px-5 pb-5">
                <div className="text-[10px] uppercase tracking-[0.14em] opacity-50 mb-2">
                    Topology
                </div>
                <div className={`px-3 rounded-lg border ${cardStyles}`}>
                    <Stat
                        label="Last seen"
                        value={lastSeenAgoSec === null ? "never" : `${lastSeenAgoSec.toFixed(1)}s ago`}
                    />
                    <Stat label="Incoming edges" value={incoming.length.toString()} />
                </div>
            </div>
        </aside>
    )
}

export default RightPanel
