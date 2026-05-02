import ApiIcon from "@/shared/ui/icons/ApiIcon"
import CacheIcon from "@/shared/ui/icons/CacheIcon"
import DatabaseIcon from "@/shared/ui/icons/DatabaseIcon"
import type { ServiceKind } from "../types"

const SHAPE_RADIUS = 18
const ICON_SIZE = 24
const ICON_OFFSET = -ICON_SIZE / 2

type Props = {
    kind: ServiceKind
    fill: string
}

const ServiceShape = ({ kind, fill }: Props) => {
    const iconProps = {
        x: ICON_OFFSET,
        y: ICON_OFFSET,
        width: ICON_SIZE,
        height: ICON_SIZE,
        style: { color: "white" } as const,
    }

    switch (kind) {
        case "api":
            return (
                <g>
                    <circle cx={0} cy={0} r={SHAPE_RADIUS} fill={fill} />
                    <ApiIcon {...iconProps} />
                </g>
            )
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
    }
}

export default ServiceShape
