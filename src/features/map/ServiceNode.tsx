import { useThemeStore } from "@/shared/store/theme.store"
import { Service, ServiceKind } from "./types"
import ApiIcon from "@/shared/ui/icons/ApiIcon"
import CacheIcon from "@/shared/ui/icons/CacheIcon"
import DatabaseIcon from "@/shared/ui/icons/DatabaseIcon"

interface Props { service: Service }

const shapeByKind = (kind: ServiceKind, fill: string, iconFill: string) => {
    switch(kind){
        case "api":
            return <g><circle cx={0} cy={0} r={16} fill={fill} /><ApiIcon x={-12} y={-12} width={24} height={24} style={{color: iconFill}}/></g>
        case "cache":
            return <g><polygon points="0,-16 16,0 0,16 -16,0" fill={fill} /><CacheIcon x={-12} y={-12} width={24} height={24} style={{color: iconFill}} /></g>
        case "database":
            return <g><rect x={-16} y={-16} width={32} height={32} rx={8} fill={fill} /><DatabaseIcon x={-12} y={-12} width={24} height={24} style={{color: iconFill}} /></g>
    }
}

const ServiceNode = (props: Props) => {

    const theme = useThemeStore(state => state.theme)
    const isDark = theme == "dark"
    const fill = isDark ? "#fff" : "#000"
    const iconFill = !isDark ? "#fff" : "#000"

    return (
        <g transform={`translate(${props.service.position.x}, ${props.service.position.y})`}>
            {shapeByKind(props.service.kind, fill, iconFill)}
            <text x={0} y={32} textAnchor="middle" fill={fill}>{props.service.name}</text>
        </g>
    )
}

export default ServiceNode