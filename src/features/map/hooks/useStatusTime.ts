import { useCoarseNow } from "@/shared/hooks/useCoarseNow"
import { usePlaybackStore } from "../playback.store"

/**
 * The time health is judged against.
 *
 * Identical to usePlaybackTime while scrubbing — a paused map must show the
 * exact instant you dragged to, not a rounded one — but while live it ticks
 * coarsely, because a status that is re-derived sixty times a second still
 * only changes a few times a second.
 */
export const useStatusTime = (): number => {
    const coarse = useCoarseNow(250)
    const mode = usePlaybackStore(s => s.mode)
    const scrubTime = usePlaybackStore(s => s.scrubTime)
    return mode === "live" ? coarse : scrubTime
}
