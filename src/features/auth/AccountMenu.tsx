import { useCallback, useRef, useState } from "react"
import { supabase } from "@/shared/api/supabase"
import { useSession } from "@/shared/store/session.store"
import useDismiss from "@/shared/hooks/useDismiss"

/**
 * Sign in, or say who you are.
 *
 * Deliberately small and tucked into the corner. Signing in is not the point
 * of this screen -- the map is -- and an auth wall in front of a public demo
 * would lose the visitor it exists for. This only unlocks the projects RLS
 * already scopes to you.
 */
const AccountMenu = () => {
    const { session, loading, email } = useSession()
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)
    // useCallback so the listener is not torn down and rebuilt every render.
    const close = useCallback(() => setOpen(false), [])
    const [addr, setAddr] = useState("")
    const [pw, setPw] = useState("")
    const [busy, setBusy] = useState(false)
    const [note, setNote] = useState<string | null>(null)

    useDismiss({ ref, enabled: open, onDismiss: close })

    // Nothing at all until the session is known, so a signed-in visitor never
    // sees a "Sign in" button flash before their email appears.
    if (loading) return null

    if (session) {
        return (
            <button
                type="button"
                onClick={() => supabase.auth.signOut()}
                title={`Signed in as ${email}. Click to sign out.`}
                className="h-8 rounded-md border px-2.5 font-mono text-xs"
                style={{ borderColor: "var(--ss-border)", background: "var(--ss-card)", color: "var(--ss-muted-foreground)" }}
            >
                {email?.split("@")[0]} · sign out
            </button>
        )
    }

    const submit = async (mode: "in" | "up") => {
        setBusy(true)
        setNote(null)
        try {
        // Called through supabase.auth, NOT detached into a variable first.
        //
        // `const fn = supabase.auth.signUp` loses `this`, and supabase-js
        // reaches for this.storage immediately -- so it threw before sending a
        // request and the button silently did nothing. Worse, the throw
        // escaped the destructure below, so even the error state never showed.
        const { error } = mode === "in"
            ? await supabase.auth.signInWithPassword({ email: addr, password: pw })
            : await supabase.auth.signUp({ email: addr, password: pw })

        setBusy(false)
        if (error) {
            setNote(error.message)
            return
        }
        // Sign-up may or may not need an email confirmation depending on the
        // project's settings, so say what happened rather than assuming.
        setNote(mode === "up" ? "Check your email if confirmation is required." : null)
        if (mode === "in") setOpen(false)
        } catch (err) {
            // Anything unexpected still has to reach the person pressing the
            // button. A form that goes quiet is indistinguishable from one
            // that is ignoring you.
            setBusy(false)
            setNote(err instanceof Error ? err.message : "Something went wrong")
        }
    }

    return (
        <div className="relative" ref={ref}>
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className="h-8 rounded-md border px-2.5 text-xs font-medium"
                style={{ borderColor: "var(--ss-border)", background: "var(--ss-card)", color: "var(--ss-foreground)" }}
            >
                Sign in
            </button>

            {open && (
                <div
                    className="absolute right-0 z-20 mt-1 w-64 rounded-lg border p-3 shadow-lg"
                    style={{ borderColor: "var(--ss-border)", background: "var(--ss-card)" }}
                >
                    <p className="pb-2 text-[11px] leading-relaxed" style={{ color: "var(--ss-muted-foreground)" }}>
                        The demo is public. Sign in to see your own projects.
                    </p>
                    <input
                        type="email"
                        placeholder="you@example.com"
                        value={addr}
                        onChange={e => setAddr(e.target.value)}
                        className="mb-1.5 h-8 w-full rounded-md border px-2 text-xs outline-none"
                        style={{ borderColor: "var(--ss-border)", background: "var(--ss-muted)", color: "var(--ss-foreground)" }}
                    />
                    <input
                        type="password"
                        placeholder="password"
                        value={pw}
                        onChange={e => setPw(e.target.value)}
                        className="mb-2 h-8 w-full rounded-md border px-2 text-xs outline-none"
                        style={{ borderColor: "var(--ss-border)", background: "var(--ss-muted)", color: "var(--ss-foreground)" }}
                    />
                    <div className="flex gap-1.5">
                        <button
                            type="button"
                            disabled={busy || !addr || !pw}
                            onClick={() => submit("in")}
                            className="h-7 flex-1 rounded-md text-xs font-medium disabled:opacity-40"
                            style={{ background: "var(--health-healthy)", color: "var(--ss-background)" }}
                        >
                            Sign in
                        </button>
                        <button
                            type="button"
                            disabled={busy || !addr || !pw}
                            onClick={() => submit("up")}
                            className="h-7 flex-1 rounded-md border text-xs disabled:opacity-40"
                            style={{ borderColor: "var(--ss-border)", color: "var(--ss-foreground)" }}
                        >
                            Create
                        </button>
                    </div>
                    {note && (
                        <p className="mt-2 text-[11px] leading-relaxed" style={{ color: "var(--health-slow)" }}>
                            {note}
                        </p>
                    )}
                </div>
            )}
        </div>
    )
}

export default AccountMenu
