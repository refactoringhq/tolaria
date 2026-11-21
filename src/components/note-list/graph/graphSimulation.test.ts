import { describe, expect, it } from 'vitest'
import { DEFAULT_GRAPH_SETTINGS } from '../../../collections/graphSettings'
import { DRAG_ALPHA_TARGET, type GraphForces, type GraphLayoutSnapshot, GraphSimulation } from './graphSimulation'

const forces: GraphForces = {
  centerForce: DEFAULT_GRAPH_SETTINGS.centerForce,
  repelForce: DEFAULT_GRAPH_SETTINGS.repelForce,
  linkForce: DEFAULT_GRAPH_SETTINGS.linkForce,
  linkDistance: DEFAULT_GRAPH_SETTINGS.linkDistance,
}

/** a–b–c linked in a chain, d on its own. */
const snapshot: GraphLayoutSnapshot = {
  ids: ['a', 'b', 'c', 'd'],
  positions: [0, 0, 5, 0, 0, 5, 5, 5],
  edges: [0, 1, 1, 2, 3, 3, 0, 9],
}

function distance(positions: number[], left: number, right: number) {
  return Math.hypot(positions[left * 2] - positions[right * 2], positions[left * 2 + 1] - positions[right * 2 + 1])
}

function runUntilRest(simulation: GraphSimulation, limit = 2000): number {
  let ticks = 0
  while (!simulation.isResting() && ticks < limit) {
    simulation.tick()
    ticks += 1
  }
  return ticks
}

describe('GraphSimulation', () => {
  it('spreads the notes out and comes to rest instead of jittering forever', () => {
    const simulation = new GraphSimulation(snapshot, forces, 1)
    const ticks = runUntilRest(simulation)
    expect(simulation.isResting()).toBe(true)
    expect(ticks).toBeLessThan(400)
    const positions = simulation.positions()
    expect(distance(positions, 0, 1)).toBeGreaterThan(30)
    expect(positions.every(Number.isFinite)).toBe(true)
    expect(simulation.ids).toEqual(['a', 'b', 'c', 'd'])
  })

  it('pulls linked notes to about the link distance', () => {
    const simulation = new GraphSimulation(snapshot, { ...forces, repelForce: 0, centerForce: 0 }, 1)
    runUntilRest(simulation)
    expect(distance(simulation.positions(), 0, 1)).toBeCloseTo(forces.linkDistance, -1)
  })

  it('keeps a held node under the pointer, drags its neighbour along, and settles after release', () => {
    const simulation = new GraphSimulation(snapshot, forces, 1)
    runUntilRest(simulation)
    const before = simulation.positions()
    simulation.hold(0, 600, 600)
    expect(simulation.alpha()).toBeGreaterThanOrEqual(DRAG_ALPHA_TARGET)
    for (let tick = 0; tick < 120; tick += 1) simulation.tick()
    const held = simulation.positions()
    expect(held.slice(0, 2)).toEqual([600, 600])
    expect(distance(held, 0, 1)).toBeLessThan(distance(before, 1, 0) + 600)
    expect(simulation.isResting()).toBe(false)
    simulation.release(0)
    const ticks = runUntilRest(simulation)
    // About two seconds at one tick per frame.
    expect(ticks).toBeLessThan(150)
    expect(simulation.positions()[0]).not.toBe(600)
  })

  it('reheats when forces change and ignores unknown nodes', () => {
    const simulation = new GraphSimulation(snapshot, forces, 1)
    runUntilRest(simulation)
    simulation.applyForces({ ...forces, linkDistance: 200 })
    simulation.reheat(0.5)
    expect(simulation.isResting()).toBe(false)
    runUntilRest(simulation)
    expect(distance(simulation.positions(), 0, 1)).toBeGreaterThan(120)
    simulation.hold(42, 0, 0)
    simulation.release(42)
    expect(simulation.isResting()).toBe(true)
  })
})
