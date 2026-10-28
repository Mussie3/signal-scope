import { useFilterStore } from "@/shared/store/filter.store"
import { useAvailableRegions } from "@/features/map/hooks/useRegionFilter"
import { usePlaybackStore } from "@/features/map/playback.store"
import { usePlaybackTime } from "@/features/map/hooks/usePlaybackTime"
import { useModeStore, MODE_LABEL, MODE_HINT, type MapMode } from "@/features/map/mode.store"
import { ALL_REGIONS, RANGE_LABEL, type Range } from "@/shared/types/filter"
import { regionLabel } from "@/features/map/regions"
import SignalScopeIcon from "@/shared/ui/icons/SignalScopeIcon"

const RANGES: Range[] = ["Last 30 seconds", "Last 1 minute", "Last 5 minutes", "Last 15 minutes"]
const MODES: MapMode[] = ["ambient", "incident", "investigate"]

const clock = (ms: number) =>
    new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })

/**
 * Time state has to be unmistakable.
 *
 * Someone reading twenty-minute-old data while believing it is live will
 * conclude a resolved incident is ongoing, or that a current one is over. That
 * is a worse failure than any amount of visual roughness, so live, paused and
 * history get three visibly different treatments rather than one subtle badge.
 */
const TimeBadge = () => {
    const mode = usePlaybackStore(s => s.mode)
    const t = usePlaybackTime()
    const live = mode === "live"

    return (
        <div
            className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 font-mono text-xs"
            style={{
                borderColor: live ? "var(--live)" : "var(--health-slow)",
                background: "var(--ss-card)",
                color: live ? "var(--ss-foreground)" : "var(--health-slow)",
            }}
        >
            <span
                className={live ? "ss-live-dot" : ""}
                style={{
                    width: 7, height: 7, borderRadius: 999,
                    background: live ? "var(--live)" : "var(--health-slow)",
                }}
            />
            {live ? "LIVE" : "HISTORY"} {clock(t)}
        </div>
    )
}

const TopBar = () => {
    const { region, setRegion, range, setRange } = useFilterStore()
    const regions = useAvailableRegions()
    const mode = useModeStore(s => s.mode)
    const setMode = useModeStore(s => s.setMode)

    const ambient = mode === "ambient"

    return (
        <header
            className="flex items-center gap-3 border-b px-4 py-2.5"
            style={{ borderColor: "var(--ss-border)", background: "var(--ss-card)" }}
        >
            <div className="flex items-center gap-2 pr-1">
                <SignalScopeIcon className="h-6 w-6" style={{ color: "var(--health-healthy)" }} />
                <span className="text-lg font-bold tracking-tight" style={{ color: "var(--ss-foreground)" }}>
                    SignalScope
                </span>
            </div>

            {/* Mode is the primary control, so it sits first and reads as a
                segmented switch rather than a dropdown you have to open. */}
            <div
                className="flex items-center gap-0.5 rounded-lg p-0.5"
                style={{ background: "var(--ss-muted)" }}
                role="tablist"
                aria-label="View mode"
            >
                {MODES.map(m => (
                    <button
                        key={m}
                        type="button"
                        role="tab"
                        aria-selected={mode === m}
                        title={MODE_HINT[m]}
                        onClick={() => setMode(m)}
                        className="rounded-md px-3 py-1 text-sm font-medium transition-colors"
                        style={
                            mode === m
                                ? { background: "var(--ss-card)", color: "var(--ss-foreground)" }
                                : { color: "var(--ss-muted-foreground)" }
                        }
                    >
                        {MODE_LABEL[m]}
                    </button>
                ))}
            </div>

            {/* Ambient is for reading across a room; filters and search are not
                what that mode is for, so they are hidden rather than greyed. */}
            {!ambient && (
                <div className="ml-auto flex items-center gap-2">
                    <select
                        aria-label="Region"
                        value={region}
                        onChange={e => setRegion(e.target.value)}
                        className="h-8 rounded-md border px-2 text-sm outline-none"
                        style={{ borderColor: "var(--ss-border)", background: "var(--ss-card)", color: "var(--ss-foreground)" }}
                    >
                        {regions.map(r => (
                            <option key={r} value={r}>{r === ALL_REGIONS ? "All regions" : regionLabel(r)}</option>
                        ))}
                    </select>
                    <select
                        aria-label="Window"
                        value={range}
                        onChange={e => setRange(e.target.value as Range)}
                        className="h-8 rounded-md border px-2 text-sm outline-none"
                        style={{ borderColor: "var(--ss-border)", background: "var(--ss-card)", color: "var(--ss-foreground)" }}
                    >
                        {RANGES.map(r => <option key={r} value={r}>{RANGE_LABEL[r]}</option>)}
                    </select>
                </div>
            )}

            <div className={ambient ? "ml-auto" : ""}>
                <TimeBadge />
            </div>
        </header>
    )
}

export default TopBar
