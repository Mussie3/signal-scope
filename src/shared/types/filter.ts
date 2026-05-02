export type Region = "All Region" | "US East" | "US West" | "EU Central" | "Asia Pacific"
export type ServiceRegion = Exclude<Region, "All Region">

export type Range = "Last 30 seconds" | "Last 1 minute" | "Last 5 minutes" | "Last 15 minutes"

export const RANGE_TO_MS: Record<Range, number> = {
    "Last 30 seconds": 30_000,
    "Last 1 minute": 60_000,
    "Last 5 minutes": 5 * 60_000,
    "Last 15 minutes": 15 * 60_000,
}
