import Icon from "@/assets/signal-scope-icon.svg"
// import { useThemeStore } from "@/shared/store/theme.store"
import Search from "@/shared/ui/Search"
import ToggleButton from "@/shared/ui/ToggleButton"

const TopBar = () => {

    // const { theme, toggleTheme } = useThemeStore()

    return (
        <section id="header" className="w-full h-16 bg-black flex items-center p-2">
            <div className="flex items-center gap-2">
                <img src={Icon} className="w-12 h-12" alt="icon" />
                <h1 className="text-white text-3xl font-montserrat font-[500]">SignalScope</h1>
            </div>
            <div>
                <Search />
            </div>
            <ToggleButton />
        </section>
    )
}

export default TopBar