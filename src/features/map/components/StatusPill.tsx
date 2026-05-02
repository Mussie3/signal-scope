type Props = {
    color: string
    label: string
}

const StatusPill = ({ color, label }: Props) => (
    <div
        className="flex items-center gap-3 px-3 py-2.5 rounded-lg border"
        style={{
            background: `${color}14`,
            borderColor: `${color}3a`,
        }}
    >
        <span className="relative flex-none">
            <span
                className="block w-2.5 h-2.5 rounded-full"
                style={{ background: color }}
            />
            <span
                className="absolute inset-0 w-2.5 h-2.5 rounded-full animate-ping opacity-60"
                style={{ background: color, animationDuration: "2s" }}
            />
        </span>
        <span className="text-sm font-medium" style={{ color }}>
            {label}
        </span>
    </div>
)

export default StatusPill
