import MapView from "@/features/map/components/MapView"
import RightPanel from "@/features/map/components/RightPanel"
import Sidebar from "@/features/map/components/Sidebar"
import { useSimulation } from "@/features/map/simulation"
import { useLiveFeed, useRemoteTopology } from "@/features/map/api/liveFeed"
import { feedMode } from "@/shared/api/supabase"
import TopBar from "@/features/ui/TopBar.tsx"
import { useThemeStore } from "@/shared/store/theme.store"

function App() {
  const theme = useThemeStore((state) => state.theme)

  // Both are always called -- hooks cannot be conditional -- and each one
  // no-ops when it is not the active feed. The map itself is identical either
  // way, because both paths write the same RequestEvents into the same buffers.
  const remote = feedMode === "remote"
  useSimulation(!remote)
  useRemoteTopology(remote)
  useLiveFeed(remote)

  return (
    <div data-theme={theme} className="h-screen w-screen flex flex-col">
      <TopBar />
      <main className="flex-1 min-h-0 flex">
        <Sidebar />
        <div className="flex-1 min-w-0">
          <MapView />
        </div>
        <RightPanel />
      </main>
    </div>
  )
}

export default App
