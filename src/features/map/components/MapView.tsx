import usePanZoom from "@/shared/hooks/usePanZoom"
import { useMapStore } from "../store"
import ConnectionEdge from "./ConnectionEdge"
import ServiceNode from "./ServiceNode"
import MapLanes from "./MapLanes"
import MapLegend from "./MapLegend"
import { ShapeDefs } from "./ServiceShape"
import TimelineScrubber from "./TimelineScrubber"
import Tooltip from "./Tooltip"

const MapView = () => {
    const servicesById = useMapStore(s => s.servicesById)
    const connectionsById = useMapStore(s => s.connectionsById)
    const serviceIds = useMapStore(s => s.serviceIds)
    const connectionIds = useMapStore(s => s.connectionIds)
    const selectService = useMapStore(s => s.selectService)
    const layoutMode = useMapStore(s => s.layoutMode)
    const setLayoutMode = useMapStore(s => s.setLayoutMode)
    const canvas = useMapStore(s => s.canvas)

    const { pan, zoom, isDragging, panZoomHandlers, reset } = usePanZoom<SVGSVGElement>()

    const isReset = pan.x === 0 && pan.y === 0 && zoom === 1
    const isAuto = layoutMode === "auto"

    // Deliberately not theme-dependent: this is a control-room surface, and the
    // health palette is tuned against this one dark ground.
    const gridDotFill = "oklch(0.3 0.014 250 / 0.55)"
    const overlayButton = "border-[var(--ss-border)] bg-[var(--ss-card)]/90 text-[var(--ss-foreground)] hover:bg-[var(--ss-muted)] backdrop-blur"
    const overlayActive = "border-[var(--health-healthy)] bg-[var(--ss-muted)] text-[var(--ss-foreground)] backdrop-blur"

    return (
        <div className="w-full h-full flex flex-col">
            <div className="relative flex-1 min-h-0">
                <svg
                    {...panZoomHandlers}
                    onClick={() => selectService(null)}
                    width="100%"
                    height="100%"
                    cursor={isDragging ? "grabbing" : "grab"}
                    style={{ background: "var(--ss-background)" }}
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
                        <ShapeDefs />
                    </defs>
                    <rect width="100%" height="100%" fill="url(#canvas-grid)" pointerEvents="none" />
                    <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
                        <MapLanes height={canvas.height} />
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
                <MapLegend />
                <Tooltip pan={pan} zoom={zoom} />
            </div>
            <TimelineScrubber />
        </div>
    )
}

export default MapView
