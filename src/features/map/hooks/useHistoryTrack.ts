import { useEffect, useState } from "react"
import { useMapStore } from "../store"
import { FAILING_ERROR_RATE, PRUNE_WINDOW_MS, SLOW_LATENCY_MS } from "../constants"
import type { ServiceStatus } from "../types"

/** How many segments the track is cut into. */
const BUCKETS = 120
/**
 * Recomputed on its own slow interval rather than per frame.
 *
 * The retained buffers hold tens of thousands of events; walking them at 60fps
 * alongside everything else the map already does per frame would cost more
 * than the whole rest of the render. The track describes minutes, so a
 * two-second refresh is indistinguishable from a live one.
 */
const REFRESH_MS = 2000

export interface HistoryTrack {
    /** Worst status per slice, oldest first. Empty until traffic is seen. */
    segments: ServiceStatus[]
    /** Oldest moment the track covers — never earlier than the first event. */
    start: number
    end: number
}

const EMPTY: HistoryTrack = { segments: [], start: 0, end: 0 }

/**
 * What the retained history looks like.
 *
 * A scrubber with a plain grey track tells you that history exists. It does not
 * tell you WHERE in that history anything happened, so finding the incident
 * means dragging blindly and watching the map. Colouring each slice by the
 * worst thing happening in it turns the track into the index: the red band is
 * the outage, and you drag straight to it.
 *
 * The span starts at the first event ever seen rather than at the full
 * retention window. A session that has been open for forty seconds has forty
 * seconds of history, and offering fourteen more minutes of empty track to
 * scrub through is offering nothing.
 */
export const useHistoryTrack = (): HistoryTrack => {
    const [track, setTrack] = useState<HistoryTrack>(EMPTY)

    useEffect(() => {
        const compute = () => {
            const { connectionIds, connectionsById } = useMapStore.getState()
            const now = Date.now()
            const retainedFrom = now - PRUNE_WINDOW_MS

            let earliest = Infinity
            for (const id of connectionIds) {
                const buffer = connectionsById[id]?.buffer
                if (buffer && buffer.length > 0 && buffer[0].timestamp < earliest) {
                    earliest = buffer[0].timestamp
                }
            }
            if (!Number.isFinite(earliest)) {
                setTrack(EMPTY)
                return
            }

            const start = Math.max(retainedFrom, earliest)
            const span = Math.max(now - start, 1)
            const bucketMs = span / BUCKETS

            const count = new Float64Array(BUCKETS)
            const errors = new Float64Array(BUCKETS)
            const latency = new Float64Array(BUCKETS)

            for (const id of connectionIds) {
                const conn = connectionsById[id]
                if (!conn) continue
                for (const e of conn.buffer) {
                    const b = Math.floor((e.timestamp - start) / bucketMs)
                    if (b < 0 || b >= BUCKETS) continue
                    count[b] += 1
                    if (!e.success) errors[b] += 1
                    latency[b] += e.latency
                }
            }

            const segments: ServiceStatus[] = []
            for (let b = 0; b < BUCKETS; b++) {
                // A gap inside an otherwise busy span is traffic having stopped,
                // which is what "down" means everywhere else on this screen.
                if (count[b] === 0) segments.push(b === 0 ? "no_data" : "down")
                else if (errors[b] / count[b] > FAILING_ERROR_RATE) segments.push("failing")
                else if (latency[b] / count[b] > SLOW_LATENCY_MS) segments.push("slow")
                else segments.push("healthy")
            }

            setTrack({ segments, start, end: now })
        }

        compute()
        const timer = setInterval(compute, REFRESH_MS)
        return () => clearInterval(timer)
    }, [])

    return track
}
