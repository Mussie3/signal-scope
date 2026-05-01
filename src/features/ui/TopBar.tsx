import { useFilterStore } from "@/shared/store/filter.store"
import { useThemeStore } from "@/shared/store/theme.store"
import { DropDownItem } from "@/shared/types/component"
import DropDown from "@/shared/ui/DropDown"
import Search from "@/shared/ui/Search"
import ToggleButton from "@/shared/ui/ToggleButton"
import SignalScopeIcon from "@/shared/ui/icons/SignalScopeIcon"

const TopBar = () => {
    const theme = useThemeStore((state) => state.theme)
    const { region, setRegion, range, setRange } = useFilterStore()
    const isDark = theme === "dark"

    const dropdownRegionItems: DropDownItem[] = [
        {
            label: "All Region",
            onSelect: () => setRegion("All Region")
        },
        {
            label: "US East",
            onSelect: () => setRegion("US East")
        },
        {
            label: "US West",
            onSelect: () => setRegion("US West")
        },
        {
            label: "EU Central",
            onSelect: () => setRegion("EU Central")
        },
        {
            label: "Asia Pacific",
            onSelect: () => setRegion("Asia Pacific")
        }
    ]

    const dropdownRangeItems: DropDownItem[] = [
        {
            label: "Last 1 minute",
            onSelect: () => setRange("Last 1 minute")
        },
        {
            label: "Last 5 minutes",
            onSelect: () => setRange("Last 5 minutes")
        },
        {
            label: "Last 15 minutes",
            onSelect: () => setRange("Last 15 minutes")
        },
        {
            label: "Last 1 hour",
            onSelect: () => setRange("Last 1 hour")
        },
        {
            label: "Last 24 hours",
            onSelect: () => setRange("Last 24 hours")
        }
    ]

    return (
        <section
            id="header"
            className={`w-full h-16 flex items-center p-2 transition-colors ${
                isDark ? "bg-black text-white" : "bg-white text-black"
            }`}
        >
            <div className="flex items-center gap-2">
                <SignalScopeIcon className="w-12 h-12" />
                <h1 className="text-3xl font-montserrat font-[500]">SignalScope</h1>
            </div>
            <div>
                <Search />
            </div>
            <ToggleButton />
            <DropDown label={region} items={dropdownRegionItems} />
            <DropDown label={range} items={dropdownRangeItems} />
        </section>
    )
}

export default TopBar
