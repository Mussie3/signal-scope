import type { ComponentType, SVGProps } from "react"
import ApiIcon from "@/shared/ui/icons/ApiIcon"
import CacheIcon from "@/shared/ui/icons/CacheIcon"
import DatabaseIcon from "@/shared/ui/icons/DatabaseIcon"
import FrontendIcon from "@/shared/ui/icons/FrontendIcon"
import ExternalIcon from "@/shared/ui/icons/ExternalIcon"
import type { ServiceKind } from "./types"

type Icon = ComponentType<SVGProps<SVGSVGElement>>

export const KIND_ICON: Record<ServiceKind, Icon> = {
    api: ApiIcon,
    database: DatabaseIcon,
    cache: CacheIcon,
    frontend: FrontendIcon,
    external: ExternalIcon,
}

export const KIND_LABEL: Record<ServiceKind, string> = {
    api: "API",
    database: "Database",
    cache: "Cache",
    frontend: "Frontend",
    external: "External",
}

// ---------------------------------------------------------------------------
// Read kinds through these, never by indexing the records directly.
//
// Topologies are DISCOVERED, so a kind arrives from the database and the
// database's enum can grow ahead of this file - which is exactly how 'frontend'
// and 'external' got added server-side while the sidebar still crashed on them.
// Indexing a Record with an unlisted key yields undefined, and rendering
// undefined as a component throws, so one unrecognised node took out the whole
// list. A missing icon should degrade to a generic one, not break the page.
// ---------------------------------------------------------------------------
export const kindIcon = (kind: ServiceKind | string): Icon =>
    KIND_ICON[kind as ServiceKind] ?? ApiIcon

export const kindLabel = (kind: ServiceKind | string): string =>
    KIND_LABEL[kind as ServiceKind] ?? "Service"

export const SERVICE_KINDS: ServiceKind[] = ["api", "database", "cache", "frontend", "external"]

/**
 * Narrow a kind arriving from the database. Asserting `as ServiceKind` at the
 * boundary - which is what this replaces - is a lie the compiler cannot catch:
 * the value is whatever Postgres says, and Postgres gained two enum values that
 * the UI had never heard of. Validating here means a future enum addition
 * renders as a generic service instead of taking out the component tree.
 */
export const asServiceKind = (value: unknown): ServiceKind =>
    SERVICE_KINDS.includes(value as ServiceKind) ? (value as ServiceKind) : "api"
