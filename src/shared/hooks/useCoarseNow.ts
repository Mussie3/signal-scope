import { useEffect, useState } from "react"

/**
 * A clock that ticks a few times a second instead of sixty.
 *
 * Most of this screen does not need per-frame time. Health is derived against
 * windows measured in seconds, and re-deriving it every frame re-scanned every
 * service's buffer sixty times a second for an answer that changes maybe four
 * times a second. That was the main thread's whole budget.
 *
 * Per-frame time still exists for the one thing that genuinely needs it: the
 * position of a dot travelling along an edge.
 */
export const useCoarseNow = (intervalMs = 250): number => {
    const [now, setNow] = useState(() => Date.now())

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), intervalMs)
        return () => clearInterval(timer)
    }, [intervalMs])

    return now
}
