# SignalScope

A real-time service-map visualization for distributed systems. SignalScope renders streaming activity as an interactive system topology — services, connections, request flow, status — instead of abstract logs or static dashboards.

**Live demo:** https://signal-scope-gamma.vercel.app/

---

## Current state

- Interactive SVG canvas rendering service nodes and directed connections as a system topology
- Real-time simulated event stream generating continuous request events with latency and error characteristics
- Animated request flow between nodes visualized as dots traveling along edges (failed events render red)
- Status derivation system that computes node health from rolling event windows: `no_data`, `healthy`, `slow`, `failing`, `down`
- Color-coded service state visualization driven by live signal metrics
- Scheduled-incident simulation: a 90-second loop cycles Auth API into a high-error state, takes Product Cache offline, and pushes Product DB into high latency, so the map visibly transitions through every status
- Region-based filtering for narrowing visibility across the map; non-matching nodes and edges fade
- Search-based service filtering wired to the sidebar
- Sidebar with active services, region/status sub-line, and live status indicators
- Hover tooltips on every node and edge: services show kind, region, name, and live status; edges show source → target plus throughput, error rate, and avg latency over the active rolling window
- Detail panel for selected service showing throughput, error rate, average latency, last-seen, and incoming-edge count over the user-selected rolling window
- Replay / time-travel mode: a timeline scrubber footer lets the user pause real-time updates and scrub backward through accumulated events; the map, sidebar, and right panel all reflect the chosen historical timestamp because every metric is derived from a single playback time source
- Map interaction: drag-to-pan, cursor-anchored wheel zoom, reset-to-view, live zoom percentage
- Toggleable layout mode (force-directed auto-layout vs hand-coded fixed positioning)
- Reusable UI primitives (dropdown with outside-click + Escape dismissal, theme toggle, search) with consistent interaction behavior
- Centralized state management using Zustand with selective subscriptions and `useShallow` to prevent unnecessary re-renders

---

## Demo walkthrough

Visit the live demo and watch a single 90-second incident loop:

| Time | What happens | Visual |
|---|---|---|
| 0–30s | Nominal | Everything green |
| 30–50s | Auth API at 40% error rate | Auth API chip turns red; red dots flow along its incoming edge |
| 50–65s | Product Cache outage | Cache chip ages past the down threshold and turns grey |
| 65–80s | Product DB at 1.5–2.5s latency | Product DB chip turns amber |
| 80–90s | Recovery | All chips return to green |

Pause the timeline at any point and scrub back to replay the moment a service first turned red.

---

## Stack

- React 19 + TypeScript + Vite
- Zustand for state management
- Tailwind CSS v4
- Plain SVG for the diagram (no graph library — every line of viz code is hand-written)
- In-process event simulation engine (real-time mock stream)
- Custom event + status derivation pipeline

---

## Architecture

SignalScope is structured as a layered real-time frontend system:

```
Event Simulation Layer
        ↓
State Management Layer (Zustand)
        ↓
Derived Data Layer (status, filtering, aggregation hooks)
        ↓
UI Rendering Layer (React)
        ↓
SVG Visualization Layer
```

### Design principles

- Strict separation between event generation, state updates, and UI rendering
- Unidirectional data flow for predictable real-time updates
- Derived state computed in custom hooks rather than stored, so UI cannot drift from raw data
- Selective subscriptions (with `useShallow` where derived arrays would otherwise loop) to minimize re-render scope
- Feature-based modular architecture; each feature owns its data, derivation, and presentation
- Single playback time source — `usePlaybackTime` returns either live `Date.now()` or a paused scrub timestamp, so replay was implemented by swapping a single hook rather than building a parallel rendering path

---

## State model

SignalScope models each service as a live entity driven by an event stream on its incoming connections.

### Service state categories

- `no_data` — no events in the rolling window
- `healthy` — recent traffic, low errors, low latency
- `slow` — high average latency
- `failing` — error rate above threshold
- `down` — last event older than the down-age threshold

### State derivation logic

Status is a pure function of:

- last-seen-at across incoming edges
- error rate over the user-selected rolling window
- average latency over the same window

UI state is always derived from raw events, never set imperatively, so the visualization can't disagree with the data.

---

## Real-time system

A simulation engine generates request events at fixed intervals (250ms), mimicking service traffic with a 5% baseline error rate, varying latency, and a 90-second scheduled-incident loop overlaid on top so the map demonstrates every status transition during a typical visit.

The pipeline:

1. Simulation pushes a `RequestEvent` onto a randomly-selected connection's buffer (filtered by any active outage)
2. Old events are pruned past a 15-minute window so memory stays bounded
3. Components subscribe to the slices they care about; derivation hooks recompute status and metrics on demand
4. Animation runs on `requestAnimationFrame` independent of state updates so dot motion stays smooth at 60fps

---

## Replay mode

A separate playback store holds `{ mode: "live" | "paused", scrubTime }`. The `usePlaybackTime` hook returns the live `Date.now()` while playing and the scrub timestamp while paused. Every consumer of "now" in the map feature reads through this hook, so:

- Pausing the playback freezes status, metrics, and dot positions in lock-step
- Scrubbing backward replays accumulated history — chip colors and stats reflect what the system looked like at that moment
- The simulation continues running in the background, so resuming the timeline always returns to fresh live data

This works because every metric in the system is already a pure function of `(events, now)`. Adding replay required swapping one hook, not building a parallel system.

---

## Performance considerations

- Functional `set` updaters in stores avoid stale-closure bugs under rapid input
- `useShallow` selectors prevent infinite-loop re-renders on derived arrays
- Animation loop decoupled from store updates — each `ConnectionEdge` reads time independently rather than re-rendering the whole tree per frame
- Edge-endpoint geometry computed locally in components (cheap math, no need to memoize)
- Lazy `useState` initializers (`useState(() => Date.now())`) keep first-render computation honest
- `pointer-events: none` on the visible edge stroke and in-flight dots so an invisible thick hit-area line owns hover detection — wider hover targets without altering the visual

---

## Folder structure

```
src/
├── app/                          entry point
├── features/
│   ├── map/
│   │   ├── components/           map + visualization components (MapView, ServiceNode, ConnectionEdge, Sidebar, RightPanel, ServiceShape, StatusPill, StatusDot, ServiceListItem, Tooltip, TimelineScrubber)
│   │   ├── hooks/                derived-data hooks (useServiceStatus, useFilteredServices, useRegionFilter, useSelectedServiceMetrics, usePlaybackTime)
│   │   ├── simulation.ts         real-time event generator with scheduled incidents
│   │   ├── status.ts             health derivation logic + status labels
│   │   ├── store.ts              Zustand store and mutators
│   │   ├── playback.store.ts     live / paused / scrub-time state
│   │   ├── layout.ts             force-directed layout algorithm
│   │   ├── seed.ts               initial topology
│   │   ├── kinds.ts              ServiceKind to icon, label
│   │   ├── types.ts              domain models
│   │   └── constants.ts          thresholds, animation, status colors
│   └── ui/                       top-level chrome (TopBar)
├── shared/
│   ├── hooks/                    reusable hooks (useDismiss, useNow, usePanZoom)
│   ├── store/                    global UI state (theme, filter)
│   ├── ui/                       reusable UI components (Search, ToggleButton, DropDown, icons)
│   └── types/                    shared type definitions
└── styles/                       global styles
```

Architecture follows a feature-first model:

- each feature owns its logic and state
- shared utilities are promoted out of features once they're used in three or more places
- within a feature, `components/` is presentation, `hooks/` is data derivation, and the loose top-level files are domain logic

---

## Running locally

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

---

## Roadmap

- Replace the in-process simulation with a real WebSocket-based event feed
- Per-edge animation density weighted by traffic volume rather than equal-probability picking
- Drag-to-reposition individual nodes when in manual layout mode
- Anomaly detection visualization (statistical outlier highlighting)
- Deep-link sharing of selected node and timestamp

---

## Why this project exists

SignalScope demonstrates:

- Real-time frontend system design
- State-driven UI architecture
- Event-based data processing in the browser
- Performance-aware React engineering
- Scalable feature-based architecture
- The compounding payoff of "derive what you can derive" — replay, status, tooltips, sidebar indicators, and the right panel all share one derivation pipeline

---

## License

MIT
