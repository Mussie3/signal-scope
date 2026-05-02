import { DOWN_AGE_MS, FAILING_ERROR_RATE, SLOW_LATENCY_MS } from "./constants";
import { Connection, ServiceStatus } from "./types";

export const deriveServiceStatus = (
    incoming: Connection[],
    now: number,
    rangeMs?: number,
): ServiceStatus => {

    const all = incoming.flatMap(c => c.buffer)
    const events = rangeMs !== undefined
        ? all.filter(e => now - e.timestamp <= rangeMs)
        : all

    if (events.length === 0) return "no_data"

    const lastSeenAt = Math.max(...events.map(e => e.timestamp))
    if (now - lastSeenAt > DOWN_AGE_MS) return "down"

    const errorCount = events.filter(e => !e.success).length
    const errorRate = errorCount / events.length
    if (errorRate > FAILING_ERROR_RATE) return "failing"

    const avgLatency = events.reduce((sum, e) => sum + e.latency, 0) / events.length
    if (avgLatency > SLOW_LATENCY_MS) return "slow"

    return "healthy"
}
