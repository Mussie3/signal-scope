import { useState } from "react"
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
            return <g><circle cx={0} cy={0} r={18} fill={fill} /><ApiIcon x={-12} y={-12} width={24} height={24} style={{color: "white"}}/></g>
        case "cache":
            return <g><polygon points="0,-18 18,0 0,18 -18,0" fill={fill} /><CacheIcon x={-12} y={-12} width={24} height={24} style={{color: "white"}} /></g>
        case "database":
            return <g><rect x={-18} y={-18} width={36} height={36} rx={9} fill={fill} /><DatabaseIcon x={-12} y={-12} width={24} height={24} style={{color: "white"}} /></g>
    }
}

const ServiceNode = (props: Props) => {

    const theme = useThemeStore(state => state.theme)
    const isDark = theme === "dark"
    const textColor = isDark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.85)"
    const labelHaloFill = isDark ? "rgba(0,0,0,0.65)" : "rgba(255,255,255,0.85)"

    const incoming = useMapStore(useShallow(state =>
        state.connectionIds
            .map(id => state.connectionsById[id])
            .filter(c => c.targetId === props.service.id)
    ))
    const selectedServiceId = useMapStore(s => s.selectedServiceId)
    const selectService = useMapStore(s => s.selectService)
    const now = useNow()
    const status = deriveServiceStatus(incoming, now)
    const fill = STATUS_COLORS[status]
    const isSelected = selectedServiceId === props.service.id
    const [isHovered, setIsHovered] = useState(false)

    return (
        <g
            transform={`translate(${props.service.position.x}, ${props.service.position.y})`}
            onClick={(e) => { e.stopPropagation(); selectService(props.service.id) }}
            onPointerEnter={() => setIsHovered(true)}
            onPointerLeave={() => setIsHovered(false)}
            style={{ cursor: "pointer" }}
        >
            {(isSelected || isHovered) && (
                <circle
                    cx={0}
                    cy={0}
                    r={26}
                    fill="none"
                    stroke={fill}
                    strokeWidth={isSelected ? 2.5 : 1.5}
                    strokeOpacity={isSelected ? 0.9 : 0.5}
                />
            )}
            {shapeByKind(props.service.kind, fill)}
            <text
                x={0}
                y={42}
                textAnchor="middle"
                fontSize={12}
                fontWeight={500}
                fill={textColor}
                paintOrder="stroke"
                stroke={labelHaloFill}
                strokeWidth={3}
                strokeLinejoin="round"
            >
                {props.service.name}
            </text>
        </g>
    )
}

export default ServiceNode
