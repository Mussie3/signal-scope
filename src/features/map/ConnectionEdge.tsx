import { useThemeStore } from "@/shared/store/theme.store"
import { Connection, Service } from "./types"
import { useNow } from "@/shared/hooks/useNow"
import { useMapStore } from "./store"
import { useFilterStore } from "@/shared/store/filter.store"
import { ANIMATION_DURATION_MS, NODE_EDGE_OFFSET } from "./constants"

interface Props {
    connection: Connection,
    source: Service,
    target: Service
}

const ConnectionEdge = (props: Props) => {

    const now = useNow()
    const theme = useThemeStore(state => state.theme)
    const selectedServiceId = useMapStore(s => s.selectedServiceId)
    const region = useFilterStore(s => s.region)
    const isDark = theme === "dark"
    const baseStroke = isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.45)"
    const dotFill = isDark ? "#ffffff" : "#1f2937"

    const isHighlighted = selectedServiceId !== null && (
        props.connection.sourceId === selectedServiceId ||
        props.connection.targetId === selectedServiceId
    )
    const isDimmedBySelection = selectedServiceId !== null && !isHighlighted

    const isInRegion = region === "All Region" ||
        props.source.region === region ||
        props.target.region === region
    const isDimmedByRegion = !isInRegion

    const opacity = isDimmedByRegion ? 0.12 : isDimmedBySelection ? 0.18 : 1
    const strokeWidth = isHighlighted ? 2.5 : 1.5

    const dx = props.target.position.x - props.source.position.x
    const dy = props.target.position.y - props.source.position.y
    const distance = Math.sqrt(dx * dx + dy * dy) || 1
    const ux = dx / distance
    const uy = dy / distance

    const x1 = props.source.position.x + ux * NODE_EDGE_OFFSET
    const y1 = props.source.position.y + uy * NODE_EDGE_OFFSET
    const x2 = props.target.position.x - ux * NODE_EDGE_OFFSET
    const y2 = props.target.position.y - uy * NODE_EDGE_OFFSET

    const inFlight = props.connection.buffer.filter(e => now - e.timestamp < ANIMATION_DURATION_MS)

    return (
        <g style={{ opacity }}>
            <line
                stroke={baseStroke}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                markerEnd="url(#edge-arrow)"
            />
            {inFlight.map(event => {
                const progress = (now - event.timestamp) / ANIMATION_DURATION_MS
                const x = x1 + (x2 - x1) * progress
                const y = y1 + (y2 - y1) * progress
                const fadeOpacity = progress < 0.1
                    ? progress / 0.1
                    : progress > 0.9
                        ? (1 - progress) / 0.1
                        : 1
                const dotColor = event.success ? dotFill : "#ef4444"
                return (
                    <circle
                        key={event.timestamp}
                        cx={x}
                        cy={y}
                        r={4}
                        fill={dotColor}
                        opacity={fadeOpacity}
                        filter="url(#dot-glow)"
                    />
                )
            })}
        </g>
    )
}

export default ConnectionEdge
