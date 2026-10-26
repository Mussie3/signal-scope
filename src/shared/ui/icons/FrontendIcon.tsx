import { SVGProps } from "react";

// An entry point - where users actually arrive. Drawn as a browser window
// rather than another server glyph, because a frontend is the one node on the
// map whose health is a user's experience rather than a dependency's.
const FrontendIcon = (props: SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" {...props}>
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 8.25V6.75A1.5 1.5 0 0 1 4.5 5.25h15A1.5 1.5 0 0 1 21 6.75v10.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.25V8.25Zm0 0h18M5.625 6.9h.008v.008h-.008V6.9Zm2.25 0h.008v.008h-.008V6.9Zm2.25 0h.008v.008h-.008V6.9Z"
        />
    </svg>
)

export default FrontendIcon
