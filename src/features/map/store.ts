import { create } from "zustand"
import { Service, Connection, RequestEvent } from "./types"
import { seedServices, seedConnections } from "./seed"


type MapState = {
    servicesById: Record<string, Service>
    connectionsById: Record<string, Connection>
    serviceIds: string[]
    connectionIds: string[]
    pushEvent: (connectionId: string, event: RequestEvent) => void
    pruneEvents: (beforeTimestamp: number) => void
}

export const useMapStore = create<MapState>((set) => ({
    servicesById: Object.fromEntries(seedServices.map(s => [s.id, s])),
    connectionsById: Object.fromEntries(seedConnections.map(c => [c.id, c])),
    serviceIds: seedServices.map(s => s.id),
    connectionIds: seedConnections.map(c => c.id),
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
    }
}))