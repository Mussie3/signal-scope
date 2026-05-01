import { useThemeStore } from "@/shared/store/theme.store"
import ConnectionEdge from "./ConnectionEdge"
import { seedServices, seedConnections } from "./seed"
import ServiceNode from "./ServiceNode"
import usePan from "@/shared/hooks/usePan"

const MapView = () => {

    const theme = useThemeStore(state => state.theme)
    const { pan, isDragging, panHandlers } = usePan()
    const isDark = theme === "dark"

    return (
        <svg {...panHandlers} width="100%" height="100%" className={isDark ? "bg-[#000]" : "bg-[#fff]"} style={{ cursor: isDragging ? "grabbing" : "grab" }}>
            <g transform={`translate(${pan.x} ${pan.y})`}>
                {seedConnections.map(connection => (
                    <ConnectionEdge
                    key={connection.id}
                    connection={connection}
                    source={seedServices.find(s => s.id === connection.sourceId)!}
                    target={seedServices.find(s => s.id === connection.targetId)!}
                    />
                ))}
                {seedServices.map(service => (
                    <ServiceNode service={service} key={service.id} />
                ))}
            </g>
        </svg>
    )
}

export default MapView