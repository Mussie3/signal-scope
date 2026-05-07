import { useNow } from "@/shared/hooks/useNow"
import { usePlaybackStore } from "../playback.store"

export const usePlaybackTime = (): number => {
    const liveNow = useNow()
    const mode = usePlaybackStore(s => s.mode)
    const scrubTime = usePlaybackStore(s => s.scrubTime)
    return mode === "live" ? liveNow : scrubTime
}
