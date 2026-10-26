import { useFilterStore } from "@/shared/store/filter.store"
import { useThemeStore } from "@/shared/store/theme.store"
import { DropDownItem } from "@/shared/types/component"
import { Range } from "@/shared/types/filter"
import { useAvailableRegions } from "@/features/map/hooks/useRegionFilter"
import DropDown from "@/shared/ui/DropDown"
import Search from "@/shared/ui/Search"
import ToggleButton from "@/shared/ui/ToggleButton"
import SignalScopeIcon from "@/shared/ui/icons/SignalScopeIcon"

const RANGES: Range[] = [
    "Last 30 seconds",
    "Last 1 minute",
    "Last 5 minutes",
    "Last 15 minutes",
]

const TopBar = () => {
    const theme = useThemeStore((state) => state.theme)
    const { region, setRegion, range, setRange } = useFilterStore()
    // Options come from the topology, not a hardcoded list: derived regions are
    // whatever the traces reported, so a fixed list matches nothing.
    const regions = useAvailableRegions()
    const isDark = theme === "dark"

    const dropdownRegionItems: DropDownItem[] = regions.map(r => ({
        label: r,
        onSelect: () => setRegion(r),
    }))

    const dropdownRangeItems: DropDownItem[] = RANGES.map(r => ({
        label: r,
        onSelect: () => setRange(r),
    }))

    return (
        <section
            id="header"
            className={`w-full h-16 flex items-center px-4 gap-4 border-b transition-colors flex-none ${
                isDark
                    ? "bg-black text-white border-white/10"
                    : "bg-white text-black border-black/10"
            }`}
        >
            <div className="flex items-center gap-2 flex-none">
                <SignalScopeIcon className="w-8 h-8" />
                <h1 className="text-xl font-montserrat font-medium">SignalScope</h1>
            </div>
            <div className="flex-1 flex justify-center">
                <Search />
            </div>
            <div className="flex items-center gap-2 flex-none">
                <DropDown label={region} items={dropdownRegionItems} />
                <DropDown label={range} items={dropdownRangeItems} />
                <ToggleButton />
            </div>
        </section>
    )
}

export default TopBar
