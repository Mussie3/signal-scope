export type ServiceKind = "api" | "database" | "cache"
export type Position = {
    x: number,
    y: number
}
export type Service = {
    id: string,
    name: string,
    kind: ServiceKind,
    position: Position
}
export type RequestEvent = {
    timestamp: number,
    success: boolean,
    latency: number
}
export type Connection = {
    id: string,
    sourceId: string,
    targetId: string,
    buffer: RequestEvent[]
}

export type ServiceStatus = "no_data" | "healthy" | "slow" | "failing" | "down"
