# SignalScope

A real-time service-map visualization for distributed systems. SignalScope renders the live state of a service mesh — nodes, connections, request flow, latency, errors — as an interactive canvas, instead of via logs or charts.

## Current state

The static rendering layer is in place:

- Pannable SVG canvas with light and dark themes
- Six seeded services (frontend, two APIs, two databases, one cache) with five directed connections
- Per-kind node rendering: circle for APIs, rounded rectangle for databases, diamond for caches; each chip carries an icon centered inside
- Reusable theme system, dropdown primitive with outside-click and Escape dismissal, and a small SVG icon library
- Centralized state via Zustand stores with selective subscriptions

The simulation engine, animated request flow, and status-driven coloring are tracked in **Roadmap** below.

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
│   ├── map/         types, seed data, MapView and its child components
│   └── ui/          top-level layout (TopBar)
├── shared/
│   ├── hooks/       useDismiss, usePan
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

- Mouse-wheel zoom with cursor anchoring
- Simulation engine that produces request events on connections
- Animated in-flight requests as dots traveling along edges
- Status-driven node coloring (healthy / slow / failing / down / no_data) derived from rolling event windows
- Arrowheads on directed edges
- Sidebar with service list and filters
- Right panel with selected-service details (latency, error rate, traffic)
- Force-directed auto-layout option
- Replace the simulation with a real WebSocket feed once the visualization is solid

## License

MIT.
