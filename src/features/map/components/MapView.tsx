import { useThemeStore } from "@/shared/store/theme.store"
import usePanZoom from "@/shared/hooks/usePanZoom"
import { useMapStore } from "../store"
import ConnectionEdge from "./ConnectionEdge"
import ServiceNode from "./ServiceNode"

const MapView = () => {
    const theme = useThemeStore(s => s.theme)
    const servicesById = useMapStore(s => s.servicesById)
    const connectionsById = useMapStore(s => s.connectionsById)
    const serviceIds = useMapStore(s => s.serviceIds)
    const connectionIds = useMapStore(s => s.connectionIds)
    const selectService = useMapStore(s => s.selectService)
    const layoutMode = useMapStore(s => s.layoutMode)
    const setLayoutMode = useMapStore(s => s.setLayoutMode)

    const { pan, zoom, isDragging, panZoomHandlers, reset } = usePanZoom<SVGSVGElement>()

    const isDark = theme === "dark"
    const isReset = pan.x === 0 && pan.y === 0 && zoom === 1
    const isAuto = layoutMode === "auto"

    const arrowFill = isDark ? "#fff" : "#000"
    const gridDotFill = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.10)"
    const canvasBg = isDark ? "bg-[#050505]" : "bg-[#f7f7f8]"
    const overlayButton = isDark
        ? "bg-white/[0.08] hover:bg-white/[0.14] border-white/15 text-white backdrop-blur-sm"
        : "bg-white/80 hover:bg-white border-black/10 text-black backdrop-blur-sm shadow-sm"
    const overlayActive = isDark
        ? "bg-white/[0.18] hover:bg-white/[0.22] border-white/30 text-white backdrop-blur-sm"
        : "bg-black/[0.85] hover:bg-black border-black text-white backdrop-blur-sm"

    return (
        <div className="relative w-full h-full">
            <svg
                {...panZoomHandlers}
                onClick={() => selectService(null)}
                width="100%"
                height="100%"
                className={canvasBg}
                style={{ cursor: isDragging ? "grabbing" : "grab" }}
            >
                <defs>
                    <pattern
                        id="canvas-grid"
                        width={32}
                        height={32}
                        patternUnits="userSpaceOnUse"
                        patternTransform={`translate(${pan.x % (32 * zoom)} ${pan.y % (32 * zoom)}) scale(${zoom})`}
                    >
                        <circle cx={1} cy={1} r={1} fill={gridDotFill} />
                    </pattern>
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
                    <filter id="dot-glow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>
                <rect width="100%" height="100%" fill="url(#canvas-grid)" pointerEvents="none" />
                <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
                    {connectionIds.map(id => {
                        const c = connectionsById[id]
                        return (
                            <ConnectionEdge
                                key={c.id}
                                connection={c}
                                source={servicesById[c.sourceId]}
                                target={servicesById[c.targetId]}
                            />
                        )
                    })}
                    {serviceIds.map(id => (
                        <ServiceNode key={id} service={servicesById[id]} />
                    ))}
                </g>
            </svg>
            <div className="absolute top-3 right-3 flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => setLayoutMode(isAuto ? "manual" : "auto")}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${isAuto ? overlayActive : overlayButton}`}
                    aria-pressed={isAuto}
                >
                    Auto layout
                </button>
                {!isReset && (
                    <button
                        type="button"
                        onClick={reset}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${overlayButton}`}
                        aria-label="Reset view"
                    >
                        Reset view
                    </button>
                )}
            </div>
            <div className={`absolute bottom-3 right-3 px-2 py-1 rounded-md border text-[10px] tabular-nums ${overlayButton}`}>
                {Math.round(zoom * 100)}%
            </div>
        </div>
    )
}

export default MapView
