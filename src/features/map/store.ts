import { create } from "zustand"
import { Service, Connection, RequestEvent, Position } from "./types"
import { seedServices, seedConnections } from "./seed"
import { computeLayout, type Lane } from "./layout"

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
    /** Lane chrome for the map. Empty in manual mode, which has no lanes. */
    lanes: Lane[]
    canvas: { width: number; height: number }
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

// Laid out at module load: the default mode is "auto", so the very first paint
// has to already be layered. Without this the map renders at whatever positions
// the data happened to carry — which, for a topology derived from traces, is
// (0,0) for every single node.
const initialLayout = computeLayout(seedServices, seedConnections)

export const useMapStore = create<MapState>((set, get) => ({
    servicesById: Object.fromEntries(
        seedServices.map(s => [s.id, { ...s, position: initialLayout.positions[s.id] ?? s.position }]),
    ),
    connectionsById: Object.fromEntries(seedConnections.map(c => [c.id, c])),
    serviceIds: seedServices.map(s => s.id),
    connectionIds: seedConnections.map(c => c.id),
    selectedServiceId: null,
    hoveredEntity: null,
    // Layered is the default now: a derived topology has no hand-placed
    // positions to fall back on, so "manual" is only meaningful for the seeded
    // demo.
    layoutMode: "auto",
    lanes: initialLayout.lanes,
    canvas: { width: initialLayout.width, height: initialLayout.height },
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
        const auto = get().layoutMode === "auto"
        const result = auto ? computeLayout(services, connections) : null
        set({
            servicesById: Object.fromEntries(
                services.map(s => [s.id, result ? { ...s, position: result.positions[s.id] ?? { x: 0, y: 0 } } : s]),
            ),
            connectionsById: Object.fromEntries(connections.map(c => [c.id, c])),
            serviceIds: services.map(s => s.id),
            connectionIds: connections.map(c => c.id),
            lanes: result ? result.lanes : [],
            canvas: result ? { width: result.width, height: result.height } : { width: 0, height: 0 },
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
        if (mode === "manual") {
            set({
                layoutMode: mode,
                lanes: [],
                servicesById: Object.fromEntries(
                    state.serviceIds.map(id => [
                        id,
                        { ...state.servicesById[id], position: manualPositionsById[id] ?? { x: 0, y: 0 } },
                    ]),
                ),
            })
            return
        }
        const result = computeLayout(
            state.serviceIds.map(id => state.servicesById[id]),
            state.connectionIds.map(id => state.connectionsById[id]),
        )
        set({
            layoutMode: mode,
            lanes: result.lanes,
            canvas: { width: result.width, height: result.height },
            servicesById: Object.fromEntries(
                state.serviceIds.map(id => [
                    id,
                    { ...state.servicesById[id], position: result.positions[id] ?? { x: 0, y: 0 } },
                ]),
            ),
        })
    },
}))
