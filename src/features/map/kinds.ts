import type { ComponentType, SVGProps } from "react"
import ApiIcon from "@/shared/ui/icons/ApiIcon"
import CacheIcon from "@/shared/ui/icons/CacheIcon"
import DatabaseIcon from "@/shared/ui/icons/DatabaseIcon"
import type { ServiceKind } from "./types"

export const KIND_ICON: Record<ServiceKind, ComponentType<SVGProps<SVGSVGElement>>> = {
    api: ApiIcon,
    database: DatabaseIcon,
    cache: CacheIcon,
}

export const KIND_LABEL: Record<ServiceKind, string> = {
    api: "API",
    database: "Database",
    cache: "Cache",
}
