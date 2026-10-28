import { useState } from "react"
import { supabase } from "@/shared/api/supabase"
import { useSession } from "@/shared/store/session.store"

/**
 * Create a project, and mint the key that feeds it.
 *
 * This exists because the alternative was the Supabase SQL editor, and the SQL
 * editor runs as the postgres role where auth.uid() is NULL. Every helper the
 * schema provides is written for a signed-in user: projects.owner_id defaults
 * to auth.uid(), and create_publishable_key matches on it. Run from the
 * dashboard they produce an ownerless project that nobody -- including its
 * creator -- can ever see, and a key that cannot be minted at all.
 *
 * So the only place project setup can correctly happen is inside a session,
 * which means inside this app. Doing it here is not a convenience; it is the
 * only correct place for it.
 */
const NewProject = () => {
    const { session } = useSession()
    const [open, setOpen] = useState(false)
    const [slug, setSlug] = useState("")
    const [origins, setOrigins] = useState("")
    const [busy, setBusy] = useState(false)
    const [token, setToken] = useState<string | null>(null)
    const [note, setNote] = useState<string | null>(null)

    if (!session) return null

    const create = async () => {
        setBusy(true)
        setNote(null)
        setToken(null)
        try {
            // owner_id is left to its default, which is auth.uid(). Setting it
            // explicitly here would just be the client restating something the
            // database already knows and the RLS check already enforces.
            const { error: insErr } = await supabase
                .from("projects")
                .insert({ slug, name: slug, is_public: false, simulated: false })
            // An existing project is not a failure worth stopping for: the
            // common case is coming back to mint another key.
            if (insErr && !insErr.message.includes("duplicate")) throw new Error(insErr.message)

            // The origins are where the MONITORED app runs, which is almost
            // never this one. Defaulting to location.origin looked convenient
            // and produced a key that 403s from the only site it was meant for
            // -- the tool cannot guess this, so it has to ask.
            const list = origins
                .split(/[,\s]+/)
                .map(o => o.trim().replace(/\/$/, ""))
                .filter(Boolean)

            const { data, error: keyErr } = await supabase.rpc("create_publishable_key", {
                p_slug: slug,
                p_origins: list,
                p_name: "browser",
            })
            if (keyErr) throw new Error(keyErr.message)

            setToken((data as { token: string }).token)
            setNote("Copy this now. It is shown once and is not recoverable.")
        } catch (err) {
            setNote(err instanceof Error ? err.message : "Could not create the project")
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className="h-8 rounded-md border px-2.5 text-xs font-medium"
                style={{ borderColor: "var(--ss-border)", background: "var(--ss-card)", color: "var(--ss-foreground)" }}
            >
                New project
            </button>

            {open && (
                <div
                    className="absolute right-0 z-20 mt-1 w-80 rounded-lg border p-3 shadow-lg"
                    style={{ borderColor: "var(--ss-border)", background: "var(--ss-card)" }}
                >
                    <p className="pb-2 text-[11px] leading-relaxed" style={{ color: "var(--ss-muted-foreground)" }}>
                        A short name, lowercase and hyphenated. It becomes the project slug and the
                        <code className="px-1">?project=</code> value.
                    </p>
                    <input
                        placeholder="ice-tracker"
                        value={slug}
                        onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                        className="mb-2 h-8 w-full rounded-md border px-2 font-mono text-xs outline-none"
                        style={{ borderColor: "var(--ss-border)", background: "var(--ss-muted)", color: "var(--ss-foreground)" }}
                    />
                    <p className="pb-1 text-[11px] leading-relaxed" style={{ color: "var(--ss-muted-foreground)" }}>
                        Origins allowed to report, comma separated. These are where the app you are
                        monitoring runs, not where this page is.
                    </p>
                    <input
                        placeholder="https://your-app.com, http://localhost:5173"
                        value={origins}
                        onChange={e => setOrigins(e.target.value)}
                        className="mb-2 h-8 w-full rounded-md border px-2 font-mono text-[11px] outline-none"
                        style={{ borderColor: "var(--ss-border)", background: "var(--ss-muted)", color: "var(--ss-foreground)" }}
                    />
                    <button
                        type="button"
                        disabled={busy || !origins.trim() || !/^[a-z0-9][a-z0-9-]{0,62}$/.test(slug)}
                        onClick={create}
                        className="h-7 w-full rounded-md text-xs font-medium disabled:opacity-40"
                        style={{ background: "var(--health-healthy)", color: "var(--ss-background)" }}
                    >
                        {busy ? "Creating..." : "Create and mint a key"}
                    </button>

                    {token && (
                        <textarea
                            readOnly
                            value={token}
                            onFocus={e => e.currentTarget.select()}
                            className="mt-2 h-14 w-full resize-none rounded-md border p-2 font-mono text-[11px]"
                            style={{ borderColor: "var(--health-slow)", background: "var(--ss-muted)", color: "var(--ss-foreground)" }}
                        />
                    )}
                    {note && (
                        <p className="mt-2 text-[11px] leading-relaxed" style={{ color: token ? "var(--health-slow)" : "var(--health-failing)" }}>
                            {note}
                        </p>
                    )}
                </div>
            )}
        </div>
    )
}

export default NewProject
