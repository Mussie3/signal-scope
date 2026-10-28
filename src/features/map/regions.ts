/**
 * The lane third parties live in.
 *
 * Defined here rather than in the layout because the region table needs it to
 * build its lookups, and the layout needs the region table for lane labels —
 * putting it in the layout makes those two modules import each other.
 */
export const EXTERNAL_LANE = "__external__"

/**
 * Where a lane actually is.
 *
 * "eu-central-1" is a billing identifier, not a place. During an incident the
 * question is "is this the Frankfurt estate or the Virginia one", and a human
 * answers that from a city name far faster than from a provider's region slug.
 * The slug still gets shown — quietly, on the right — because that is what you
 * paste into a console.
 */
export const REGION_LABEL: Record<string, string> = {
    "eu-central-1": "Frankfurt",
    "us-east-1": "N. Virginia",
    "ap-southeast-1": "Singapore",
    unknown: "Unassigned",
    [EXTERNAL_LANE]: "Outside your system",
}

/** The code a lane header shows on the right, under its city name. */
export const REGION_CODE: Record<string, string> = {
    unknown: "region not declared",
    [EXTERNAL_LANE]: "third parties",
}

/**
 * Two letters, so a sidebar row costs one line instead of two.
 *
 * A list of fifty services that each spend a second line on "API ·
 * EU-CENTRAL-1" shows half as many services in the same column, and the thing
 * you are scanning for is the name, not the region.
 */
export const REGION_SHORT: Record<string, string> = {
    "eu-central-1": "EU",
    "us-east-1": "US",
    "ap-southeast-1": "AP",
    unknown: "—",
    "third-party": "EXT",
}

export const regionLabel = (key: string): string => REGION_LABEL[key] ?? key
export const regionCode = (key: string): string => REGION_CODE[key] ?? key
export const regionShort = (key: string): string => REGION_SHORT[key] ?? key.slice(0, 2).toUpperCase()

/**
 * Where a lane sits, left to right.
 *
 * Driven by the order the regions are declared above rather than by the region
 * key, because sorting by key puts ap-southeast-1 first and nobody thinks of
 * their estate as starting in Singapore. A region nobody declared sorts after
 * the known ones, alphabetically, so the order is still stable.
 */
const DECLARED = Object.keys(REGION_LABEL)

export const compareRegions = (a: string, b: string): number => {
    const ia = DECLARED.indexOf(a)
    const ib = DECLARED.indexOf(b)
    if (ia !== -1 && ib !== -1) return ia - ib
    if (ia !== -1) return -1
    if (ib !== -1) return 1
    return a.localeCompare(b)
}
