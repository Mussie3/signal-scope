import { create } from "zustand"

/**
 * The same screen is used in three very different states of mind, and they want
 * almost opposite things. One layout serving all three serves none of them well.
 *
 *   ambient     — left on a second monitor or a wall. Read from three metres
 *                 away. The user is not reading, they are checking a shape and a
 *                 colour. Chrome gets out of the way; labels get bigger.
 *
 *   incident    — something is wrong, possibly at 3am. Find the failing thing
 *                 and its blast radius fast. Density is fine, hesitation is not.
 *
 *   investigate — calm, writing an incident report. Scrubbing history, reading
 *                 exact numbers. Precision matters more than speed.
 */
export type MapMode = "ambient" | "incident" | "investigate"

export const MODE_LABEL: Record<MapMode, string> = {
    ambient: "Ambient",
    incident: "Incident",
    investigate: "Investigate",
}

export const MODE_HINT: Record<MapMode, string> = {
    ambient: "Glanceable. Is anything wrong?",
    incident: "What broke, and what else does it affect?",
    investigate: "What happened, and when?",
}

type ModeState = {
    mode: MapMode
    setMode: (mode: MapMode) => void
}

export const useModeStore = create<ModeState>((set) => ({
    // Incident is the honest default: it is the mode someone opens this in when
    // they have a reason to open it at all.
    mode: "incident",
    setMode: (mode) => set({ mode }),
}))
