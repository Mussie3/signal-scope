// Mirrors the service_kind enum in Postgres. 'frontend' and 'external' were
// added when topologies started being derived from OpenTelemetry traces: a
// browser is an entry point rather than an API, and a third party is something
// you can observe but not fix.
export type ServiceKind = "api" | "database" | "cache" | "frontend" | "external"
export type Position = {
    x: number,
    y: number
}
export type Service = {
    id: string,
    name: string,
    kind: ServiceKind,
    // Free text, not a closed union: a derived topology reports whatever the
    // OTel resource declared as cloud.region, or "unknown".
    region: string,
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
