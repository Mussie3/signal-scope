import MapView from "@/features/map/MapView"
import { useSimulation } from "@/features/map/simulation"
import TopBar from "@/features/ui/TopBar.tsx"
import { useThemeStore } from "@/shared/store/theme.store"

function App() {
  const theme = useThemeStore((state) => state.theme)
  useSimulation()
  return (
    <div data-theme={theme} className="h-screen w-screen flex flex-col">
      <TopBar />
      <main className="flex-1 min-h-0">
        <MapView />
      </main>
    </div>
  )
}

export default App
