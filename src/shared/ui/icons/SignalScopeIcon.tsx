import type { SVGProps } from "react"

const SignalScopeIcon = (props: SVGProps<SVGSVGElement>) => (
    <svg
        viewBox="0 0 32 32"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        {...props}
    >
        <circle cx="16" cy="16" r="9" stroke="currentColor" strokeOpacity="0.15" strokeWidth="1" />
        <circle cx="16" cy="16" r="6" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1" />

        <line x1="16" y1="16" x2="16" y2="6" stroke="#22c55e" strokeWidth="1.6" strokeLinecap="round" />
        <line x1="16" y1="16" x2="7" y2="22" stroke="#22c55e" strokeWidth="1.6" strokeLinecap="round" />
        <line x1="16" y1="16" x2="25" y2="22" stroke="#22c55e" strokeWidth="1.6" strokeLinecap="round" />

        <circle cx="16" cy="6" r="2.4" fill="#22c55e" />
        <circle cx="7" cy="22" r="2.4" fill="#22c55e" />
        <circle cx="25" cy="22" r="2.4" fill="#22c55e" />

        <circle cx="16" cy="16" r="3.6" fill="currentColor" />
    </svg>
)

export default SignalScopeIcon
