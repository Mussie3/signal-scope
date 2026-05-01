import { useRef, useState } from "react"

type PanHandlers<T extends Element> = {
    onPointerDown: React.PointerEventHandler<T>
    onPointerMove: React.PointerEventHandler<T>
    onPointerUp: React.PointerEventHandler<T>
    onPointerLeave: React.PointerEventHandler<T>
}

const usePan = <T extends Element = Element>() => {
    const [isDragging, setIsDragging] = useState(false)
    const [panValue, setPanValue] = useState({
        x: 0,
        y: 0
    })
    const dragStart = useRef({
        x: 0, y: 0, panX: 0, panY: 0
    })

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

    const panHandlers: PanHandlers<T> = {
        onPointerDown: handlePointerDown,
        onPointerMove: handlePointerMove,
        onPointerUp: handlePointerUp,
        onPointerLeave: handlePointerUp
    }

    return {
        pan: panValue,
        isDragging,
        panHandlers
    }
}

export default usePan