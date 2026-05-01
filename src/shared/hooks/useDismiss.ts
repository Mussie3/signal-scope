import { useEffect, type RefObject } from "react"

type UseDismissOptions = {
    ref: RefObject<HTMLElement | null>
    enabled: boolean
    onDismiss: () => void
}

const useDismiss = ({ ref, enabled, onDismiss }: UseDismissOptions) => {
    useEffect(() => {
        if (!enabled) return

        const handleClickOutside = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                onDismiss()
            }
        }

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") onDismiss()
        }

        document.addEventListener("mousedown", handleClickOutside)
        document.addEventListener("keydown", handleEscape)
        return () => {
            document.removeEventListener("mousedown", handleClickOutside)
            document.removeEventListener("keydown", handleEscape)
        }
    }, [enabled, ref, onDismiss])
}

export default useDismiss
