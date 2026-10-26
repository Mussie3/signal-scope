import ApiIcon from "@/shared/ui/icons/ApiIcon"
import CacheIcon from "@/shared/ui/icons/CacheIcon"
import DatabaseIcon from "@/shared/ui/icons/DatabaseIcon"
import FrontendIcon from "@/shared/ui/icons/FrontendIcon"
import ExternalIcon from "@/shared/ui/icons/ExternalIcon"
import type { ServiceKind } from "../types"

const SHAPE_RADIUS = 18
const ICON_SIZE = 24
const ICON_OFFSET = -ICON_SIZE / 2

// Pointy-top hexagon, used for external services.
const HEX = [
    [0, -SHAPE_RADIUS],
    [SHAPE_RADIUS * 0.866, -SHAPE_RADIUS * 0.5],
    [SHAPE_RADIUS * 0.866, SHAPE_RADIUS * 0.5],
    [0, SHAPE_RADIUS],
    [-SHAPE_RADIUS * 0.866, SHAPE_RADIUS * 0.5],
    [-SHAPE_RADIUS * 0.866, -SHAPE_RADIUS * 0.5],
]
    .map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`)
    .join(" ")

type Props = {
    kind: ServiceKind
    fill: string
}

// Each kind gets a distinct SILHOUETTE as well as an icon, so the type of a node
// survives being small, being zoomed out, and being looked at by someone who
// cannot distinguish the status colours.
const ServiceShape = ({ kind, fill }: Props) => {
    const iconProps = {
        x: ICON_OFFSET,
        y: ICON_OFFSET,
        width: ICON_SIZE,
        height: ICON_SIZE,
        style: { color: "white" } as const,
    }

    switch (kind) {
        case "cache":
            return (
                <g>
                    <polygon
                        points={`0,-${SHAPE_RADIUS} ${SHAPE_RADIUS},0 0,${SHAPE_RADIUS} -${SHAPE_RADIUS},0`}
                        fill={fill}
                    />
                    <CacheIcon {...iconProps} />
                </g>
            )
        case "database":
            return (
                <g>
                    <rect
                        x={-SHAPE_RADIUS}
                        y={-SHAPE_RADIUS}
                        width={SHAPE_RADIUS * 2}
                        height={SHAPE_RADIUS * 2}
                        rx={9}
                        fill={fill}
                    />
                    <DatabaseIcon {...iconProps} />
                </g>
            )
        case "frontend":
            // Wider than tall, like a screen. A frontend is an entry point, and
            // reads as the place traffic originates rather than another box in
            // the middle of the system.
            return (
                <g>
                    <rect
                        x={-SHAPE_RADIUS * 1.3}
                        y={-SHAPE_RADIUS * 0.85}
                        width={SHAPE_RADIUS * 2.6}
                        height={SHAPE_RADIUS * 1.7}
                        rx={5}
                        fill={fill}
                    />
                    <FrontendIcon {...iconProps} />
                </g>
            )
        case "external":
            // Dashed outline: this one is not yours. You cannot fix Stripe, so an
            // incident here reads differently from your own service failing, and
            // that difference is carried by the stroke rather than by colour -
            // which keeps it legible to someone who cannot see the status hue.
            return (
                <g>
                    <polygon points={HEX} fill={fill} fillOpacity={0.55} />
                    <polygon
                        points={HEX}
                        fill="none"
                        stroke={fill}
                        strokeWidth={2}
                        strokeDasharray="4 3"
                    />
                    <ExternalIcon {...iconProps} />
                </g>
            )
        case "api":
        default:
            // Explicit default, because the previous switch had none: a kind the
            // UI does not recognise rendered as nothing at all, so a node
            // silently vanished from the map rather than showing up unstyled.
            return (
                <g>
                    <circle cx={0} cy={0} r={SHAPE_RADIUS} fill={fill} />
                    <ApiIcon {...iconProps} />
                </g>
            )
    }
}

export default ServiceShape
