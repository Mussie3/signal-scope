import { useMapStore } from "../store"
import { useIsConnectionInRegion } from "../hooks/useRegionFilter"
import { useServiceStatus } from "../hooks/useServiceStatus"
import { usePlaybackTime } from "../hooks/usePlaybackTime"
import { ANIMATION_DURATION_MS } from "../constants"
import { healthColor } from "./ServiceShape"
import type { Connection, Service } from "../types"

interface Props {
    connection: Connection
    source: Service
    target: Service
}

const HIT_AREA_WIDTH = 14

/** The four control points of the single cubic an edge is drawn with. */
export interface EdgeCurve {
    d: string
    p: [number, number][]
}

/**
 * Edges curve rather than running straight.
 *
 * In a layered map almost every edge travels downward between tiers, and a
 * bundle of straight diagonals reads as a scribble. A curve that leaves its
 * source vertically and arrives at its target vertically keeps the direction of
 * flow legible even where a dozen edges converge on a shared database.
 *
 * The control points come back alongside the path string because the traffic
 * dots have to be placed ON this curve, and the only way to do that without
 * measuring the DOM is to evaluate the same cubic we just described.
 */
export const edgeCurve = (ax: number, ay: number, bx: number, by: number): EdgeCurve => {
    const dx = bx - ax
    const dy = by - ay
    if (Math.abs(dy) > Math.abs(dx) * 0.35 && dy !== 0) {
        const s = Math.sign(dy)
        const y1 = ay + s * 22
        const y2 = by - s * 27
        const my = (y1 + y2) / 2
        return {
            d: `M${ax} ${y1} C${ax} ${my}, ${bx} ${my}, ${bx} ${y2}`,
            p: [[ax, y1], [ax, my], [bx, my], [bx, y2]],
        }
    }
    const s = Math.sign(dx) || 1
    const x1 = ax + s * 24
    const x2 = bx - s * 29
    const mx = (x1 + x2) / 2
    return {
        d: `M${x1} ${ay} C${mx} ${ay}, ${mx} ${by}, ${x2} ${by}`,
        p: [[x1, ay], [mx, ay], [mx, by], [x2, by]],
    }
}

/** Standard cubic Bezier evaluation, t in [0, 1]. */
const pointAt = (p: [number, number][], t: number): [number, number] => {
    const u = 1 - t
    const a = u * u * u
    const b = 3 * u * u * t
    const c = 3 * u * t * t
    const e = t * t * t
    return [
        a * p[0][0] + b * p[1][0] + c * p[2][0] + e * p[3][0],
        a * p[0][1] + b * p[1][1] + c * p[2][1] + e * p[3][1],
    ]
}

const ConnectionEdge = ({ connection, source, target }: Props) => {
    const now = usePlaybackTime()
    const selectedServiceId = useMapStore(s => s.selectedServiceId)
    const setHoveredEntity = useMapStore(s => s.setHoveredEntity)
    const isHovered = useMapStore(s =>
        s.hoveredEntity?.kind === "connection" && s.hoveredEntity.id === connection.id,
    )
    const isInRegion = useIsConnectionInRegion(source, target)
    const { status: targetStatus } = useServiceStatus(target.id)

    const isHighlighted = selectedServiceId !== null && (
        connection.sourceId === selectedServiceId || connection.targetId === selectedServiceId
    )
    const isDimmedBySelection = selectedServiceId !== null && !isHighlighted

    // An edge into or out of a third party is background information while it is
    // behaving; it only earns full weight when it is the thing going wrong.
    const touchesExternal = source.kind === "external" || target.kind === "external"
    const quiet = targetStatus === "healthy" || targetStatus === "no_data"

    const opacity = !isInRegion ? 0.14
        : isDimmedBySelection ? 0.22
            : touchesExternal && quiet ? 0.45
                : 1

    const { d, p } = edgeCurve(source.position.x, source.position.y, target.position.x, target.position.y)
    const inFlight = connection.buffer.filter(e => now - e.timestamp < ANIMATION_DURATION_MS)
    const flowing = inFlight.length > 0 && targetStatus !== "down"

    return (
        <g style={{ opacity }}>
            {/* An invisible fat stroke owns hover; the visible line stays thin. */}
            <path
                d={d}
                fill="none"
                stroke="transparent"
                strokeWidth={HIT_AREA_WIDTH}
                style={{ cursor: "pointer" }}
                onPointerEnter={() => setHoveredEntity({ kind: "connection", id: connection.id })}
                onPointerLeave={() => setHoveredEntity(null)}
            />
            <path
                d={d}
                fill="none"
                stroke={quiet ? "var(--edge)" : healthColor(targetStatus)}
                strokeWidth={quiet && !isHighlighted && !isHovered ? 1.2 : 2.2}
                // Dashed when nothing is travelling: a link with no traffic looks
                // different from one carrying healthy traffic, rather than both
                // being a plain line.
                strokeDasharray={targetStatus === "down" || !flowing ? "3 5" : undefined}
                markerEnd={`url(#ss-arrow-${quiet ? "healthy" : targetStatus})`}
                pointerEvents="none"
            />
            {/* Positions are computed, not animated by SMIL.
                
                This used to be an <animateMotion> per dot. The component
                re-renders every frame, which rewrote the element's begin
                attribute every frame, which restarted the animation before it
                could advance — 144 dots sat perfectly still at their start
                points, fading in and out, for the whole life of the feature.
                
                Since the curve is ours, evaluating it is both simpler and
                immune to that: the dot's position is a pure function of how
                long ago its request happened. */}
            {inFlight.map(event => {
                const progress = (now - event.timestamp) / ANIMATION_DURATION_MS
                const fade = progress < 0.1 ? progress / 0.1
                    : progress > 0.9 ? (1 - progress) / 0.1
                        : 1
                const [cx, cy] = pointAt(p, progress)
                return (
                    <circle
                        key={event.timestamp}
                        cx={cx}
                        cy={cy}
                        r={event.success ? 2.6 : 3.4}
                        fill={event.success ? "var(--dot)" : "var(--health-failing)"}
                        opacity={fade}
                        pointerEvents="none"
                    />
                )
            })}
        </g>
    )
}

export default ConnectionEdge
