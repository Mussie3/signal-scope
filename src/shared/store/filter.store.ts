import { create } from "zustand";
import { ALL_REGIONS, Range } from "@/shared/types/filter";

type FilterState = {
    // A free-text region, or ALL_REGIONS for "no filter". Not a closed union:
    // the available regions depend on what the topology actually reported.
    region: string
    range: Range
    search: string
    setRegion: (region: string) => void
    setRange: (range: Range) => void
    setSearch: (search: string) => void
}

export const useFilterStore = create<FilterState>((set) => ({
    region: ALL_REGIONS,
    setRegion: (region) => set({region}),
    range: "Last 1 minute",
    setRange: (range) => set({range}),
    search: "",
    setSearch: (search) => set({search}),
}))
