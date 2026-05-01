import { useEffect, useState } from "react"

export const useNow = () => {
    const [now, setNow] = useState(() => Date.now())
    
    useEffect(() => {
        const tick = () => {
            setNow(Date.now())
            frameId = requestAnimationFrame(tick)
        }
        let frameId = requestAnimationFrame(tick)
        return () => {
            cancelAnimationFrame(frameId)
        }
    }, [])

    return now
}