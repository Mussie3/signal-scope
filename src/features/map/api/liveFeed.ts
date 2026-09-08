import { useEffect } from "react"
import { supabase, projectSlug } from "@/shared/api/supabase"
import { useMapStore } from "../store"
import { PRUNE_WINDOW_MS } from "../constants"
import type { Connection, RequestEvent, Service } from "../types"
import type { ServiceRegion } from "@/shared/types/filter"

/**
 * The remote counterpart to useSimulation().
 *
 * Deliberately the same shape: load a topology, push RequestEvents onto
 * connection buffers, prune past the retention window. Everything downstream --
 * status derivation, the sidebar, tooltips, the right panel, the replay
 * scrubber -- reads those buffers and does not know or care whether the events
 * came from a simulation loop or a socket.
 *
 * That is the payoff of deriving state instead of storing it: swapping the data
 * source is one hook, not a second rendering path.
 */

type TopologyPayload = {
  project: { id: string; slug: string; name: string }
  services: Array<{
    id: string
    name: string
    kind: Service["kind"]
    region: ServiceRegion
    position: { x: number; y: number }
  }>
  connections: Array<{ id: string; sourceId: string; targetId: string }>
}

type BroadcastEvent = {
  connectionId: string
  timestamp: number
  success: boolean
  latency: number
}

export const useRemoteTopology = (enabled: boolean) => {
  const setTopology = useMapStore((state) => state.setTopology)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    supabase
      .rpc("get_topology", { p_slug: projectSlug })
      .then(({ data, error }) => {
        if (cancelled || error || !data) {
          if (error) console.error("signalscope: topology load failed", error.message)
          return
        }
        const payload = data as TopologyPayload

        const services: Service[] = payload.services.map((s) => ({
          id: s.id,
          name: s.name,
          kind: s.kind,
          region: s.region,
          position: s.position,
        }))

        // Buffers start empty and fill from the socket. Backfilling history here
        // would double-count anything the subscription has already delivered.
        const connections: Connection[] = payload.connections.map((c) => ({
          id: c.id,
          sourceId: c.sourceId,
          targetId: c.targetId,
          buffer: [],
        }))

        setTopology(services, connections)
      })

    return () => {
      cancelled = true
    }
  }, [enabled, setTopology])
}

export const useLiveFeed = (enabled: boolean) => {
  useEffect(() => {
    if (!enabled) return

    const channel = supabase
      .channel(`signalscope:${projectSlug}`)
      .on("broadcast", { event: "events" }, (message) => {
        const { pushEvent, connectionsById } = useMapStore.getState()
        const events = (message.payload as { events: BroadcastEvent[] } | undefined)?.events
        if (!Array.isArray(events)) return

        for (const event of events) {
          // A message can name a connection this client has not loaded -- the
          // topology changed after we fetched it. Dropping the event is right:
          // there is no edge to draw it on, and the next topology load fixes it.
          if (!connectionsById[event.connectionId]) continue

          const request: RequestEvent = {
            timestamp: event.timestamp,
            success: event.success,
            latency: event.latency,
          }
          pushEvent(event.connectionId, request)
        }
      })
      .subscribe()

    // Pruning is local to this browser and independent of the socket: the tab
    // must not grow without bound just because it has been left open, and the
    // server's own retention says nothing about what this client is holding.
    const pruneTimer = setInterval(() => {
      useMapStore.getState().pruneEvents(Date.now() - PRUNE_WINDOW_MS)
    }, 10_000)

    return () => {
      clearInterval(pruneTimer)
      supabase.removeChannel(channel)
    }
  }, [enabled])
}
