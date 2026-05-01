import { useThemeStore } from "@/shared/store/theme.store"
import { Connection, Service } from "./types"
import { useNow } from "@/shared/hooks/useNow"
import { ANIMATION_DURATION_MS } from "./constants"

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

    const inFlight = props.connection.buffer.filter(e => now - e.timestamp < ANIMATION_DURATION_MS)

    return (
        <g>
            <line 
                stroke={stroke} 
                strokeWidth={2} 
                x1={props.source.position.x}
                y1={props.source.position.y}
                x2={props.target.position.x}
                y2={props.target.position.y}
                />
            {inFlight.map(event => {
                const progress = (now - event.timestamp) / ANIMATION_DURATION_MS
                const x = props.source.position.x + (props.target.position.x - props.source.position.x) * progress
                const y = props.source.position.y + (props.target.position.y - props.source.position.y) * progress
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