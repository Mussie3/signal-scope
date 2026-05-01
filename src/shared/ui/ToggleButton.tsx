import { useId } from "react"
import { useThemeStore } from "@/shared/store/theme.store"
import CloudIcon from "@/shared/ui/icons/CloudIcon"
import MoonIcon from "@/shared/ui/icons/MoonIcon"
import StarIcon from "@/shared/ui/icons/StarIcon"
import SunIcon from "@/shared/ui/icons/SunIcon"

const ToggleButton = () => {
    const { theme, toggleTheme } = useThemeStore()
    const id = useId()
    const isDark = theme === "dark"

    return (
        <label htmlFor={id} className="group inline-block cursor-pointer">
            <input
                type="checkbox"
                id={id}
                className="sr-only"
                checked={!isDark}
                onChange={toggleTheme}
            />
            <div
                className={`relative h-8 w-16 rounded-full overflow-hidden transition-colors ${
                    isDark ? "bg-[#1E1E1E]" : "bg-[#7FABFF]"
                }`}
            >
                {isDark ? (
                    <>
                        <StarIcon className="absolute top-1 right-2 w-2 h-2 text-white" />
                        <StarIcon className="absolute top-4 right-6 w-1.5 h-1.5 text-white/90" />
                        <StarIcon className="absolute top-5 right-3 w-1 h-1 text-white/80" />
                        <StarIcon className="absolute top-2 right-8 w-1 h-1 text-white/70" />
                    </>
                ) : (
                    <>
                        <CloudIcon className="absolute top-2 left-2 w-4 h-3 text-white" />
                        <CloudIcon className="absolute top-4 left-6 w-3 h-2 text-white/90" />
                    </>
                )}
                <div className="absolute left-1 top-1 h-6 w-6 rounded-full transition-transform group-has-[:checked]:translate-x-8 flex items-center justify-center">
                    {isDark ? (
                        <MoonIcon className="w-6 h-6 text-white" />
                    ) : (
                        <SunIcon className="w-6 h-6 text-white" />
                    )}
                </div>
            </div>
        </label>
    )
}

export default ToggleButton
