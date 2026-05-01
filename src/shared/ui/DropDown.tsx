import { useRef, useState } from "react"
import useDismiss from "@/shared/hooks/useDismiss"
import { useThemeStore } from "@/shared/store/theme.store"
import ChevronDownIcon from "@/shared/ui/icons/ChevronDownIcon"
import { DropDownItem } from "@/shared/types/component"

type DropDownProps = {
    label?: string
    items: DropDownItem[]
}

const DropDown = ({ label, items }: DropDownProps) => {
    const theme = useThemeStore((state) => state.theme)
    const isDark = theme === "dark"
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)

    useDismiss({ ref, enabled: open, onDismiss: () => setOpen(false) })

    const triggerStyles = isDark
        ? "bg-white/[0.10] border-white/20 hover:bg-white/[0.15] focus-visible:ring-white/30"
        : "bg-black/[0.04] border-black/10 hover:bg-black/[0.08] focus-visible:ring-black/20"

    const menuStyles = isDark
        ? "bg-[#1E1E1E] border-white/15 text-white"
        : "bg-white border-black/10 text-black"

    const itemStyles = isDark ? "hover:bg-white/[0.08]" : "hover:bg-black/[0.05]"

    return (
        <div className="relative inline-block w-35" ref={ref}>
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={open}
                className={`w-35 h-10 px-3 flex items-center gap-2 rounded-xl border transition-colors focus:outline-none focus-visible:ring-2 ${triggerStyles}`}
            >
                <span className="w-25 text-left text-sm">{label}</span>
                <ChevronDownIcon
                    className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`}
                />
            </button>

            {open && (
                <div
                    role="menu"
                    className={`absolute right-0 top-full mt-2 min-w-full rounded-xl border shadow-lg overflow-hidden ${menuStyles}`}
                >
                    {items.map((item) => (
                        <button
                            key={item.label}
                            type="button"
                            role="menuitem"
                            onClick={() => {
                                item.onSelect()
                                setOpen(false)
                            }}
                            className={`w-full px-3 py-2 text-left text-sm transition-colors ${itemStyles}`}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

export default DropDown
