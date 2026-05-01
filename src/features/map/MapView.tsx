import { useThemeStore } from "@/shared/store/theme.store"
import ConnectionEdge from "./ConnectionEdge"
import { seedServices, seedConnections } from "./seed"
import ServiceNode from "./ServiceNode"
import usePanZoom from "@/shared/hooks/usePanZoom"

const MapView = () => {

    const theme = useThemeStore(state => state.theme)
    const { pan, zoom, isDragging, panZoomHandlers } = usePanZoom()
    const isDark = theme === "dark"

    return (
        <svg {...panZoomHandlers} width="100%" height="100%" className={isDark ? "bg-[#000]" : "bg-[#fff]"} style={{ cursor: isDragging ? "grabbing" : "grab" }}>
            <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
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