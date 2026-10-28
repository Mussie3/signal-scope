import MapView from "@/features/map/components/MapView"
import RightPanel from "@/features/map/components/RightPanel"
import Sidebar from "@/features/map/components/Sidebar"
import { useSimulation } from "@/features/map/simulation"
import { useLiveFeed, useRemoteTopology } from "@/features/map/api/liveFeed"
import { feedMode } from "@/shared/api/supabase"
import TopBar from "@/features/ui/TopBar.tsx"
import { useModeStore } from "@/features/map/mode.store"
import { useMapStore } from "@/features/map/store"

function App() {
  const mode = useModeStore(m => m.mode)
  const selected = useMapStore(s => s.selectedServiceId)

  // Both are always called -- hooks cannot be conditional -- and each one
  // no-ops when it is not the active feed. The map itself is identical either
  // way, because both paths write the same RequestEvents into the same buffers.
  const remote = feedMode === "remote"
  useSimulation(!remote)
  useRemoteTopology(remote)
  useLiveFeed(remote)

  return (
    <div className="h-screen w-screen flex flex-col" style={{ background: "var(--ss-background)" }}>
      <TopBar />
      <main className="flex-1 min-h-0 flex">
        <Sidebar />
        <div className="flex-1 min-w-0">
          <MapView />
        </div>
        {/* The detail panel appears when there is something to detail. A
            permanent "No service selected" column costs a fifth of the map
            to say nothing. */}
        {mode !== "ambient" && selected && <RightPanel />}
      </main>
    </div>
  )
}

export default App
