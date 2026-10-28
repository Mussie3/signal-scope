import { useMapStore } from "../store"
import { useServiceStatus } from "../hooks/useServiceStatus"
import { useIsServiceInRegion } from "../hooks/useRegionFilter"
import type { Service } from "../types"
import Shape, { HealthGlyph, healthColor } from "./ServiceShape"

interface Props { service: Service }

const ServiceNode = ({ service }: Props) => {
    const { status } = useServiceStatus(service.id)
    const selectedServiceId = useMapStore(s => s.selectedServiceId)
    const selectService = useMapStore(s => s.selectService)
    const setHoveredEntity = useMapStore(s => s.setHoveredEntity)
    const isHovered = useMapStore(s =>
        s.hoveredEntity?.kind === "service" && s.hoveredEntity.id === service.id,
    )
    const isInRegion = useIsServiceInRegion(service)
    const isSelected = selectedServiceId === service.id

    // A node nobody is waiting on should not shout, and one that is filtered out
    // should still be visible enough to keep the shape of the system legible.
    const opacity = isInRegion ? 1 : 0.16
    const urgent = status === "failing" || status === "down"
    const quiet = status === "healthy" || status === "no_data"

    return (
        <g
            transform={`translate(${service.position.x}, ${service.position.y})`}
            onClick={(e) => { e.stopPropagation(); selectService(service.id) }}
            onPointerEnter={() => setHoveredEntity({ kind: "service", id: service.id })}
            onPointerLeave={() => setHoveredEntity(null)}
            style={{ cursor: "pointer", opacity }}
        >
            {/* Generous invisible hit area: the shapes are small and a map is
                dragged as much as it is clicked. */}
            <circle r={34} fill="transparent" />

            {/* Motion is the channel that survives being glanced at from across a
                room, where neither hue nor a 6px glyph does. */}
            {urgent && (
                <circle className="ss-pulse" r={24} fill="none" stroke={healthColor(status)} strokeWidth={2} />
            )}

            {isSelected && (
                <circle r={33} fill="none" stroke="var(--ss-foreground)" strokeWidth={1.5} strokeDasharray="4 3" />
            )}
            {!isSelected && isHovered && (
                <circle r={30} fill="none" stroke="var(--ss-muted-foreground)" strokeWidth={1.25} />
            )}

            <Shape kind={service.kind} status={status} />
            <HealthGlyph status={status} />

            <text
                y={40}
                textAnchor="middle"
                fontSize={11.5}
                fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                fill={quiet ? "var(--ss-muted-foreground)" : "var(--ss-foreground)"}
                pointerEvents="none"
            >
                {service.name}
            </text>
        </g>
    )
}

export default ServiceNode
