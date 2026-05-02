import { create } from "zustand"
import { Service, Connection, RequestEvent } from "./types"
import { seedServices, seedConnections } from "./seed"
import { runForceLayout } from "./layout"

export type LayoutMode = "manual" | "auto"

type MapState = {
    servicesById: Record<string, Service>
    connectionsById: Record<string, Connection>
    serviceIds: string[]
    connectionIds: string[]
    selectedServiceId: string | null
    layoutMode: LayoutMode
    pushEvent: (connectionId: string, event: RequestEvent) => void
    pruneEvents: (beforeTimestamp: number) => void
    selectService: (id: string | null) => void
    setLayoutMode: (mode: LayoutMode) => void
}

const seedPositionsById = Object.fromEntries(
    seedServices.map(s => [s.id, s.position]),
)

export const useMapStore = create<MapState>((set, get) => ({
    servicesById: Object.fromEntries(seedServices.map(s => [s.id, s])),
    connectionsById: Object.fromEntries(seedConnections.map(c => [c.id, c])),
    serviceIds: seedServices.map(s => s.id),
    connectionIds: seedConnections.map(c => c.id),
    selectedServiceId: null,
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
    selectService: (id) => set({ selectedServiceId: id }),
    setLayoutMode: (mode) => {
        const state = get()
        const positions = mode === "auto"
            ? runForceLayout(
                state.serviceIds.map(id => state.servicesById[id]),
                state.connectionIds.map(id => state.connectionsById[id]),
            )
            : seedPositionsById
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
