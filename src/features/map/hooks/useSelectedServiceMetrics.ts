import { useServiceStatus } from "./useServiceStatus"

type Metrics = ReturnType<typeof useServiceStatus> & {
    totalEvents: number
    eventsPerSecond: number
    errorRate: number
    avgLatency: number
    lastSeenAgoSec: number | null
}

export const useSelectedServiceMetrics = (serviceId: string): Metrics => {
    const info = useServiceStatus(serviceId)
    const { incoming, now, rangeMs } = info

    const allEvents = incoming.flatMap(c => c.buffer)
    const events = allEvents.filter(e => now - e.timestamp <= rangeMs)
    const totalEvents = events.length
    const errorCount = events.filter(e => !e.success).length
    const errorRate = totalEvents > 0 ? errorCount / totalEvents : 0
    const avgLatency = totalEvents > 0
        ? events.reduce((sum, e) => sum + e.latency, 0) / totalEvents
        : 0
    const lastSeenAt = totalEvents > 0
        ? Math.max(...events.map(e => e.timestamp))
        : null
    const lastSeenAgoSec = lastSeenAt !== null
        ? Math.max(0, now - lastSeenAt) / 1000
        : null
    const eventsPerSecond = totalEvents / (rangeMs / 1000)

    return {
        ...info,
        totalEvents,
        eventsPerSecond,
        errorRate,
        avgLatency,
        lastSeenAgoSec,
    }
}
