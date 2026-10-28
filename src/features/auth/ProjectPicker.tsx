import { useEffect, useState } from "react"
import { supabase, projectSlug } from "@/shared/api/supabase"
import { useSession } from "@/shared/store/session.store"

type Row = { slug: string; name: string; is_public: boolean }

/**
 * Which estate you are looking at.
 *
 * The list comes straight from a select on projects, with no filtering here at
 * all: the RLS policy is `is_public or owner_id = auth.uid()`, so the rows
 * that come back ARE the rows you may see. Deciding that client-side would
 * mean two implementations of the same rule, and the wrong one would be the
 * one people trust.
 *
 * Switching navigates rather than setting state, because the project is read
 * from the URL. That keeps a map shareable: the link you send someone opens
 * what you were looking at.
 */
const ProjectPicker = () => {
    const { session } = useSession()
    const [rows, setRows] = useState<Row[]>([])

    useEffect(() => {
        let cancelled = false
        supabase
            .from("projects")
            .select("slug,name,is_public")
            .order("name")
            .then(({ data, error }) => {
                if (cancelled || error || !data) return
                setRows(data as Row[])
            })
        return () => { cancelled = true }
        // Re-runs on sign in and sign out, because the readable set changes.
    }, [session?.user.id])

    // One readable project is not a choice worth a control.
    if (rows.length < 2) return null

    return (
        <select
            aria-label="Project"
            value={projectSlug}
            onChange={e => {
                const url = new URL(location.href)
                url.searchParams.set("project", e.target.value)
                location.assign(url.toString())
            }}
            className="h-8 rounded-md border px-2 text-sm outline-none"
            style={{ borderColor: "var(--ss-border)", background: "var(--ss-card)", color: "var(--ss-foreground)" }}
        >
            {rows.map(r => (
                <option key={r.slug} value={r.slug}>
                    {r.name}{r.is_public ? "" : " (private)"}
                </option>
            ))}
        </select>
    )
}

export default ProjectPicker
