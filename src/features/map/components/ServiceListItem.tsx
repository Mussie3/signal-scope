import { useMapStore } from "../store"
import { useServiceStatus } from "../hooks/useServiceStatus"
import { regionShort } from "../regions"
import { healthColor } from "./ServiceShape"
import type { Service } from "../types"

/** The legend's swatch at list scale: colour plus glyph, never colour alone. */
const StatusDot = ({ service }: { service: Service }) => {
    const { status } = useServiceStatus(service.id)
    const quiet = status === "healthy" || status === "no_data"
    return (
        <svg width={14} height={14} viewBox="-9 -9 18 18" className="shrink-0">
            <circle
                r={7}
                fill={status === "down" ? "var(--health-down)" : quiet ? "var(--ss-background)" : healthColor(status)}
                stroke={healthColor(status)}
                strokeWidth={2}
                strokeDasharray={status === "no_data" ? "2 2.5" : undefined}
            />
            {status === "failing" && <rect x={-1} y={-4} width={2} height={4.6} fill="var(--glyph-ink)" />}
            {status === "slow" && <path d="M0 -3.4 V0 L2 1.4" stroke="var(--glyph-ink)" strokeWidth={1.7} fill="none" strokeLinecap="round" />}
            {status === "down" && <path d="M-2.8 -2.8 L2.8 2.8 M2.8 -2.8 L-2.8 2.8" stroke="var(--ss-foreground)" strokeWidth={1.9} strokeLinecap="round" />}
        </svg>
    )
}

/**
 * One line per service.
 *
 * The second line used to carry "API · EU-CENTRAL-1", which halved how many
 * services fit in the column and repeated information the map already encodes
 * by shape and by lane. A two-letter region on the right is enough to tell two
 * identically-named services apart, which is the only ambiguity that exists.
 *
 * The name is monospace because it is an identifier — it has to match what the
 * person already has open in a terminal.
 */
const ServiceListItem = ({ service }: { service: Service }) => {
    const selectedServiceId = useMapStore(s => s.selectedServiceId)
    const selectService = useMapStore(s => s.selectService)
    const setHoveredEntity = useMapStore(s => s.setHoveredEntity)
    const isSelected = selectedServiceId === service.id

    return (
        <button
            type="button"
            onClick={() => selectService(isSelected ? null : service.id)}
            onPointerEnter={() => setHoveredEntity({ kind: "service", id: service.id })}
            onPointerLeave={() => setHoveredEntity(null)}
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-[5px] text-left transition-colors"
            style={{
                background: isSelected ? "var(--ss-muted)" : "transparent",
                color: "var(--ss-foreground)",
            }}
        >
            <StatusDot service={service} />
            <span className="min-w-0 flex-1 truncate font-mono text-[13px]">
                {service.name}
            </span>
            <span
                className="shrink-0 font-mono text-[11px] tracking-wide"
                style={{ color: "var(--ss-muted-foreground)" }}
            >
                {regionShort(service.region || "unknown")}
            </span>
        </button>
    )
}

export default ServiceListItem
