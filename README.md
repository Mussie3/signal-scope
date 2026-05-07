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
- Region-based filtering for narrowing visibility across the map; non-matching nodes and edges fade
- Search-based service filtering wired to the sidebar
- Sidebar with active services, region/status sub-line, and live status indicators
- Detail panel for selected service showing throughput, error rate, average latency, last-seen, and incoming-edge count over the user-selected rolling window
- Map interaction: drag-to-pan, cursor-anchored wheel zoom, reset-to-view, live zoom percentage
- Toggleable layout mode (force-directed auto-layout vs hand-coded fixed positioning)
- Reusable UI primitives (dropdown with outside-click + Escape dismissal, theme toggle, search) with consistent interaction behavior
- Centralized state management using Zustand with selective subscriptions and `useShallow` to prevent unnecessary re-renders

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

A simulation engine generates request events at fixed intervals (250ms), mimicking service traffic with a 5% error rate and varying latency.

The pipeline:

1. Simulation pushes a `RequestEvent` onto a randomly-selected connection's buffer
2. Old events are pruned past a 15-minute window so memory stays bounded
3. Components subscribe to the slices they care about; derivation hooks recompute status and metrics on demand
4. Animation runs on `requestAnimationFrame` independent of state updates so dot motion stays smooth at 60fps

---

## Performance considerations

- Functional `set` updaters in stores avoid stale-closure bugs under rapid input
- `useShallow` selectors prevent infinite-loop re-renders on derived arrays
- Animation loop decoupled from store updates — each `ConnectionEdge` reads `useNow` independently rather than re-rendering the whole tree per frame
- Edge-endpoint geometry computed locally in components (cheap math, no need to memoize)
- Lazy `useState` initializers (`useState(() => Date.now())`) keep first-render computation honest

---

## Folder structure

```
src/
├── app/                          entry point
├── features/
│   ├── map/
│   │   ├── components/           map + visualization components (MapView, ServiceNode, ConnectionEdge, Sidebar, RightPanel, ServiceShape, StatusPill, StatusDot, ServiceListItem)
│   │   ├── hooks/                derived-data hooks (useServiceStatus, useFilteredServices, useRegionFilter, useSelectedServiceMetrics)
│   │   ├── simulation.ts         real-time event generator
│   │   ├── status.ts             health derivation logic + status labels
│   │   ├── store.ts              Zustand store and mutators
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
- Historical replay mode for past signal analysis
- Per-edge animation density weighted by traffic volume
- Drag-to-reposition individual nodes when in manual layout mode
- Time-travel debugging for state transitions

---

## Why this project exists

SignalScope demonstrates:

- Real-time frontend system design
- State-driven UI architecture
- Event-based data processing in the browser
- Performance-aware React engineering
- Scalable feature-based architecture

---

## License

MIT
