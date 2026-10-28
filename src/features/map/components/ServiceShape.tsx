import type { ServiceKind, ServiceStatus } from "../types"

/**
 * A node carries three things at once: what KIND of thing it is, how HEALTHY it
 * is, and — for anyone who cannot separate the health hues — a glyph saying the
 * same thing in a second channel.
 *
 * Kind is the silhouette, health is the stroke. Keeping them on different
 * properties is what lets both be read at once; filling the whole node with the
 * health colour (the previous approach) made the kind icon fight it and left
 * colour as the only carrier of status.
 */

const HEALTH_VAR: Record<ServiceStatus, string> = {
    healthy: "var(--health-healthy)",
    slow: "var(--health-slow)",
    failing: "var(--health-failing)",
    down: "var(--health-down)",
    no_data: "var(--health-nodata)",
}

export const healthColor = (status: ServiceStatus) => HEALTH_VAR[status] ?? "var(--health-nodata)"

interface ShapeProps {
    kind: ServiceKind
    status: ServiceStatus
}

/**
 * Fill semantics:
 *   healthy  — the quiet node fill, so a healthy map is calm
 *   slow/failing — filled with the health colour, so exceptions are loud
 *   down     — hatched, which reads as "not a colour, an absence"
 *   no_data  — the background, so it recedes rather than claiming a state
 */
const Shape = ({ kind, status }: ShapeProps) => {
    const stroke = healthColor(status)
    const fill =
        status === "down" ? "url(#ss-hatch-down)"
            : status === "no_data" ? "var(--ss-background)"
                : status === "healthy" ? "var(--node-fill)"
                    : stroke

    const external = kind === "external"
    const p = {
        fill,
        fillOpacity: external && status !== "down" ? 0.55 : 1,
        stroke,
        strokeWidth: status === "no_data" ? 1.5 : 2.25,
        // A dashed outline says "not yours". You cannot fix Stripe, and an
        // incident there should not look like your own service failing.
        strokeDasharray: external ? "5 3" : status === "no_data" ? "2 3" : undefined,
    }

    switch (kind) {
        case "frontend":
            // Wide, like a screen: this is where users arrive.
            return <rect x={-28} y={-16} width={56} height={32} rx={9} {...p} />
        case "database":
            return <rect x={-17} y={-17} width={34} height={34} rx={7} {...p} />
        case "cache":
            return <polygon points="0,-23 23,0 0,23 -23,0" {...p} />
        case "external":
            return <polygon points="21,0 10.5,18.2 -10.5,18.2 -21,0 -10.5,-18.2 10.5,-18.2" {...p} />
        case "api":
        default:
            return <circle r={19} {...p} />
    }
}

/**
 * Status without colour. Healthy stays blank on purpose — a mark on every node
 * would be noise, and "nothing is wrong" is exactly the case that should not
 * draw the eye.
 */
export const HealthGlyph = ({ status, alsoSlow = false }: { status: ServiceStatus; alsoSlow?: boolean }) => {
    const ink = "var(--glyph-ink)"
    if (status === "slow") {
        return (
            <g stroke={ink} strokeWidth={2} fill="none" strokeLinecap="round">
                <circle r={6.5} />
                <path d="M0 -3.5 V0 L3 2" />
            </g>
        )
    }
    if (status === "failing") {
        return (
            <g fill={ink}>
                <rect x={-1.6} y={-8} width={3.2} height={10} rx={1.4} />
                <circle cy={5.6} r={1.9} />
                {/* Failing AND slow are both true more often than you would think;
                    collapsing them hides half of what is wrong. */}
                {alsoSlow && (
                    <circle cx={12} cy={-12} r={4.5} fill="var(--health-slow)" stroke="var(--ss-background)" strokeWidth={1.5} />
                )}
            </g>
        )
    }
    if (status === "down") {
        return <path d="M-6 -6 L6 6 M6 -6 L-6 6" stroke="var(--ss-foreground)" strokeWidth={3} strokeLinecap="round" />
    }
    return null
}

/** Shared defs the map needs once: the hatch for "down" and the edge arrowheads. */
export const ShapeDefs = () => (
    <>
        <pattern id="ss-hatch-down" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="var(--health-down)" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--ss-background)" strokeWidth="2.5" />
        </pattern>
        {(["healthy", "slow", "failing", "down", "no_data"] as ServiceStatus[]).map(h => (
            <marker
                key={h}
                id={`ss-arrow-${h}`}
                viewBox="0 0 10 10"
                refX="5"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
            >
                <path d="M0 0 L10 5 L0 10 z" fill={healthColor(h)} />
            </marker>
        ))}
    </>
)

export default Shape
