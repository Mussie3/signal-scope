// Regions are DISCOVERED, never predefined.
//
// The demo's six services carry friendly labels ("US East"), but a topology
// derived from OpenTelemetry reports whatever the resource said — `eu-central-1`,
// `us-west-2`, or `unknown` when nothing reported one. The closed union that
// used to live here was a lie the compiler could not catch: a real region never
// matched a filter option, so selecting any region silently hid every service
// that had one.
export const ALL_REGIONS = "All Region"

export type Range = "Last 30 seconds" | "Last 1 minute" | "Last 5 minutes" | "Last 15 minutes"

export const RANGE_TO_MS: Record<Range, number> = {
    "Last 30 seconds": 30_000,
    "Last 1 minute": 60_000,
    "Last 5 minutes": 5 * 60_000,
    "Last 15 minutes": 15 * 60_000,
}

/**
 * What the picker shows.
 *
 * The Range values are the stored keys and read as prose; the control itself
 * sits beside a region picker in a dense bar, where "Last 15 minutes" costs
 * three times the width of the thing it is telling you.
 */
export const RANGE_LABEL: Record<Range, string> = {
    "Last 30 seconds": "Window 30s",
    "Last 1 minute": "Window 1m",
    "Last 5 minutes": "Window 5m",
    "Last 15 minutes": "Window 15m",
}
