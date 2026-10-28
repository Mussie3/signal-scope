import { useNow } from "@/shared/hooks/useNow"
import { usePlaybackStore } from "../playback.store"
import { useHistoryTrack } from "../hooks/useHistoryTrack"
import { healthColor } from "./ServiceShape"
import type { ServiceStatus } from "../types"

const clock = (ms: number) =>
    new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })

const formatAgo = (ms: number): string => {
    if (ms < 1000) return "now"
    if (ms < 60_000) return `${Math.round(ms / 1000)}s ago`
    if (ms < 3_600_000) return `${Math.round(ms / 60_000)} min ago`
    return `${Math.round(ms / 3_600_000)}h ago`
}

/**
 * Only trouble is drawn.
 *
 * Painting the healthy stretches too turns the track into a solid bar with
 * faint variations, and the eye has to work out which grey is which. Leaving
 * them as bare background makes every mark on the track mean "something
 * happened here", which is the only question the track is asked.
 */
const isQuiet = (status: ServiceStatus): boolean => status === "healthy" || status === "no_data"

const TimelineScrubber = () => {
    const liveNow = useNow()
    const mode = usePlaybackStore(s => s.mode)
    const scrubTime = usePlaybackStore(s => s.scrubTime)
    const pause = usePlaybackStore(s => s.pause)
    const play = usePlaybackStore(s => s.play)
    const setScrubTime = usePlaybackStore(s => s.setScrubTime)
    const { segments, start } = useHistoryTrack()

    // Until any traffic has been seen there is nothing to scrub through, so the
    // range collapses to the present rather than offering empty minutes.
    const sliderMin = start === 0 ? liveNow - 1000 : start
    const sliderMax = liveNow
    const sliderValue = mode === "live" ? sliderMax : Math.min(Math.max(scrubTime, sliderMin), sliderMax)
    const isLive = mode === "live"

    const headPct = ((sliderValue - sliderMin) / Math.max(sliderMax - sliderMin, 1)) * 100
    const segmentPct = 100 / Math.max(segments.length, 1)

    return (
        <div
            className="flex-none border-t"
            style={{ background: "var(--ss-card)", borderColor: "var(--ss-border)", color: "var(--ss-foreground)" }}
        >
            <div className="flex items-center gap-3 px-4 py-2.5">
                <button
                    type="button"
                    onClick={() => (isLive ? pause() : play())}
                    className="flex flex-none items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors"
                    style={{
                        borderColor: isLive ? "var(--ss-border)" : "var(--health-slow)",
                        background: "var(--ss-muted)",
                        color: isLive ? "var(--ss-foreground)" : "var(--health-slow)",
                    }}
                >
                    {isLive ? (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                            <rect x="2" y="1" width="2" height="8" />
                            <rect x="6" y="1" width="2" height="8" />
                        </svg>
                    ) : (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                            <path d="M2 1 L9 5 L2 9 Z" />
                        </svg>
                    )}
                    <span>{isLive ? "Pause" : "Play"}</span>
                </button>

                <div className="flex flex-none items-center gap-2">
                    <span
                        className={isLive ? "ss-live-dot" : ""}
                        style={{
                            width: 7, height: 7, borderRadius: 999,
                            background: isLive ? "var(--live)" : "var(--ss-muted-foreground)",
                        }}
                    />
                    <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--ss-muted-foreground)" }}>
                        {isLive ? "Live" : "Paused"}
                    </span>
                </div>

                {/* The track IS the history: each slice is coloured by the worst
                    thing happening in it, so an incident is a band you can aim
                    at rather than something you hunt for by dragging. */}
                <div className="group relative flex h-6 flex-1 items-center">
                    <div
                        className="absolute inset-x-0 top-1/2 h-3 -translate-y-1/2 overflow-hidden rounded"
                        style={{ background: "var(--ss-muted)" }}
                    >
                        {segments.map((status, i) => isQuiet(status) ? null : (
                            <span
                                key={i}
                                className="absolute inset-y-0"
                                style={{
                                    left: `${(i / segments.length) * 100}%`,
                                    // A sliver of overlap, or rounding leaves
                                    // hairline gaps through a solid red band.
                                    width: `${segmentPct + 0.05}%`,
                                    background: healthColor(status),
                                }}
                            />
                        ))}
                    </div>

                    {/* Everything to the right of the head is future you are not
                        looking at. Shading it is what stops a paused map being
                        mistaken for a live one. */}
                    {!isLive && (
                        <div
                            className="pointer-events-none absolute inset-y-1"
                            style={{ left: `${headPct}%`, right: 0, background: "color-mix(in oklch, var(--health-slow) 15%, transparent)" }}
                        />
                    )}
                    <input
                        type="range"
                        min={sliderMin}
                        max={sliderMax}
                        step={250}
                        value={sliderValue}
                        onChange={e => setScrubTime(parseInt(e.target.value, 10))}
                        className="absolute inset-0 w-full cursor-pointer opacity-0"
                        aria-label="Timeline scrubber"
                    />
                    {/* A hairline, not a knob: the head marks an instant, and a
                        14px circle covers six seconds of the track it points at. */}
                    <div
                        className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2"
                        style={{
                            left: `${headPct}%`,
                            background: isLive ? "var(--live)" : "var(--health-slow)",
                        }}
                    />
                </div>
            </div>

            {/* Absolute times at both ends, because "15 min ago" tells you how
                far back you are but not which minute to compare against a log. */}
            <div
                className="flex items-center justify-between px-4 pb-2 font-mono text-[11px] tabular-nums"
                style={{ color: "var(--ss-muted-foreground)" }}
            >
                <span>{clock(sliderMin)} · {formatAgo(liveNow - sliderMin)}</span>
                <span>{isLive ? "now" : formatAgo(liveNow - sliderValue)}</span>
                <span>{clock(sliderValue)} · {isLive ? "now" : "viewing"}</span>
            </div>
        </div>
    )
}

export default TimelineScrubber
