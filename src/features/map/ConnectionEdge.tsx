import { useThemeStore } from "@/shared/store/theme.store"
import { Connection, Service } from "./types"

interface Props {
    connection: Connection,
    source: Service,
    target: Service
}

const ConnectionEdge = (props: Props) => {

    const theme = useThemeStore(state => state.theme)
    const isDark = theme === "dark"
    const stroke = isDark ? "#fff" : "#000"


    return (
        <line 
            stroke={stroke} 
            strokeWidth={2} 
            x1={props.source.position.x}
            y1={props.source.position.y}
            x2={props.target.position.x}
            y2={props.target.position.y}
        />
    )
}

export default ConnectionEdge