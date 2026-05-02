import type { Service, Connection, Position } from "./types"

const ITERATIONS = 400
const REPULSION = 12_000      // node-node push strength
const SPRING_K = 0.04         // edge attraction stiffness
const SPRING_LENGTH = 220     // preferred edge length
const CENTER_X = 500
const CENTER_Y = 300
const CENTER_K = 0.004        // gravity toward viewport center
const DAMPING = 0.85
const MAX_VELOCITY = 30

export const runForceLayout = (
    services: Service[],
    connections: Connection[],
): Record<string, Position> => {
    const positions: Record<string, Position> = {}
    const velocities: Record<string, Position> = {}

    // Seed the simulation in a circle around the canvas center so we
    // always converge from a non-degenerate starting state.
    services.forEach((service, index) => {
        const angle = (index / Math.max(services.length, 1)) * Math.PI * 2
        positions[service.id] = {
            x: CENTER_X + Math.cos(angle) * 180,
            y: CENTER_Y + Math.sin(angle) * 140,
        }
        velocities[service.id] = { x: 0, y: 0 }
    })

    for (let iter = 0; iter < ITERATIONS; iter++) {
        const forces: Record<string, Position> = {}
        services.forEach(s => { forces[s.id] = { x: 0, y: 0 } })

        // Pairwise repulsion
        for (let i = 0; i < services.length; i++) {
            for (let j = i + 1; j < services.length; j++) {
                const a = services[i].id
                const b = services[j].id
                const pa = positions[a]
                const pb = positions[b]
                const dx = pb.x - pa.x
                const dy = pb.y - pa.y
                const distSq = dx * dx + dy * dy + 0.01
                const dist = Math.sqrt(distSq)
                const f = REPULSION / distSq
                const fx = (dx / dist) * f
                const fy = (dy / dist) * f
                forces[a].x -= fx
                forces[a].y -= fy
                forces[b].x += fx
                forces[b].y += fy
            }
        }

        // Spring along each connection
        for (const c of connections) {
            const pa = positions[c.sourceId]
            const pb = positions[c.targetId]
            if (!pa || !pb) continue
            const dx = pb.x - pa.x
            const dy = pb.y - pa.y
            const dist = Math.sqrt(dx * dx + dy * dy + 0.01)
            const f = SPRING_K * (dist - SPRING_LENGTH)
            const fx = (dx / dist) * f
            const fy = (dy / dist) * f
            forces[c.sourceId].x += fx
            forces[c.sourceId].y += fy
            forces[c.targetId].x -= fx
            forces[c.targetId].y -= fy
        }

        // Pull toward viewport center to keep the layout bounded
        for (const s of services) {
            const p = positions[s.id]
            forces[s.id].x += (CENTER_X - p.x) * CENTER_K
            forces[s.id].y += (CENTER_Y - p.y) * CENTER_K
        }

        // Integrate with damping and a velocity cap
        for (const s of services) {
            const v = velocities[s.id]
            const f = forces[s.id]
            v.x = (v.x + f.x) * DAMPING
            v.y = (v.y + f.y) * DAMPING
            const speed = Math.sqrt(v.x * v.x + v.y * v.y)
            if (speed > MAX_VELOCITY) {
                v.x = (v.x / speed) * MAX_VELOCITY
                v.y = (v.y / speed) * MAX_VELOCITY
            }
            const p = positions[s.id]
            p.x += v.x
            p.y += v.y
        }
    }

    return positions
}
