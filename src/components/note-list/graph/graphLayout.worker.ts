import { type SimulationCommand, SimulationLoop } from './graphSimulationLoop'

/** One worker per graph canvas runs the live force simulation off the main thread. */
const loop = new SimulationLoop((frame) => self.postMessage(frame), {
  later: (step, delayMs) => {
    const timer = setTimeout(step, delayMs)
    return () => clearTimeout(timer)
  },
  now: () => performance.now(),
})

self.onmessage = (event: MessageEvent<SimulationCommand>) => loop.handle(event.data)
