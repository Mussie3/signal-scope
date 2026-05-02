type Props = {
    color: string
    size?: number
}

const StatusDot = ({ color, size = 8 }: Props) => {
    const px = `${size}px`
    return (
        <span
            className="relative inline-flex flex-none"
            style={{ width: px, height: px }}
        >
            <span
                className="block rounded-full"
                style={{ background: color, width: px, height: px }}
            />
            <span
                className="absolute inset-0 rounded-full animate-ping opacity-50"
                style={{ background: color, animationDuration: "2s" }}
            />
        </span>
    )
}

export default StatusDot
