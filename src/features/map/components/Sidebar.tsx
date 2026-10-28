import { useFilterStore } from "@/shared/store/filter.store"
import { useFilteredServices } from "../hooks/useFilteredServices"
import { useBlastRadius } from "../hooks/useBlastRadius"
import { useModeStore } from "../mode.store"
import { compareRegions, regionLabel } from "../regions"
import { ALL_REGIONS } from "@/shared/types/filter"
import SearchIcon from "@/shared/ui/icons/SearchIcon"
import ServiceListItem from "./ServiceListItem"
import type { Service } from "../types"

const SectionHeading = ({ children, accent }: { children: React.ReactNode; accent?: boolean }) => (
    <h3
        className="px-2.5 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.12em]"
        style={{ color: accent ? "var(--health-failing)" : "var(--ss-muted-foreground)" }}
    >
        {children}
    </h3>
)

/**
 * Find a service by name.
 *
 * Lives in the sidebar rather than the top bar because it filters the list
 * directly below it. In the top bar the same control sat beside region and
 * window pickers that filter the map, and it was unclear which surface any of
 * them acted on.
 */
const FindService = () => {
    const search = useFilterStore(s => s.search)
    const setSearch = useFilterStore(s => s.setSearch)

    return (
        <div
            className="mx-2.5 mt-2.5 flex h-9 items-center gap-2 rounded-lg border px-2.5"
            style={{ borderColor: "var(--ss-border)", background: "var(--ss-muted)" }}
        >
            <SearchIcon className="h-4 w-4 shrink-0 opacity-50" />
            <input
                className="w-full bg-transparent font-mono text-[13px] outline-none placeholder:opacity-45"
                placeholder="Find a service..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                aria-label="Find a service"
            />
        </div>
    )
}

/**
 * The broken things go first.
 *
 * An alphabetical list of every service is a directory, not a monitoring tool:
 * during an incident it makes someone scan for the thing they already know is
 * wrong. Surfacing what needs attention — and how far it reaches — is the
 * sidebar earning its width.
 */
const Sidebar = () => {
    const services = useFilteredServices()
    const search = useFilterStore(s => s.search)
    const region = useFilterStore(s => s.region)
    const mode = useModeStore(s => s.mode)
    const { unhealthy, affected } = useBlastRadius()

    // Ambient is read from across a room; a list of names is unreadable there
    // and the map is the whole point.
    if (mode === "ambient") return null

    const unhealthySet = new Set(unhealthy)
    const attention = services.filter(s => unhealthySet.has(s.id))
    const rest = services.filter(s => !unhealthySet.has(s.id))

    // Group the remainder by region, so position in the list matches position
    // on the map.
    const byRegion = new Map<string, Service[]>()
    for (const s of rest) {
        const key = s.region || "unknown"
        const list = byRegion.get(key)
        if (list) list.push(s)
        else byRegion.set(key, [s])
    }
    // Same order as the lanes, so scanning down the list walks the map
    // left to right instead of jumping between columns.
    const regionKeys = [...byRegion.keys()].sort(compareRegions)

    return (
        <aside
            className="h-full w-64 flex-none overflow-y-auto border-r pb-4"
            style={{ background: "var(--ss-card)", borderColor: "var(--ss-border)", color: "var(--ss-foreground)" }}
        >
            <FindService />

            {attention.length > 0 && (
                <>
                    <SectionHeading accent>Needs attention · {attention.length}</SectionHeading>
                    <ul className="px-1.5">
                        {attention.map(s => (
                            <li key={s.id}><ServiceListItem service={s} /></li>
                        ))}
                    </ul>
                    {affected.size > 0 && (
                        <p className="px-2.5 pb-2 pt-2 text-[11px] leading-relaxed" style={{ color: "var(--ss-muted-foreground)" }}>
                            <strong style={{ color: "var(--ss-foreground)" }}>Blast radius:</strong>{" "}
                            {affected.size} {affected.size === 1 ? "service depends" : "services depend"} on
                            something failing, slow or down.
                        </p>
                    )}
                </>
            )}

            {services.length === 0 && (
                <p className="px-3 py-8 text-center text-sm" style={{ color: "var(--ss-muted-foreground)" }}>
                    No services match
                    {search && <span className="mt-1 block truncate font-medium">“{search}”</span>}
                    {region !== ALL_REGIONS && <span className="mt-1 block font-medium">in {regionLabel(region)}</span>}
                </p>
            )}

            {regionKeys.map(key => (
                <div key={key}>
                    <SectionHeading>{regionLabel(key)}</SectionHeading>
                    <ul className="px-1.5 pb-1">
                        {byRegion.get(key)!.map(s => (
                            <li key={s.id}>
                                <ServiceListItem service={s} />
                            </li>
                        ))}
                    </ul>
                </div>
            ))}
        </aside>
    )
}

export default Sidebar
