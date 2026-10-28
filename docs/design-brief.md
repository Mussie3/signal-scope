# SignalScope — design brief

**Live demo:** https://signal-scope-gamma.vercel.app/
(Watch it for 90 seconds without clicking. It cycles through a scripted incident, so you will see every health state occur naturally.)

---

## What it is, in one paragraph

SignalScope is a **live map of how a software system is actually behaving right now**. Instead of a wall of charts, it draws the system as a topology: each box is a service, each line is a dependency, and both are coloured by health that is calculated from real traffic flowing through them. If a payment API starts failing, that box turns red within seconds and you can see which things upstream depend on it. You can also pause and scrub backwards in time to see what the map looked like when something broke.

It is for engineers who are responsible for keeping a system running.

---

## Who looks at it, and when

This is the most important thing to design around, because the same screen is used in three very different states of mind. They want almost opposite things.

**1. Ambient — "is anything wrong?"**
Left open on a second monitor or a wall screen. Glanceable from three metres away. The user is not reading; they are checking a shape and a colour. If everything is fine they should be able to tell in under a second without focusing.

**2. Incident — "what broke, and what else does it affect?"**
Something is wrong and someone is under pressure, possibly at 3am. They need to find the failing thing and understand its blast radius fast. Density is fine here; hesitation is not. Mistakes made in this mode are expensive.

**3. Investigation — "what happened at 14:32 yesterday?"**
Calm, deliberate, scrubbing through history to write an incident report. Precision matters more than speed. They will want to read exact numbers.

**The core tension:** mode 1 wants almost no information and mode 3 wants a lot. The current design serves mode 2 best and the other two by accident. Resolving that is the most valuable thing a designer could do here.

---

## The vocabulary

Five concepts. A designer needs all five.

- **Service** — one component of the system. Has a name, a *kind*, a *region*, and a live *health status*.
- **Connection** — a directed dependency from one service to another. "Checkout API calls the orders database." Direction matters and must be visible.
- **Event** — a single request crossing one connection. Carries how long it took and whether it succeeded. Thousands per minute; never shown individually except as animation.
- **Health status** — one of five states, *calculated* from recent events rather than reported. See below.
- **Incident** — a record that a service was unhealthy from one time to another. Has a beginning and an end.

A thing worth internalising: **nothing in this product reports its own status.** Health is always inferred from traffic. That is why a service with no traffic is a genuinely ambiguous case rather than an oversight.

---

## The five health states

These are exact, and currently distinguished **by colour alone** — which is a problem to solve, not a pattern to follow.

| State | Means | Currently |
|---|---|---|
| **Healthy** | Traffic flowing, few errors, acceptable speed | green `#22c55e` |
| **Slow** | Average response time above 300ms | amber `#eab308` |
| **Failing** | More than 10% of requests erroring | red `#ef4444` |
| **Down** | Nothing heard from it for over 5 seconds | dark grey `#6b7280` |
| **No data** | Never saw traffic in the selected window | light grey `#9ca3af` |

**Down and No data are different and the difference matters enormously.** *Down* means we were watching something and it stopped — act now. *No data* means nothing is using this, or it is outside the window you are looking at — probably fine. Today they are two greys, which is close to useless. A user who reads "no data" as "down" will chase a non-existent incident; the reverse is worse.

**Slow and Failing can both be true.** Failing wins today. Whether that is right, and whether a combined state needs showing, is an open question.

---

## The five node kinds

Each service is one of these, and each needs to be visually distinct **at the same time as carrying its health colour**. Two encodings on one small object is the central visual problem.

Each has a distinct **silhouette** as well as an icon, so the kind survives being
small, being zoomed out, and being viewed by someone who cannot separate the
status colours. All five are placeholder-quality and open to redesign.

- **Frontend** — an entry point, where users actually arrive. Wide rounded rectangle, like a screen.
- **API** — an internal service. Circle.
- **Database** — persistent storage. Rounded square.
- **Cache** — fast temporary storage. Diamond.
- **External** — something outside the system: Stripe, an email provider, a CDN. Hexagon with a **dashed** outline and reduced fill.

**External deserves special thought.** You cannot fix Stripe. When an external dependency degrades you, that is a fundamentally different situation from your own service failing — different owner, different response, often no action available. The dashed outline is a first attempt at saying "not yours", chosen partly because a stroke style carries that meaning without relying on colour. Whether it is strong enough, and whether these nodes belong outside a drawn boundary entirely, is worth a better answer than the current one.

---

## What is on screen today

- **The map** — the main canvas. Pan by dragging, zoom with the wheel, reset button, live zoom percentage. Hand-drawn boxes and lines; no third-party diagram library.
- **Animated traffic** — small dots travel along each connection to show requests moving. Failed requests are red dots. This is the thing people notice first and it carries a surprising amount of the sense that the system is alive.
- **Left sidebar** — searchable list of services with a status dot, region and current state. Useful when the map is too big to scan.
- **Right panel** — appears when you select a service. Shows throughput, error rate, average latency, time since last seen, and how many things depend on it.
- **Timeline scrubber (bottom)** — pause live updates and drag backwards through recent history. The whole interface reflects the chosen moment, not just the map.
- **Top bar** — region filter, text search, time-window selector (30 seconds to 15 minutes), light/dark toggle, and an automatic-vs-manual layout toggle.

Light and dark themes both exist and both need to work.

---

## The hard problems

This is where design effort pays off most. In rough priority order.

**1. Scale.** The demo has 6 services. A real system has 30 to 100, sometimes more, and the topology is discovered automatically so its size is not under anyone's control. At 50+ nodes the current approach becomes spaghetti. Options worth exploring: grouping by region or namespace, collapsing clusters into a single node that expands, showing only the unhealthy neighbourhood by default, or a fundamentally different layout than a free-floating force graph. **Be aware:** exotic layouts cost real engineering here, because everything is hand-drawn rather than handed to a library.

**2. Hub nodes.** Shared databases get depended on by many services, so some nodes have a dozen incoming lines while most have one or two. Any layout has to survive that asymmetry without becoming a starburst.

**3. Making "when" unmistakable.** A user looking at 20-minute-old data who believes it is live is a genuine hazard — they will conclude a resolved incident is ongoing, or a current one is over. Live, paused and scrubbing need to be unambiguous at a glance, not just indicated by a small control state.

**4. Accessibility of health.** Health is currently colour-only, and green/amber/red is the worst possible choice for the most common form of colour blindness. Shape, fill pattern, iconography or motion all need to carry it too. This is not a nice-to-have — it is the primary information in the product.

**5. First run and empty states.** A newly connected system has no data. The map is blank until traffic arrives. What should someone see in the first thirty seconds, when the product is working perfectly but has nothing to show? Likewise: a service filtered out, a search with no matches, a window with no events.

**6. Density modes.** See the three audiences above. Possibly one layout cannot serve all three and an explicit mode switch is more honest than a compromise.

---

## What it is deliberately not

Useful boundaries — please do not design these.

- **Not a log viewer.** No search over text.
- **Not a trace waterfall.** No flame graphs or span timelines. Other tools do that well; this one answers a different question.
- **Not alerting or on-call.** It does not page anyone (yet).
- **Not charts-first.** Numbers support the map. The map is the product. A design that reduces to a dashboard of line charts has lost the thing that makes this worth building.

---

## Technical constraints to respect

- Everything is drawn in **SVG, by hand**. Gradients, shadows, blurs and filters are all possible but cost performance when hundreds of elements are on screen.
- The map must hold **60fps** while dots are animating. Heavy per-node effects are the first thing to break that.
- Updates arrive in **batches every second or so**, so nodes change colour while the user is looking. Transitions should absorb that without flickering or drawing the eye to something unimportant.
- It runs in a browser, desktop-first. Tablet is plausible. Phone is not a target.
- Both **light and dark** themes ship today.

---

## Known gaps in the current build

Honest list, so time is not spent designing around things that are simply unfinished.

- **`frontend` and `external` have placeholder shapes only.** They render and no longer break anything, but no designer has looked at them.
- **The region filter now lists whatever regions the topology reports**, which is correct but ugly: options read as raw cloud identifiers like `eu-central-1`, alongside `unknown` for services that never declared one. Presenting discovered values well — grouping, friendly names, handling `unknown` — is unsolved.
- **No incident history view.** Incidents are recorded in the database and never displayed. "Show me every time this service failed this week" has no screen.
- **No settings, onboarding, or key-management screens.** Connecting a system is currently a database call.
- **Layout degrades past roughly 50–100 nodes** for performance reasons, independent of the visual problem.

---

## What would be most useful back

Ordered by value.

1. **The map at realistic scale** — one view of 40–60 services that stays readable, with a clear point of view on grouping or collapsing.
2. **The health system** — five states and five node kinds, legible together, colour-blind safe, in light and dark.
3. **The three modes** — how ambient, incident and investigation differ, even if that is one layout with different densities.
4. **Time state** — how live, paused and historical are made unmistakable.
5. **Empty and first-run states.**

Working from the live demo is strongly encouraged over working from this document alone. The animation and the sense of a system breathing are most of the current character, and neither survives a screenshot.
