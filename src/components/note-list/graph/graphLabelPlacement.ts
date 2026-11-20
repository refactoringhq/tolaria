/** A label that may be drawn this frame, in priority order (hovered, then open and focused notes, then by links). */
export interface LabelCandidate {
  id: string
  /** The node centre on screen. */
  x: number
  y: number
  /** The node radius on screen. */
  radius: number
  width: number
  /** Hovered, open and focused notes keep their label at any zoom and in any crowd. */
  forced: boolean
}

export interface NodeDisc {
  id: string
  x: number
  y: number
  radius: number
}

export interface LabelBox {
  left: number
  top: number
  right: number
  bottom: number
}

interface Viewport {
  width: number
  height: number
}

interface Obstacle {
  box: LabelBox
  owner: string | null
}

export const LABEL_GAP_PX = 5
export const LABEL_HEIGHT_PX = 18
const CELL_PX = 64
/** Labels are fully shown from this zoom (screen pixels per graph unit) at the default threshold. */
export const LABEL_FADE_ZOOM = 0.5

/** Label opacity for the camera: 1 at or above the fade zoom, 0 one halving below it, eased in between. */
export function labelZoomOpacity(cameraRatio: number, threshold: number): number {
  const fullZoom = LABEL_FADE_ZOOM * 2 ** threshold
  const progress = Math.log2(1 / cameraRatio / fullZoom) + 1
  return Math.min(1, Math.max(0, progress))
}

/** Where a label sits around its node. Below is the default; forced labels try the others when crowded. */
export type LabelSide = 'below' | 'above' | 'right' | 'left'

const SIDES: readonly LabelSide[] = ['below', 'above', 'right', 'left']

type LabelAnchor = Pick<LabelCandidate, 'x' | 'y' | 'radius' | 'width'>

function boxAt(left: number, top: number, width: number): LabelBox {
  return { left, top, right: left + width, bottom: top + LABEL_HEIGHT_PX }
}

const SIDE_BOXES: Readonly<Record<LabelSide, (anchor: LabelAnchor) => LabelBox>> = {
  below: ({ x, y, radius, width }) => boxAt(x - width / 2, y + radius + LABEL_GAP_PX, width),
  above: ({ x, y, radius, width }) => boxAt(x - width / 2, y - radius - LABEL_GAP_PX - LABEL_HEIGHT_PX, width),
  right: ({ x, y, radius, width }) => boxAt(x + radius + LABEL_GAP_PX, y - LABEL_HEIGHT_PX / 2, width),
  left: ({ x, y, radius, width }) => boxAt(x - radius - LABEL_GAP_PX - width, y - LABEL_HEIGHT_PX / 2, width),
}

export function labelBoxFor(candidate: LabelAnchor, side: LabelSide = 'below'): LabelBox {
  return SIDE_BOXES[side](candidate)
}

function discBox({ x, y, radius }: NodeDisc): LabelBox {
  return { left: x - radius, top: y - radius, right: x + radius, bottom: y + radius }
}

function overlaps(left: LabelBox, right: LabelBox): boolean {
  return left.left < right.right && right.left < left.right && left.top < right.bottom && right.top < left.bottom
}

function onScreen(box: LabelBox, viewport: Viewport): boolean {
  return box.right > 0 && box.left < viewport.width && box.bottom > 0 && box.top < viewport.height
}

/** Cells per grid row; screen coordinates never come close, so a cell's key is column * stride + row. */
const GRID_STRIDE = 1 << 16
const GRID_OFFSET = 1 << 15

/** A uniform grid of screen cells, so each label only checks the obstacles near it. */
class ObstacleGrid {
  private readonly cells = new Map<number, Obstacle[]>()

  private visit(box: LabelBox, visitor: (key: number) => boolean): boolean {
    const lastColumn = Math.floor(box.right / CELL_PX)
    const lastRow = Math.floor(box.bottom / CELL_PX)
    for (let column = Math.floor(box.left / CELL_PX); column <= lastColumn; column += 1) {
      for (let row = Math.floor(box.top / CELL_PX); row <= lastRow; row += 1) {
        if (visitor((column + GRID_OFFSET) * GRID_STRIDE + row + GRID_OFFSET)) return true
      }
    }
    return false
  }

  add(obstacle: Obstacle) {
    this.visit(obstacle.box, (key) => {
      const cell = this.cells.get(key)
      if (cell) cell.push(obstacle)
      else this.cells.set(key, [obstacle])
      return false
    })
  }

  blocked(box: LabelBox, owner: string): boolean {
    return this.visit(box, (key) => (this.cells.get(key) ?? []).some((obstacle) => obstacle.owner !== owner && overlaps(obstacle.box, box)))
  }
}

/** One frame's placement inputs. `sides` remembers each forced label's side between frames, so it doesn't flip. */
export interface PlacementFrame {
  viewport: Viewport
  /** False when zoomed out past the fade: only forced labels show. */
  allowUnforced: boolean
  sides: Map<string, LabelSide>
}

/** A forced label keeps last frame's side while it is free, else takes the first free side, else stays below. */
function forcedBox(candidate: LabelCandidate, grid: ObstacleGrid, sides: Map<string, LabelSide>): LabelBox {
  const previous = sides.get(candidate.id) ?? 'below'
  const order = [previous, ...SIDES.filter((side) => side !== previous)]
  const side = order.find((option) => !grid.blocked(labelBoxFor(candidate, option), candidate.id)) ?? 'below'
  sides.set(candidate.id, side)
  return labelBoxFor(candidate, side)
}

function unforcedBox(candidate: LabelCandidate, grid: ObstacleGrid, allowUnforced: boolean): LabelBox | null {
  const box = labelBoxFor(candidate)
  return allowUnforced && !grid.blocked(box, candidate.id) ? box : null
}

/**
 * Greedy placement in priority order. Forced labels always show, moving around their node to stay clear of
 * each other. Every other label needs room below its node: it may not cover a label already placed, nor
 * another note's circle, so a dense centre stays unlabelled until zoom spreads it out.
 */
export function placeLabels(candidates: readonly LabelCandidate[], discs: readonly NodeDisc[], frame: PlacementFrame): Map<string, LabelBox> {
  const grid = new ObstacleGrid()
  for (const disc of discs) {
    const box = discBox(disc)
    if (onScreen(box, frame.viewport)) grid.add({ box, owner: disc.id })
  }
  const placed = new Map<string, LabelBox>()
  for (const candidate of candidates) {
    const box = candidate.forced ? forcedBox(candidate, grid, frame.sides) : unforcedBox(candidate, grid, frame.allowUnforced)
    if (!box || !onScreen(box, frame.viewport)) continue
    grid.add({ box, owner: null })
    placed.set(candidate.id, box)
  }
  return placed
}
