import React, { useRef, useState } from "react"

type PanZoomHandlers<T extends Element> = {
    onPointerDown: React.PointerEventHandler<T>
    onPointerMove: React.PointerEventHandler<T>
    onPointerUp: React.PointerEventHandler<T>
    onPointerLeave: React.PointerEventHandler<T>
    onWheel: React.WheelEventHandler<T>
}

const usePanZoom = <T extends Element = Element>() => {
    const [isDragging, setIsDragging] = useState(false)
    const [panValue, setPanValue] = useState({
        x: 0,
        y: 0
    })
    const dragStart = useRef({
        x: 0, y: 0, panX: 0, panY: 0
    })
    const [zoom, setZoom] = useState(1)

    const handlePointerDown = (event: React.PointerEvent<T>) => {
        setIsDragging(true)
        dragStart.current = { x: event.clientX, y: event.clientY, panX: panValue.x, panY: panValue.y }
    }

    const handlePointerMove = (event: React.PointerEvent<T>) => {
        if (!isDragging) return

        const dx = event.clientX - dragStart.current.x
        const dy = event.clientY - dragStart.current.y
        setPanValue({
            x: dragStart.current.panX + dx,
            y: dragStart.current.panY + dy
        })
    }

    const handlePointerUp = () => {
        setIsDragging(false)
    }

    const handleWheel = (event: React.WheelEvent<T>) => {
        event.preventDefault()
        setZoom(prev => Math.max(0.25, Math.min(4, prev * (1 - event.deltaY * 0.001))))
    }

    const panZoomHandlers: PanZoomHandlers<T> = {
        onPointerDown: handlePointerDown,
        onPointerMove: handlePointerMove,
        onPointerUp: handlePointerUp,
        onPointerLeave: handlePointerUp,
        onWheel: handleWheel
    }

    return {
        pan: panValue,
        zoom,
        isDragging,
        panZoomHandlers
    }
}

export default usePanZoom