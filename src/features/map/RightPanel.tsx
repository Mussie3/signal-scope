import { useShallow } from "zustand/shallow"
import { useMapStore } from "./store"
import { useNow } from "@/shared/hooks/useNow"
import { useThemeStore } from "@/shared/store/theme.store"
import { deriveServiceStatus } from "./status"
import { STATUS_COLORS, PRUNE_WINDOW_LABEL_S } from "./constants"

const Stat = ({ label, value }: { label: string; value: string }) => (
    <div className="flex items-center justify-between py-2 border-b border-current/10 last:border-b-0">
        <span className="text-xs uppercase tracking-wider opacity-60">{label}</span>
        <span className="text-sm tabular-nums">{value}</span>
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
    const now = useNow()

    const isDark = theme === "dark"
    const containerStyles = isDark
        ? "bg-[#0a0a0a] border-white/10 text-white"
        : "bg-[#fafafa] border-black/10 text-black"
    const closeButtonStyles = isDark
        ? "hover:bg-white/[0.10]"
        : "hover:bg-black/[0.06]"

    if (!service) {
        return (
            <aside className={`w-80 flex-none h-full border-l overflow-y-auto ${containerStyles}`}>
                <div className="p-6 text-sm opacity-60">
                    Click a service to inspect.
                </div>
            </aside>
        )
    }

    const allEvents = incoming.flatMap(c => c.buffer)
    const status = deriveServiceStatus(incoming, now)
    const totalEvents = allEvents.length
    const errorCount = allEvents.filter(e => !e.success).length
    const errorRate = totalEvents > 0 ? errorCount / totalEvents : 0
    const avgLatency = totalEvents > 0
        ? allEvents.reduce((sum, e) => sum + e.latency, 0) / totalEvents
        : 0
    const lastSeenAt = totalEvents > 0
        ? Math.max(...allEvents.map(e => e.timestamp))
        : null
    const lastSeenAgoSec = lastSeenAt !== null
        ? Math.max(0, now - lastSeenAt) / 1000
        : null
    const eventsPerSecond = totalEvents / PRUNE_WINDOW_LABEL_S

    return (
        <aside className={`w-80 flex-none h-full border-l overflow-y-auto ${containerStyles}`}>
            <div className="flex items-start justify-between px-5 pt-5 pb-3">
                <div>
                    <div className="text-xs uppercase tracking-wider opacity-60 mb-1">
                        {service.kind}
                    </div>
                    <h2 className="text-lg font-medium">{service.name}</h2>
                </div>
                <button
                    type="button"
                    onClick={() => selectService(null)}
                    className={`w-7 h-7 rounded-md flex items-center justify-center text-lg leading-none ${closeButtonStyles}`}
                    aria-label="Close panel"
                >
                    ×
                </button>
            </div>

            <div className="px-5 py-3 flex items-center gap-2">
                <span
                    className="inline-block w-2.5 h-2.5 rounded-full"
                    style={{ background: STATUS_COLORS[status] }}
                />
                <span className="text-sm capitalize">{status.replace("_", " ")}</span>
            </div>

            <div className="px-5 pb-5">
                <Stat label={`Events (${PRUNE_WINDOW_LABEL_S}s)`} value={totalEvents.toString()} />
                <Stat label="Throughput" value={`${eventsPerSecond.toFixed(2)} req/s`} />
                <Stat label="Error rate" value={`${(errorRate * 100).toFixed(1)}%`} />
                <Stat label="Avg latency" value={`${Math.round(avgLatency)} ms`} />
                <Stat
                    label="Last seen"
                    value={lastSeenAgoSec === null ? "never" : `${lastSeenAgoSec.toFixed(1)}s ago`}
                />
                <Stat label="Incoming edges" value={incoming.length.toString()} />
            </div>
        </aside>
    )
}

export default RightPanel
