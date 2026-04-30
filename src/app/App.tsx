import TopBar from "@/features/ui/TopBar.tsx"
import { useThemeStore } from "@/shared/store/theme.store"

function App() {

  const theme = useThemeStore((state) => state.theme)

  return (
    <div data-theme={theme} className="h-screen w-screen">
      <TopBar />
    </div>
  )
}

export default App
