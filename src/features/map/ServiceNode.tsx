import { useShallow } from "zustand/shallow"
import { Service, ServiceKind } from "./types"
import ApiIcon from "@/shared/ui/icons/ApiIcon"
import CacheIcon from "@/shared/ui/icons/CacheIcon"
import DatabaseIcon from "@/shared/ui/icons/DatabaseIcon"
import { useMapStore } from "./store"
import { useNow } from "@/shared/hooks/useNow"
import { deriveServiceStatus } from "./status"
import { STATUS_COLORS } from "./constants"
import { useThemeStore } from "@/shared/store/theme.store"

interface Props { service: Service }

const shapeByKind = (kind: ServiceKind, fill: string) => {
    switch(kind){
        case "api":
            return <g><circle cx={0} cy={0} r={16} fill={fill} /><ApiIcon x={-12} y={-12} width={24} height={24} style={{color: "white"}}/></g>
        case "cache":
            return <g><polygon points="0,-16 16,0 0,16 -16,0" fill={fill} /><CacheIcon x={-12} y={-12} width={24} height={24} style={{color: "white"}} /></g>
        case "database":
            return <g><rect x={-16} y={-16} width={32} height={32} rx={8} fill={fill} /><DatabaseIcon x={-12} y={-12} width={24} height={24} style={{color: "white"}} /></g>
    }
}

const ServiceNode = (props: Props) => {

    const theme = useThemeStore(state => state.theme)
    const textColor = theme === "dark" ? "#fff" : "#000"

    const incoming = useMapStore(useShallow(state =>
        state.connectionIds
            .map(id => state.connectionsById[id])
            .filter(c => c.targetId === props.service.id)
    ))
    const now = useNow()
    const status = deriveServiceStatus(incoming, now)
    const fill = STATUS_COLORS[status]

    return (
        <g transform={`translate(${props.service.position.x}, ${props.service.position.y})`}>
            {shapeByKind(props.service.kind, fill)}
            <text x={0} y={32} textAnchor="middle" fill={textColor}>{props.service.name}</text>
        </g>
    )
}

export default ServiceNode