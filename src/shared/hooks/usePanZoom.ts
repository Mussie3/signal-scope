import React, { useRef, useState } from "react"

type PanZoomHandlers<T extends Element> = {
    onPointerDown: React.PointerEventHandler<T>
    onPointerMove: React.PointerEventHandler<T>
    onPointerUp: React.PointerEventHandler<T>
    onPointerLeave: React.PointerEventHandler<T>
    onWheel: React.WheelEventHandler<T>
}

const ZOOM_MIN = 0.25
const ZOOM_MAX = 4
const WHEEL_SENSITIVITY = 0.001

const usePanZoom = <T extends Element = Element>() => {
    const [isDragging, setIsDragging] = useState(false)
    const [panValue, setPanValue] = useState({ x: 0, y: 0 })
    const [zoom, setZoom] = useState(1)
    const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 })

    const handlePointerDown = (event: React.PointerEvent<T>) => {
        setIsDragging(true)
        dragStart.current = {
            x: event.clientX,
            y: event.clientY,
            panX: panValue.x,
            panY: panValue.y,
        }
    }

    const handlePointerMove = (event: React.PointerEvent<T>) => {
        if (!isDragging) return
        const dx = event.clientX - dragStart.current.x
        const dy = event.clientY - dragStart.current.y
        setPanValue({
            x: dragStart.current.panX + dx,
            y: dragStart.current.panY + dy,
        })
    }

    const handlePointerUp = () => {
        setIsDragging(false)
    }

    const handleWheel = (event: React.WheelEvent<T>) => {
        event.preventDefault()

        const target = event.currentTarget as Element
        const rect = target.getBoundingClientRect()
        const cursorX = event.clientX - rect.left
        const cursorY = event.clientY - rect.top

        setZoom(prevZoom => {
            const proposed = prevZoom * (1 - event.deltaY * WHEEL_SENSITIVITY)
            const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, proposed))
            const scale = newZoom / prevZoom

            setPanValue(prevPan => ({
                x: cursorX - (cursorX - prevPan.x) * scale,
                y: cursorY - (cursorY - prevPan.y) * scale,
            }))

            return newZoom
        })
    }

    const reset = () => {
        setPanValue({ x: 0, y: 0 })
        setZoom(1)
    }

    /**
     * Zoom from the centre of the viewport, for the +/- buttons.
     *
     * Wheel zoom anchors on the cursor because that is where the user is
     * looking; a button has no cursor position to anchor to, and anchoring on
     * the origin would slide the map out from under them.
     */
    const zoomBy = (factor: number) => {
        setZoom(prevZoom => {
            const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, prevZoom * factor))
            const scale = newZoom / prevZoom
            setPanValue(prevPan => ({
                x: prevPan.x * scale,
                y: prevPan.y * scale,
            }))
            return newZoom
        })
    }

    /** Centre a canvas of the given size at the given scale. */
    const fitTo = (
        scale: number,
        viewportWidth: number,
        viewportHeight: number,
        canvas: { width: number; height: number },
    ) => {
        setZoom(scale)
        setPanValue({
            x: (viewportWidth - canvas.width * scale) / 2,
            y: (viewportHeight - canvas.height * scale) / 2,
        })
    }

    const panZoomHandlers: PanZoomHandlers<T> = {
        onPointerDown: handlePointerDown,
        onPointerMove: handlePointerMove,
        onPointerUp: handlePointerUp,
        onPointerLeave: handlePointerUp,
        onWheel: handleWheel,
    }

    return {
        pan: panValue,
        zoom,
        isDragging,
        panZoomHandlers,
        reset,
        zoomBy,
        fitTo,
    }
}

export default usePanZoom
