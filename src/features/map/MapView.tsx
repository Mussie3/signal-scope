import { useThemeStore } from "@/shared/store/theme.store"
import ConnectionEdge from "./ConnectionEdge"
import ServiceNode from "./ServiceNode"
import usePanZoom from "@/shared/hooks/usePanZoom"
import { useMapStore } from "./store"

const MapView = () => {

    const theme = useThemeStore(state => state.theme)
    const servicesById = useMapStore(s => s.servicesById)
    const connectionsById = useMapStore(s => s.connectionsById)
    const serviceIds = useMapStore(s => s.serviceIds)
    const connectionIds = useMapStore(s => s.connectionIds)
    const selectService = useMapStore(s => s.selectService)

    const { pan, zoom, isDragging, panZoomHandlers } = usePanZoom<SVGSVGElement>()
    const isDark = theme === "dark"
    const arrowFill = isDark ? "#fff" : "#000"

    return (
        <svg
            {...panZoomHandlers}
            onClick={() => selectService(null)}
            width="100%"
            height="100%"
            className={isDark ? "bg-[#000]" : "bg-[#fff]"}
            style={{ cursor: isDragging ? "grabbing" : "grab" }}
        >
            <defs>
                <marker
                    id="edge-arrow"
                    viewBox="0 0 10 10"
                    refX="10"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto"
                    markerUnits="strokeWidth"
                >
                    <path d="M0,0 L10,5 L0,10 Z" fill={arrowFill} />
                </marker>
            </defs>
            <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
                {connectionIds.map(id => {
                    const c = connectionsById[id]
                    return <ConnectionEdge
                    key={c.id}
                    connection={c}
                    source={servicesById[c.sourceId]}
                    target={servicesById[c.targetId]}
                    />
                })}
                {serviceIds.map(id => {
                    const s = servicesById[id]
                   return <ServiceNode service={s} key={s.id} />
                })}
            </g>
        </svg>
    )
}

export default MapView
