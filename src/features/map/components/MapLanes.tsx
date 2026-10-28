import { useMapStore } from "../store"
import { useLaneHealth } from "../hooks/useLaneHealth"
import { EXTERNAL_LANE, regionCode } from "../regions"
import { healthColor } from "./ServiceShape"
import type { ServiceStatus } from "../types"

/**
 * Region lanes.
 *
 * This is what makes a large map readable. Fifty services floating freely is a
 * scribble; the same fifty grouped into labelled columns is a system you can
 * reason about, because "where does this thing live" is answered by position
 * before you have read a single label.
 *
 * The external lane is drawn dashed and unfilled, because those services really
 * are outside the boundary — the frame says so without needing a caption.
 */

const LANE_TOP = 10
const HEADER_Y = 36
/** Rough advance width per character at the header's two font sizes. */
const LABEL_CH = 8.4
const CODE_CH = 6.2

const MapLanes = ({ height }: { height: number }) => {
    const lanes = useMapStore(s => s.lanes)
    const laneHealth = useLaneHealth()

    if (lanes.length === 0) return null

    return (
        <g pointerEvents="none">
            {lanes.map(lane => {
                const external = lane.key === EXTERNAL_LANE
                const worst: ServiceStatus = laneHealth[lane.key] ?? "no_data"
                // A healthy lane gets a neutral dot rather than a coloured one:
                // nothing being wrong should not look like a status report.
                const dot = worst === "healthy" || worst === "no_data"
                    ? "var(--lane-border)"
                    : healthColor(worst)

                const code = regionCode(lane.key)
                const labelEnd = 38 + lane.label.length * LABEL_CH
                const codeStart = lane.width - 18 - code.length * CODE_CH
                const codeFits = codeStart - labelEnd > 12

                return (
                    <g key={lane.key}>
                        <rect
                            x={lane.x}
                            y={LANE_TOP}
                            width={lane.width}
                            height={Math.max(height - LANE_TOP * 2, 420)}
                            rx={18}
                            fill={external ? "none" : "var(--lane)"}
                            stroke={external ? "var(--ss-muted-foreground)" : "var(--lane-border)"}
                            strokeDasharray={external ? "10 7" : undefined}
                            strokeWidth={external ? 1.5 : 1}
                        />
                        <circle cx={lane.x + 24} cy={HEADER_Y} r={5} fill={dot} />
                        <text x={lane.x + 38} y={HEADER_Y + 5} fontSize={15} fontWeight={600} fill="var(--ss-foreground)">
                            {lane.label}
                        </text>
                        {/* The provider's slug is the first thing to go when a
                            lane is narrow: "Outside your system" printed over
                            "third parties" is less use than either alone, and
                            the city name is the one you navigate by. */}
                        {codeFits && (
                            <text
                                x={lane.x + lane.width - 18}
                                y={HEADER_Y + 5}
                                textAnchor="end"
                                fontSize={11}
                                fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                                fill="var(--ss-muted-foreground)"
                            >
                                {code}
                            </text>
                        )}
                    </g>
                )
            })}
        </g>
    )
}

export default MapLanes
