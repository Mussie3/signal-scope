import { useFilterStore } from "@/shared/store/filter.store"
import { useThemeStore } from "@/shared/store/theme.store"
import { RANGE_TO_MS } from "@/shared/types/filter"
import { useMapStore } from "../store"
import { useServiceStatus } from "../hooks/useServiceStatus"
import { usePlaybackTime } from "../hooks/usePlaybackTime"
import { KIND_LABEL } from "../kinds"

type Props = {
    pan: { x: number; y: number }
    zoom: number
}

const TOOLTIP_OFFSET_PX = 16

const Tooltip = ({ pan, zoom }: Props) => {
    const hoveredEntity = useMapStore(s => s.hoveredEntity)
    const theme = useThemeStore(s => s.theme)
    const isDark = theme === "dark"

    if (!hoveredEntity) return null

    const containerStyles = isDark
        ? "bg-[#0a0a0a]/95 border-white/15 text-white"
        : "bg-white/95 border-black/10 text-black shadow-md"

    if (hoveredEntity.kind === "service") {
        return (
            <ServiceTooltip
                serviceId={hoveredEntity.id}
                pan={pan}
                zoom={zoom}
                containerStyles={containerStyles}
            />
        )
    }

    return (
        <ConnectionTooltip
            connectionId={hoveredEntity.id}
            pan={pan}
            zoom={zoom}
            containerStyles={containerStyles}
        />
    )
}

type ServiceTooltipProps = {
    serviceId: string
    pan: { x: number; y: number }
    zoom: number
    containerStyles: string
}

const ServiceTooltip = ({ serviceId, pan, zoom, containerStyles }: ServiceTooltipProps) => {
    const service = useMapStore(s => s.servicesById[serviceId])
    const { color, label } = useServiceStatus(serviceId)

    if (!service) return null

    const screenX = pan.x + service.position.x * zoom
    const screenY = pan.y + service.position.y * zoom - TOOLTIP_OFFSET_PX * 2

    return (
        <div
            className={`absolute z-20 px-3 py-2 rounded-lg border backdrop-blur-md pointer-events-none ${containerStyles}`}
            style={{ left: screenX, top: screenY, transform: "translate(-50%, -100%)" }}
        >
            <div className="text-[10px] uppercase tracking-wider opacity-50 mb-0.5 whitespace-nowrap">
                {KIND_LABEL[service.kind]} · {service.region}
            </div>
            <div className="text-sm font-semibold mb-1 whitespace-nowrap">{service.name}</div>
            <div className="flex items-center gap-2 text-xs whitespace-nowrap">
                <span
                    className="w-2 h-2 rounded-full flex-none"
                    style={{ background: color }}
                />
                <span style={{ color }}>{label}</span>
            </div>
        </div>
    )
}

type ConnectionTooltipProps = {
    connectionId: string
    pan: { x: number; y: number }
    zoom: number
    containerStyles: string
}

const ConnectionTooltip = ({ connectionId, pan, zoom, containerStyles }: ConnectionTooltipProps) => {
    const connection = useMapStore(s => s.connectionsById[connectionId])
    const source = useMapStore(s => connection ? s.servicesById[connection.sourceId] : null)
    const target = useMapStore(s => connection ? s.servicesById[connection.targetId] : null)
    const range = useFilterStore(s => s.range)
    const now = usePlaybackTime()

    if (!connection || !source || !target) return null

    const rangeMs = RANGE_TO_MS[range]
    const events = connection.buffer.filter(e => now - e.timestamp <= rangeMs)
    const totalEvents = events.length
    const errorCount = events.filter(e => !e.success).length
    const errorRate = totalEvents > 0 ? errorCount / totalEvents : 0
    const avgLatency = totalEvents > 0
        ? events.reduce((sum, e) => sum + e.latency, 0) / totalEvents
        : 0
    const eventsPerSecond = totalEvents / (rangeMs / 1000)

    const midCanvasX = (source.position.x + target.position.x) / 2
    const midCanvasY = (source.position.y + target.position.y) / 2
    const screenX = pan.x + midCanvasX * zoom
    const screenY = pan.y + midCanvasY * zoom - TOOLTIP_OFFSET_PX

    return (
        <div
            className={`absolute z-20 px-3 py-2 rounded-lg border backdrop-blur-md pointer-events-none ${containerStyles}`}
            style={{ left: screenX, top: screenY, transform: "translate(-50%, -100%)" }}
        >
            <div className="text-[10px] uppercase tracking-wider opacity-50 mb-0.5 whitespace-nowrap">
                Connection
            </div>
            <div className="text-sm font-semibold mb-1.5 whitespace-nowrap">
                {source.name} <span className="opacity-50">→</span> {target.name}
            </div>
            <div className="space-y-0.5 text-xs tabular-nums">
                <div className="flex justify-between gap-6 whitespace-nowrap">
                    <span className="opacity-60">Throughput</span>
                    <span>{eventsPerSecond.toFixed(2)} req/s</span>
                </div>
                <div className="flex justify-between gap-6 whitespace-nowrap">
                    <span className="opacity-60">Error rate</span>
                    <span>{(errorRate * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between gap-6 whitespace-nowrap">
                    <span className="opacity-60">Avg latency</span>
                    <span>{Math.round(avgLatency)} ms</span>
                </div>
            </div>
        </div>
    )
}

export default Tooltip
