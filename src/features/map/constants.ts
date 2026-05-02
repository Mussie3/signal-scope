import { ServiceStatus } from "./types"

export const ANIMATION_DURATION_MS = 2000
export const DOWN_AGE_MS = 5_000
export const FAILING_ERROR_RATE = 0.1
export const SLOW_LATENCY_MS = 300

export const STATUS_COLORS: Record<ServiceStatus, string> = {
    healthy: "#22c55e",   // green
    slow: "#eab308",      // amber
    failing: "#ef4444",   // red
    down: "#6b7280",      // grey
    no_data: "#9ca3af",   // muted grey
}
