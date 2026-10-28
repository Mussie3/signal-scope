import { useShallow } from "zustand/shallow"
import { useFilterStore } from "@/shared/store/filter.store"
import { RANGE_TO_MS } from "@/shared/types/filter"
import { useMapStore } from "../store"
import { STATUS_COLORS } from "../constants"
import { deriveServiceStatus, STATUS_LABEL } from "../status"
import { useStatusTime } from "./useStatusTime"
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
        (state.incomingIdsByTarget[serviceId] ?? []).map(id => state.connectionsById[id]),
    ))
    const range = useFilterStore(s => s.range)
    const now = useStatusTime()
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
