import { type GraphForces, type GraphLayoutSnapshot, GraphSimulation } from './graphSimulation'

/** Messages the canvas sends to the simulation (in a worker, or inline without workers). */
export type SimulationCommand =
  | { type: 'load'; snapshot: GraphLayoutSnapshot; forces: GraphForces; alpha: number }
  | { type: 'hold'; id: string; x: number; y: number }
  | { type: 'release'; id: string }
  | { type: 'forces'; forces: GraphForces }

/** One frame of positions back from the simulation; `resting` is the last frame until the next command. */
export interface SimulationFrame {
  ids: string[]
  positions: number[]
  resting: boolean
}

export interface SimulationScheduler {
  /** Runs `step` after roughly `delayMs`; returns a cancel function. */
  later: (step: () => void, delayMs: number) => () => void
  now: () => number
}

const FRAME_MS = 16
/** While the first layout is still far from settled, spend up to this much of each frame on ticks. */
const WARMUP_BUDGET_MS = 8
const WARMUP_ALPHA = 0.1
/** Reheat for a slider move: visible, but calmer than a fresh layout. */
const FORCES_ALPHA = 0.5

/**
 * Drives a GraphSimulation one frame at a time and posts positions after every frame. A fresh layout
 * fast-forwards (several ticks per frame) until it is roughly in shape; interaction runs in real time,
 * one tick per frame. Once the graph is at rest nothing is scheduled, so an idle graph costs nothing.
 */
export class SimulationLoop {
  private simulation: GraphSimulation | null = null
  private index = new Map<string, number>()
  private cancel: (() => void) | null = null
  private warmup = false
  private readonly post: (frame: SimulationFrame) => void
  private readonly scheduler: SimulationScheduler

  constructor(post: (frame: SimulationFrame) => void, scheduler: SimulationScheduler) {
    this.post = post
    this.scheduler = scheduler
  }

  handle(command: SimulationCommand) {
    if (command.type === 'load') this.load(command.snapshot, command.forces, command.alpha)
    else if (command.type === 'forces') this.reheatWith(command.forces)
    else if (command.type === 'hold') this.hold(command.id, command.x, command.y)
    else this.release(command.id)
    this.wake()
  }

  dispose() {
    this.cancel?.()
    this.cancel = null
    this.simulation = null
  }

  private load(snapshot: GraphLayoutSnapshot, forces: GraphForces, alpha: number) {
    this.simulation = new GraphSimulation(snapshot, forces, alpha)
    this.index = new Map(snapshot.ids.map((id, position) => [id, position]))
    this.warmup = alpha > WARMUP_ALPHA
  }

  private reheatWith(forces: GraphForces) {
    this.simulation?.applyForces(forces)
    this.simulation?.reheat(FORCES_ALPHA)
    this.warmup = false
  }

  private hold(id: string, x: number, y: number) {
    const position = this.index.get(id)
    if (position === undefined) return
    this.simulation?.hold(position, x, y)
    this.warmup = false
  }

  private release(id: string) {
    const position = this.index.get(id)
    if (position !== undefined) this.simulation?.release(position)
  }

  private wake() {
    if (!this.cancel) this.cancel = this.scheduler.later(() => this.step(), 0)
  }

  private runTicks(simulation: GraphSimulation) {
    const started = this.scheduler.now()
    simulation.tick()
    while (this.warmup && simulation.alpha() > WARMUP_ALPHA && this.scheduler.now() - started < WARMUP_BUDGET_MS) simulation.tick()
    if (simulation.alpha() <= WARMUP_ALPHA) this.warmup = false
  }

  private step() {
    this.cancel = null
    const simulation = this.simulation
    if (!simulation) return
    this.runTicks(simulation)
    const resting = simulation.isResting()
    this.post({ ids: simulation.ids, positions: simulation.positions(), resting })
    if (!resting) this.cancel = this.scheduler.later(() => this.step(), FRAME_MS)
  }
}
