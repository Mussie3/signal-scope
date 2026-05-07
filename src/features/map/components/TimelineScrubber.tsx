import { useNow } from "@/shared/hooks/useNow"
import { useThemeStore } from "@/shared/store/theme.store"
import { usePlaybackStore } from "../playback.store"
import { PRUNE_WINDOW_MS } from "../constants"

const formatAgo = (ms: number): string => {
    if (ms < 1000) return "now"
    if (ms < 60_000) return `${Math.round(ms / 1000)}s ago`
    if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`
    return `${Math.round(ms / 3_600_000)}h ago`
}

const TimelineScrubber = () => {
    const liveNow = useNow()
    const mode = usePlaybackStore(s => s.mode)
    const scrubTime = usePlaybackStore(s => s.scrubTime)
    const pause = usePlaybackStore(s => s.pause)
    const play = usePlaybackStore(s => s.play)
    const setScrubTime = usePlaybackStore(s => s.setScrubTime)
    const theme = useThemeStore(s => s.theme)
    const isDark = theme === "dark"

    const sliderMin = liveNow - PRUNE_WINDOW_MS
    const sliderMax = liveNow
    const sliderValue = mode === "live" ? sliderMax : Math.min(scrubTime, sliderMax)
    const isLive = mode === "live"

    const containerStyles = isDark
        ? "bg-[#0a0a0a]/95 border-white/10 text-white"
        : "bg-white/95 border-black/10 text-black"
    const buttonBase = isDark
        ? "bg-white/[0.08] hover:bg-white/[0.14] border-white/15 text-white"
        : "bg-black/[0.04] hover:bg-black/[0.08] border-black/10 text-black"
    const buttonActive = isDark
        ? "bg-white/[0.18] hover:bg-white/[0.22] border-white/30 text-white"
        : "bg-black/[0.85] hover:bg-black border-black text-white"
    const liveDot = isLive ? "#22c55e" : "#9ca3af"
    const sliderTrack = isDark ? "bg-white/[0.08]" : "bg-black/[0.06]"
    const sliderFill = isDark ? "bg-white/40" : "bg-black/40"

    const fillPct = ((sliderValue - sliderMin) / (sliderMax - sliderMin)) * 100

    return (
        <div className={`flex-none border-t backdrop-blur-md ${containerStyles}`}>
            <div className="flex items-center gap-3 px-4 py-2.5">
                <button
                    type="button"
                    onClick={() => (isLive ? pause() : play())}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors flex items-center gap-2 ${isLive ? buttonBase : buttonActive}`}
                >
                    {isLive ? (
                        <>
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                                <rect x="2" y="1" width="2" height="8" />
                                <rect x="6" y="1" width="2" height="8" />
                            </svg>
                            <span>Pause</span>
                        </>
                    ) : (
                        <>
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                                <path d="M2 1 L9 5 L2 9 Z" />
                            </svg>
                            <span>Play</span>
                        </>
                    )}
                </button>

                <div className="flex items-center gap-2 flex-none">
                    <span
                        className="relative inline-flex"
                        style={{ width: 8, height: 8 }}
                    >
                        <span
                            className="block w-2 h-2 rounded-full"
                            style={{ background: liveDot }}
                        />
                        {isLive && (
                            <span
                                className="absolute inset-0 w-2 h-2 rounded-full animate-ping opacity-60"
                                style={{ background: liveDot, animationDuration: "2s" }}
                            />
                        )}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider opacity-60">
                        {isLive ? "Live" : "Paused"}
                    </span>
                </div>

                <div className="relative flex-1 h-6 flex items-center group">
                    <div className={`absolute inset-x-0 top-1/2 -translate-y-1/2 h-1 rounded-full ${sliderTrack}`} />
                    <div
                        className={`absolute top-1/2 -translate-y-1/2 left-0 h-1 rounded-full ${sliderFill}`}
                        style={{ width: `${fillPct}%` }}
                    />
                    <input
                        type="range"
                        min={sliderMin}
                        max={sliderMax}
                        step={250}
                        value={sliderValue}
                        onChange={(e) => setScrubTime(parseInt(e.target.value, 10))}
                        className="absolute inset-0 w-full opacity-0 cursor-pointer"
                        aria-label="Timeline scrubber"
                    />
                    <div
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full pointer-events-none"
                        style={{
                            left: `${fillPct}%`,
                            background: isLive ? "#22c55e" : isDark ? "#fff" : "#000",
                            boxShadow: "0 0 0 2px rgba(0,0,0,0.15)",
                        }}
                    />
                </div>

                <span className="text-xs tabular-nums opacity-70 flex-none w-16 text-right">
                    {formatAgo(liveNow - sliderValue)}
                </span>
            </div>
        </div>
    )
}

export default TimelineScrubber
