import { healthColor } from "./ServiceShape"
import type { ServiceStatus } from "../types"

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

/**
 * Kinds are one line of text, not five drawn chips.
 *
 * Status needs real swatches because the glyph inside each one is part of what
 * is being explained. Kind does not: the silhouettes are simple enough that a
 * typed character carries them, and five SVG chips wrapped the legend onto a
 * second row, which cost more width than the fidelity was worth.
 */
const KIND_GLYPHS = "\u25CB API  \u25AB DB  \u25C7 Cache  \u25AD Frontend  \u2B21 External"

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
        className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border px-3 py-2 text-[11px] backdrop-blur"
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
        <span>{KIND_GLYPHS}</span>
    </div>
)

export default MapLegend
