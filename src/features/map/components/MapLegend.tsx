import { healthColor } from "./ServiceShape"
import { KIND_LABEL } from "../kinds"
import type { ServiceKind, ServiceStatus } from "../types"

/**
 * The legend exists because the map encodes two things at once and neither is
 * guessable. A dashed hexagon meaning "third party, not yours to fix" is good
 * design only if something says so once.
 */

const STATUSES: Array<{ status: ServiceStatus; label: string }> = [
    { status: "healthy", label: "Healthy" },
    { status: "slow", label: "Slow" },
    { status: "failing", label: "Failing" },
    { status: "down", label: "Down" },
    { status: "no_data", label: "No data" },
]

const KINDS: ServiceKind[] = ["frontend", "api", "database", "cache", "external"]

/** The same silhouettes the map uses, at legend scale. */
const MiniShape = ({ kind }: { kind: ServiceKind }) => {
    const p = {
        fill: "none",
        stroke: "var(--ss-muted-foreground)",
        strokeWidth: 1.4,
        strokeDasharray: kind === "external" ? "3 2" : undefined,
    }
    switch (kind) {
        case "frontend": return <rect x={-7} y={-4} width={14} height={8} rx={2.5} {...p} />
        case "database": return <rect x={-4.5} y={-4.5} width={9} height={9} rx={2} {...p} />
        case "cache": return <polygon points="0,-6 6,0 0,6 -6,0" {...p} />
        case "external": return <polygon points="5.5,0 2.75,4.8 -2.75,4.8 -5.5,0 -2.75,-4.8 2.75,-4.8" {...p} />
        default: return <circle r={5} {...p} />
    }
}

const StatusSwatch = ({ status }: { status: ServiceStatus }) => (
    <svg width={16} height={16} viewBox="-10 -10 20 20" className="shrink-0">
        <circle
            r={8}
            fill={status === "down" ? "var(--health-down)"
                : status === "healthy" || status === "no_data" ? "var(--ss-background)"
                    : healthColor(status)}
            stroke={healthColor(status)}
            strokeWidth={2.2}
            strokeDasharray={status === "no_data" ? "2 2.5" : undefined}
        />
        {status === "failing" && <rect x={-1.2} y={-4.8} width={2.4} height={5.6} fill="var(--glyph-ink)" />}
        {status === "slow" && <path d="M0 -4 V0 L2.4 1.6" stroke="var(--glyph-ink)" strokeWidth={1.9} fill="none" strokeLinecap="round" />}
        {status === "down" && <path d="M-3.2 -3.2 L3.2 3.2 M3.2 -3.2 L-3.2 3.2" stroke="var(--ss-foreground)" strokeWidth={2} strokeLinecap="round" />}
    </svg>
)

const MapLegend = () => (
    <div
        className="absolute bottom-3 left-1/2 -translate-x-1/2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 rounded-lg border px-3 py-2 text-[11px] backdrop-blur"
        style={{
            borderColor: "var(--ss-border)",
            background: "color-mix(in oklch, var(--ss-card) 88%, transparent)",
            color: "var(--ss-muted-foreground)",
        }}
    >
        {STATUSES.map(({ status, label }) => (
            <span key={status} className="flex items-center gap-1.5">
                <StatusSwatch status={status} />
                {label}
            </span>
        ))}
        <span aria-hidden className="h-4 w-px" style={{ background: "var(--ss-border)" }} />
        {KINDS.map(kind => (
            <span key={kind} className="flex items-center gap-1.5">
                <svg width={16} height={16} viewBox="-9 -9 18 18" className="shrink-0">
                    <MiniShape kind={kind} />
                </svg>
                {KIND_LABEL[kind]}
            </span>
        ))}
    </div>
)

export default MapLegend
