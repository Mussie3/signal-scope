import { create } from "zustand"

export type PlaybackMode = "live" | "paused"

type PlaybackState = {
    mode: PlaybackMode
    scrubTime: number
    pause: () => void
    play: () => void
    setScrubTime: (time: number) => void
}

export const usePlaybackStore = create<PlaybackState>((set) => ({
    mode: "live",
    scrubTime: Date.now(),
    pause: () => set({ mode: "paused", scrubTime: Date.now() }),
    play: () => set({ mode: "live" }),
    setScrubTime: (time) => set({ mode: "paused", scrubTime: time }),
}))
