import type { SVGProps } from "react"

const ChevronDownIcon = (props: SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="m6 9 6 6 6-6"
        />
    </svg>
)

export default ChevronDownIcon
