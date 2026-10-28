import { useEffect, useState } from "react"
import { supabase } from "@/shared/api/supabase"
import type { Session } from "@supabase/supabase-js"

/**
 * Who, if anyone, is signed in.
 *
 * Signing in is OPTIONAL here, which is unusual and deliberate. The public
 * demo has to render for someone who has never had an account, so anon is a
 * first-class reader rather than a locked-out state. What signing in changes
 * is only which projects are visible, and that is enforced by RLS -- the
 * policy is `is_public or owner_id = auth.uid()`, so the client never decides
 * what you may see, it only asks.
 */
export const useSession = () => {
    const [session, setSession] = useState<Session | null>(null)
    // Distinguishes "no session" from "we have not asked yet". Without it the
    // UI flashes a signed-out state for every signed-in visitor on every load.
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let cancelled = false

        supabase.auth.getSession().then(({ data }) => {
            if (cancelled) return
            setSession(data.session)
            setLoading(false)
        })

        const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
            setSession(next)
            setLoading(false)
        })

        return () => {
            cancelled = true
            sub.subscription.unsubscribe()
        }
    }, [])

    return { session, loading, email: session?.user.email ?? null }
}
