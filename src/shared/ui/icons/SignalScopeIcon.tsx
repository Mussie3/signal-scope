import type { SVGProps } from "react"

/**
 * A ring with a dot: a scope, and the thing it has found.
 *
 * The old mark drew three branches in a hardcoded #22c55e, which was wrong
 * twice over — it ignored the theme, and it put green on a surface whose whole
 * palette avoids green so that red/green colour blindness cannot hide a
 * failure. The mark now takes its colour from the healthy token like
 * everything else.
 */
const SignalScopeIcon = (props: SVGProps<SVGSVGElement>) => (
    <svg viewBox="-12 -12 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" {...props}>
        <circle r={10} fill="none" stroke="currentColor" strokeWidth={2} />
        <circle r={3.5} fill="currentColor" />
    </svg>
)

export default SignalScopeIcon
