import { useEffect, useRef } from "react"
import usePanZoom from "@/shared/hooks/usePanZoom"
import { useMapStore } from "../store"
import { useModeStore } from "../mode.store"
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
    const canvas = useMapStore(s => s.canvas)
    const mode = useModeStore(m => m.mode)
    const wrapRef = useRef<HTMLDivElement>(null)
    const fittedFor = useRef<string>("")
    const ambient = mode === "ambient"

    const { pan, zoom, isDragging, panZoomHandlers, reset, zoomBy, fitTo } = usePanZoom<SVGSVGElement>()

    // Fit once per topology. A discovered map can be any size, and opening it
    // at 100% with half the estate off-screen is a worse first impression than
    // any amount of visual polish can recover.
    useEffect(() => {
        const el = wrapRef.current
        if (!el || canvas.width === 0) return
        const key = `${canvas.width}x${canvas.height}`
        if (fittedFor.current === key) return
        fittedFor.current = key
        const pad = 48
        const k = Math.min(
            (el.clientWidth - pad * 2) / canvas.width,
            (el.clientHeight - pad * 2) / canvas.height,
        )
        fitTo(Math.max(0.1, Math.min(1, k)), el.clientWidth, el.clientHeight, canvas)
    }, [canvas, fitTo])

    // Deliberately not theme-dependent: this is a control-room surface, and the
    // health palette is tuned against this one dark ground.
    const gridDotFill = "oklch(0.3 0.014 250 / 0.55)"
    const overlayButton = "border-[var(--ss-border)] bg-[var(--ss-card)]/90 text-[var(--ss-foreground)] hover:bg-[var(--ss-muted)] backdrop-blur"

    return (
        <div className="w-full h-full flex flex-col">
            <div ref={wrapRef} className="relative flex-1 min-h-0">
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
                <div
                    className={`absolute bottom-3 right-3 flex items-center gap-1 rounded-md border p-1 font-mono text-xs ${overlayButton}`}
                >
                    <button type="button" className="inline-flex h-6 min-w-6 items-center justify-center rounded" onClick={() => zoomBy(1 / 1.25)} aria-label="Zoom out">-</button>
                    <span className="w-11 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
                    <button type="button" className="inline-flex h-6 min-w-6 items-center justify-center rounded" onClick={() => zoomBy(1.25)} aria-label="Zoom in">+</button>
                    <button type="button" className="inline-flex h-6 items-center justify-center rounded px-2" onClick={() => { fittedFor.current = ""; reset() }} aria-label="Fit to view">Fit</button>
                </div>
                {!ambient && <MapLegend />}
                <Tooltip pan={pan} zoom={zoom} />
            </div>
            <TimelineScrubber />
        </div>
    )
}

export default MapView
