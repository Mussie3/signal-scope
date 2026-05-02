# SignalScope

A real-time service-map visualization for distributed systems. SignalScope renders the live state of a service mesh — nodes, connections, request flow, latency, errors — as an interactive canvas, instead of via logs or charts.

**Live demo:** https://signal-scope-gamma.vercel.app/

## Current state

- Six-service seeded topology (frontend, two APIs, two databases, one cache) with five directed connections, spread across four regions
- Pannable, cursor-anchored-zoomable SVG canvas with a subtle grid background, in light and dark themes
- In-process simulation engine producing request events at 250ms intervals with a 5% error rate and varying latency
- Animated in-flight request dots that travel from source to target along each connection; failed events render red
- Status derived in real time from rolling event windows (`healthy` / `slow` / `failing` / `down` / `no_data`) using configurable thresholds
- Status-driven node coloring; chip color tracks system health
- Per-kind node rendering: circle for APIs, rounded rectangle for databases, diamond for caches; each chip carries an icon centered inside
- Directed edges with arrowheads, offset to land at the chip edge
- Sidebar with a service list, status indicators, search filter, region filter, and click-to-select
- Right panel that, when a service is selected, shows derived status, throughput, error rate, average latency, last-seen, and incoming-edge count over the user-selected rolling window
- TopBar region and range dropdowns drive filtering and the metric window
- Force-directed auto-layout option, toggleable from the map overlay
- Reset-view button and live zoom percentage on the canvas
- Reusable theme system, dropdown primitive with outside-click and Escape dismissal, and a small SVG icon library
- Centralized state via Zustand stores with selective subscriptions and `useShallow` where derived arrays would otherwise loop

## Stack

- React 19 + TypeScript + Vite
- Zustand for state, with selective subscriptions
- Tailwind CSS v4
- Plain SVG for the diagram (no graph library)

## Folder layout

```
src/
├── app/                          entry point
├── features/
│   ├── map/
│   │   ├── components/           visual components only
│   │   ├── hooks/                derived-data hooks (status, filters, metrics)
│   │   ├── constants.ts          thresholds, animation durations, colors
│   │   ├── kinds.ts              ServiceKind -> icon, label
│   │   ├── layout.ts             force-directed layout algorithm
│   │   ├── seed.ts               initial topology
│   │   ├── simulation.ts         interval loop generating request events
│   │   ├── status.ts             status derivation + label map
│   │   ├── store.ts              Zustand store and mutators
│   │   └── types.ts              domain types
│   └── ui/                       top-level layout (TopBar)
├── shared/
│   ├── hooks/                    useDismiss, usePanZoom, useNow
│   ├── store/                    theme and filter Zustand stores
│   ├── types/                    cross-cutting type definitions
│   └── ui/                       shared components (Search, ToggleButton, DropDown, icons)
└── styles/                       global styles
```

`features/` are kept self-contained. Anything imported from three or more features gets promoted into `shared/`. Within a feature, `components/` is presentation, `hooks/` is data derivation, and the loose top-level files are domain logic.

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

- Selectable rolling-window length surfaced on the right panel itself
- Per-edge animations weighted by traffic volume rather than equal-probability picking
- Drag-to-reposition individual nodes when in manual layout mode
- WebSocket feed driving the simulation in place of `setInterval` (deferred — without a real backend it would just be the in-process simulation in another process; the architectural lesson is already demonstrated)

## License

MIT.
