import { create } from "zustand"
import { Service, Connection, RequestEvent, Position } from "./types"
import { seedServices, seedConnections } from "./seed"
import { runForceLayout } from "./layout"

export type LayoutMode = "manual" | "auto"

export type HoveredEntity =
    | { kind: "service"; id: string }
    | { kind: "connection"; id: string }
    | null

type MapState = {
    servicesById: Record<string, Service>
    connectionsById: Record<string, Connection>
    serviceIds: string[]
    connectionIds: string[]
    selectedServiceId: string | null
    hoveredEntity: HoveredEntity
    layoutMode: LayoutMode
    pushEvent: (connectionId: string, event: RequestEvent) => void
    pruneEvents: (beforeTimestamp: number) => void
    selectService: (id: string | null) => void
    setHoveredEntity: (entity: HoveredEntity) => void
    setLayoutMode: (mode: LayoutMode) => void
    setTopology: (services: Service[], connections: Connection[]) => void
}

// The positions "manual" layout mode restores. It starts as the local seed and
// is replaced when a remote topology loads, so switching auto -> manual returns
// to the positions the backend actually holds rather than the demo's.
let manualPositionsById: Record<string, Position> = Object.fromEntries(
    seedServices.map(s => [s.id, s.position]),
)

export const useMapStore = create<MapState>((set, get) => ({
    servicesById: Object.fromEntries(seedServices.map(s => [s.id, s])),
    connectionsById: Object.fromEntries(seedConnections.map(c => [c.id, c])),
    serviceIds: seedServices.map(s => s.id),
    connectionIds: seedConnections.map(c => c.id),
    selectedServiceId: null,
    hoveredEntity: null,
    layoutMode: "manual",
    pushEvent: (connectionId, event) => {
        set((state) => ({
            connectionsById: {
                ...state.connectionsById,
                [connectionId]: {
                    ...state.connectionsById[connectionId],
                    buffer: [...state.connectionsById[connectionId].buffer, event]
                }
            }
        }))
    },
    pruneEvents: (beforeTimestamp) => {
        set((state) => ({
             connectionsById: Object.fromEntries(
                Object.entries(state.connectionsById).map(([id, conn]) => [
                    id,
                    { ...conn, buffer: conn.buffer.filter(e => e.timestamp >= beforeTimestamp) }
                ])
             )
        }))
    },
    setTopology: (services, connections) => {
        manualPositionsById = Object.fromEntries(services.map(s => [s.id, s.position]))
        set({
            servicesById: Object.fromEntries(services.map(s => [s.id, s])),
            connectionsById: Object.fromEntries(connections.map(c => [c.id, c])),
            serviceIds: services.map(s => s.id),
            connectionIds: connections.map(c => c.id),
            // A topology swap can orphan the current selection, and a right
            // panel pointed at a service that no longer exists renders nothing.
            selectedServiceId: null,
            hoveredEntity: null,
        })
    },
    selectService: (id) => set({ selectedServiceId: id }),
    setHoveredEntity: (entity) => set({ hoveredEntity: entity }),
    setLayoutMode: (mode) => {
        const state = get()
        const positions = mode === "auto"
            ? runForceLayout(
                state.serviceIds.map(id => state.servicesById[id]),
                state.connectionIds.map(id => state.connectionsById[id]),
            )
            : manualPositionsById
        set({
            layoutMode: mode,
            servicesById: Object.fromEntries(
                state.serviceIds.map(id => [
                    id,
                    { ...state.servicesById[id], position: positions[id] },
                ]),
            ),
        })
    },
}))
