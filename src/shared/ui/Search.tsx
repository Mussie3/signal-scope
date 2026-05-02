import { useFilterStore } from "@/shared/store/filter.store"
import { useThemeStore } from "@/shared/store/theme.store"
import SearchIcon from "@/shared/ui/icons/SearchIcon"

const Search = () => {
    const theme = useThemeStore((state) => state.theme)
    const search = useFilterStore((state) => state.search)
    const setSearch = useFilterStore((state) => state.setSearch)
    const isDark = theme === "dark"

    return (
        <div
            className={`w-98 h-10 px-3 flex items-center gap-2 rounded-xl border transition-colors ${
                isDark
                    ? "bg-white/[0.10] border-white/20 focus-within:ring-white/30"
                    : "bg-black/[0.04] border-black/10 focus-within:ring-black/20"
            }`}
        >
            <SearchIcon className="w-5 h-5 opacity-60" />
            <input
                className="bg-transparent outline-none w-full placeholder:opacity-50"
                placeholder="Search services..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
            />
        </div>
    )
}

export default Search
