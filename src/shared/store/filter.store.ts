import { create } from "zustand";
import { Region, Range } from "@/shared/types/filter";

type FilterState = {
    region: Region
    range: Range
    search: string
    setRegion: (region: Region) => void
    setRange: (range: Range) => void
    setSearch: (search: string) => void
}

export const useFilterStore = create<FilterState>((set) => ({
    region: "All Region",
    setRegion: (region) => set({region}),
    range: "Last 1 minute",
    setRange: (range) => set({range}),
    search: "",
    setSearch: (search) => set({search}),
}))