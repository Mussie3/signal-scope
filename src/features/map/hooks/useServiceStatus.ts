import { useShallow } from "zustand/shallow"
import { useFilterStore } from "@/shared/store/filter.store"
import { useNow } from "@/shared/hooks/useNow"
import { RANGE_TO_MS } from "@/shared/types/filter"
import { useMapStore } from "../store"
import { STATUS_COLORS } from "../constants"
import { deriveServiceStatus, STATUS_LABEL } from "../status"
import type { Connection, ServiceStatus } from "../types"

type ServiceStatusInfo = {
    status: ServiceStatus
    color: string
    label: string
    incoming: Connection[]
    rangeMs: number
    now: number
}

export const useServiceStatus = (serviceId: string): ServiceStatusInfo => {
    const incoming = useMapStore(useShallow(state =>
        state.connectionIds
            .map(id => state.connectionsById[id])
            .filter(c => c.targetId === serviceId),
    ))
    const range = useFilterStore(s => s.range)
    const now = useNow()
    const rangeMs = RANGE_TO_MS[range]
    const status = deriveServiceStatus(incoming, now, rangeMs)

    return {
        status,
        color: STATUS_COLORS[status],
        label: STATUS_LABEL[status],
        incoming,
        rangeMs,
        now,
    }
}
