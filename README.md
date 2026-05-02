# SignalScope

A real-time service-map visualization for distributed systems. SignalScope renders the live state of a service mesh — nodes, connections, request flow, latency, errors — as an interactive canvas, instead of via logs or charts.

## Current state

The MVP feature set is in place:

- Six-service seeded topology (frontend, two APIs, two databases, one cache) with five directed connections
- Pannable, zoomable SVG canvas with light and dark themes
- In-process simulation engine producing request events at 250ms intervals with a 5% error rate and varying latency
- Animated in-flight request dots that travel from source to target along each connection
- Status derived in real time from rolling event windows (`healthy` / `slow` / `failing` / `down` / `no_data`) using configurable thresholds
- Status-driven node coloring; chip color tracks system health
- Per-kind node rendering: circle for APIs, rounded rectangle for databases, diamond for caches; each chip carries an icon centered inside
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

In rough priority order:

- Sidebar with service list and filters
- Right panel with selected-service details (latency, error rate, traffic, last seen)
- Arrowheads on directed edges with proper endpoint offset against the chip
- Cursor-anchored zoom
- Force-directed auto-layout option
- Replace the simulation with a real WebSocket feed once the visualization is solid

## License

MIT.
