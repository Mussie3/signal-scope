# SignalScope

A real-time service-map visualization for distributed systems. SignalScope renders the live state of a service mesh — nodes, connections, request flow, latency, errors — as an interactive canvas, instead of via logs or charts.

## Current state

- Six-service seeded topology (frontend, two APIs, two databases, one cache) with five directed connections
- Pannable, cursor-anchored-zoomable SVG canvas with light and dark themes
- In-process simulation engine producing request events at 250ms intervals with a 5% error rate and varying latency
- Animated in-flight request dots that travel from source to target along each connection
- Status derived in real time from rolling event windows (`healthy` / `slow` / `failing` / `down` / `no_data`) using configurable thresholds
- Status-driven node coloring; chip color tracks system health
- Per-kind node rendering: circle for APIs, rounded rectangle for databases, diamond for caches; each chip carries an icon centered inside
- Directed edges with arrowheads, offset to land at the chip edge
- Sidebar with a service list, status indicators, and click-to-select
- Right panel that, when a service is selected, shows its derived status, throughput over the rolling window, error rate, average latency, last-seen, and incoming-edge count
- Reusable theme system, dropdown primitive with outside-click and Escape dismissal, and a small SVG icon library
- Centralized state via Zustand stores with selective subscriptions

## Stack

- React 19 + TypeScript + Vite
- Zustand for state, with selective subscriptions
- Tailwind CSS v4
- Plain SVG for the diagram (no graph library)

## Folder layout

```
src/
├── app/             entry point
├── features/
│   ├── map/         types, seed, store, simulation, status, MapView and children
│   └── ui/          top-level layout (TopBar)
├── shared/
│   ├── hooks/       useDismiss, usePanZoom, useNow
│   ├── store/       theme and filter Zustand stores
│   ├── types/       cross-cutting type definitions
│   └── ui/          shared components (Search, ToggleButton, DropDown, icons)
└── styles/          global styles
```

`features/` are kept self-contained. Anything imported from three or more features gets promoted into `shared/`.

## Running it

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

## Roadmap

- Wire the TopBar search to filter the sidebar
- Region/range filters on the sidebar
- Force-directed auto-layout option
- Selectable rolling-window length
- Per-edge animations weighted by traffic
- Replace the simulation with a real WebSocket feed once the visualization is solid

## License

MIT.
