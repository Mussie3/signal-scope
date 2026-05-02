import { useThemeStore } from "@/shared/store/theme.store"
import { Connection, Service } from "./types"
import { useNow } from "@/shared/hooks/useNow"
import { ANIMATION_DURATION_MS, NODE_EDGE_OFFSET } from "./constants"

interface Props {
    connection: Connection,
    source: Service,
    target: Service
}

const ConnectionEdge = (props: Props) => {

    const now = useNow()
    const theme = useThemeStore(state => state.theme)
    const isDark = theme === "dark"
    const stroke = isDark ? "#fff" : "#000"

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
        <g>
            <line
                stroke={stroke}
                strokeWidth={2}
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
                return (
                    <circle
                        key={event.timestamp}
                        cx={x} cy={y} r={4}
                        fill={stroke}
                    />
                )
            })}
        </g>
    )
}

export default ConnectionEdge
