import { DOWN_AGE_MS, FAILING_ERROR_RATE, SLOW_LATENCY_MS } from "./constants";
import { Connection, ServiceStatus } from "./types";

export const deriveServiceStatus = (
    incoming: Connection[],
    now: number,
): ServiceStatus => { 

    const allEvents = incoming.flatMap(c => c.buffer)
    if (allEvents.length === 0) return "no_data"

    const lastSeenAt = Math.max(...allEvents.map(e => e.timestamp))
    if (now - lastSeenAt > DOWN_AGE_MS) return "down"

    const errorCount = allEvents.filter(e => !e.success).length
    const errorRate = errorCount / allEvents.length
    if (errorRate > FAILING_ERROR_RATE) return "failing"

    const avgLatency = allEvents.reduce((sum, e) => sum + e.latency, 0) / allEvents.length
    if (avgLatency > SLOW_LATENCY_MS) return "slow"

    return "healthy"
}
