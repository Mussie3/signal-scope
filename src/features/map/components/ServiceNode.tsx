import { useState } from "react"
import { useMapStore } from "../store"
import { useServiceStatus } from "../hooks/useServiceStatus"
import { useIsServiceInRegion } from "../hooks/useRegionFilter"
import { useThemeStore } from "@/shared/store/theme.store"
import type { Service } from "../types"
import ServiceShape from "./ServiceShape"

interface Props { service: Service }

const ServiceNode = ({ service }: Props) => {
    const theme = useThemeStore(s => s.theme)
    const isDark = theme === "dark"
    const textColor = isDark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.85)"
    const labelHaloFill = isDark ? "rgba(0,0,0,0.65)" : "rgba(255,255,255,0.85)"

    const { color } = useServiceStatus(service.id)
    const selectedServiceId = useMapStore(s => s.selectedServiceId)
    const selectService = useMapStore(s => s.selectService)
    const isInRegion = useIsServiceInRegion(service)
    const isSelected = selectedServiceId === service.id
    const [isHovered, setIsHovered] = useState(false)

    const opacity = isInRegion ? 1 : 0.25

    return (
        <g
            transform={`translate(${service.position.x}, ${service.position.y})`}
            onClick={(e) => { e.stopPropagation(); selectService(service.id) }}
            onPointerEnter={() => setIsHovered(true)}
            onPointerLeave={() => setIsHovered(false)}
            style={{ cursor: "pointer", opacity }}
        >
            {(isSelected || isHovered) && (
                <circle
                    cx={0}
                    cy={0}
                    r={26}
                    fill="none"
                    stroke={color}
                    strokeWidth={isSelected ? 2.5 : 1.5}
                    strokeOpacity={isSelected ? 0.9 : 0.5}
                />
            )}
            <ServiceShape kind={service.kind} fill={color} />
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
                {service.name}
            </text>
        </g>
    )
}

export default ServiceNode
