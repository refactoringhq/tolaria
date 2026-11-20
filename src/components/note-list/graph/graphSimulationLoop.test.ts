import { describe, expect, it } from 'vitest'
import type { GraphForces } from './graphSimulation'
import { type SimulationFrame, SimulationLoop, type SimulationScheduler } from './graphSimulationLoop'

const forces: GraphForces = { centerForce: 0.5, repelForce: 10, linkForce: 1, linkDistance: 80 }
const snapshot = { ids: ['a', 'b', 'c'], positions: [0, 0, 1, 0, 0, 1], edges: [0, 1, 1, 2] }

/** A manual clock: `later` queues steps, `runNext` runs one and advances time by its delay. */
function manualScheduler() {
  let time = 0
  const queue: Array<{ step: () => void; delay: number }> = []
  const scheduler: SimulationScheduler = {
    later: (step, delay) => {
      const entry = { step, delay }
      queue.push(entry)
      return () => queue.splice(queue.indexOf(entry), 1)
    },
    now: () => time,
  }
  const runNext = () => {
    const entry = queue.shift()
    if (!entry) return false
    time += entry.delay
    entry.step()
    return true
  }
  return { scheduler, queue, runNext }
}

function runAll(runNext: () => boolean, limit = 5000) {
  let steps = 0
  while (steps < limit && runNext()) steps += 1
  return steps
}

describe('SimulationLoop', () => {
  it('posts positions every frame until the graph rests, then schedules nothing', () => {
    const frames: SimulationFrame[] = []
    const { scheduler, queue, runNext } = manualScheduler()
    const loop = new SimulationLoop((frame) => frames.push(frame), scheduler)
    loop.handle({ type: 'load', snapshot, forces, alpha: 1 })
    runAll(runNext)
    expect(frames.at(-1)?.resting).toBe(true)
    expect(frames.slice(0, -1).every((frame) => !frame.resting)).toBe(true)
    expect(frames[0].ids).toEqual(['a', 'b', 'c'])
    expect(queue).toHaveLength(0)
  })

  it('wakes on a drag and keeps posting while the node is held', () => {
    const frames: SimulationFrame[] = []
    const { scheduler, runNext } = manualScheduler()
    const loop = new SimulationLoop((frame) => frames.push(frame), scheduler)
    loop.handle({ type: 'load', snapshot, forces, alpha: 1 })
    runAll(runNext)
    frames.length = 0
    loop.handle({ type: 'hold', id: 'a', x: 300, y: 300 })
    for (let step = 0; step < 200; step += 1) runNext()
    expect(frames.at(-1)?.resting).toBe(false)
    expect(frames.at(-1)?.positions.slice(0, 2)).toEqual([300, 300])
    loop.handle({ type: 'release', id: 'a' })
    runAll(runNext)
    expect(frames.at(-1)?.resting).toBe(true)
  })

  it('reheats on new forces, ignores unknown notes, and stops when disposed', () => {
    const frames: SimulationFrame[] = []
    const { scheduler, queue, runNext } = manualScheduler()
    const loop = new SimulationLoop((frame) => frames.push(frame), scheduler)
    loop.handle({ type: 'hold', id: 'a', x: 0, y: 0 })
    runAll(runNext)
    expect(frames).toHaveLength(0)
    loop.handle({ type: 'load', snapshot, forces, alpha: 0.05 })
    runAll(runNext)
    frames.length = 0
    loop.handle({ type: 'forces', forces: { ...forces, linkDistance: 200 } })
    loop.handle({ type: 'hold', id: 'missing', x: 0, y: 0 })
    runNext()
    expect(frames).toHaveLength(1)
    loop.dispose()
    expect(queue).toHaveLength(0)
  })
})
