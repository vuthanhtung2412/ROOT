import type { GameMap } from '#map/GameMap.js'
import type { MapLayout } from '#layout/types.js'
import {
  fallForestLayouts,
  type FallForestLayout,
  type FallLayoutPoint2d,
} from '#public/fallMetadata.js'

export type AsciiOpts = {
  width?: number
  height?: number
  /** Append suit letter: fox=F rabbit=R mouse=M (e.g. `0F`, `10R`). */
  showSuit?: boolean
  /**
   * Draw forest polygons (fill + edge + label at centroid).
   * Empty=`:` fill + `[f#]`; occupied=`*` fill + `[V#]`.
   * Rule: Board > Forests (2.4)
   */
  showForests?: boolean
  /** Forest index → occupant marker (default `V` when set). */
  occupiedForests?: ReadonlyMap<number, string>
}

const SUIT_LETTER: Record<string, string> = {
  fox: 'F',
  rabbit: 'R',
  mouse: 'M',
}

const FOREST_FILL_EMPTY = ':'
const FOREST_FILL_OCCUPIED = '*'
const FOREST_EDGE = '+'

/** Ray-cast point-in-polygon (normalized 0..1 coords). */
function pointInPolygon(
  pointX: number,
  pointY: number,
  polygon: readonly FallLayoutPoint2d[],
): boolean {
  let inside = false
  for (
    let index = 0, previous = polygon.length - 1;
    index < polygon.length;
    previous = index, index++
  ) {
    const current = polygon[index]!
    const prior = polygon[previous]!
    const crosses =
      current.y > pointY !== prior.y > pointY &&
      pointX <
        ((prior.x - current.x) * (pointY - current.y)) / (prior.y - current.y) +
          current.x
    if (crosses) inside = !inside
  }
  return inside
}

function distanceSquared(
  left: FallLayoutPoint2d,
  right: FallLayoutPoint2d,
): number {
  const dx = left.x - right.x
  const dy = left.y - right.y
  return dx * dx + dy * dy
}

/**
 * Pick owning forest for a cell: among polygons that contain the point,
 * nearest centroid wins (clearing-center hulls overlap at shared edges).
 */
function owningForest(
  point: FallLayoutPoint2d,
  forests: readonly FallForestLayout[],
): FallForestLayout | null {
  let best: FallForestLayout | null = null
  let bestDistance = Number.POSITIVE_INFINITY
  for (const forest of forests) {
    if (!pointInPolygon(point.x, point.y, forest.corners)) continue
    const distance = distanceSquared(point, forest.centroid)
    if (distance < bestDistance) {
      bestDistance = distance
      best = forest
    }
  }
  return best
}

/** Project clearings (+ optional forests) onto a coarse ASCII grid. */
export function toAscii(
  map: GameMap,
  layout: MapLayout,
  widthOrOpts: number | AsciiOpts = 40,
  heightArg = 20,
): string {
  const opts: AsciiOpts =
    typeof widthOrOpts === 'number'
      ? { width: widthOrOpts, height: heightArg }
      : widthOrOpts
  const width = opts.width ?? 40
  const height = opts.height ?? 20
  const showSuit = opts.showSuit ?? false
  const showForests = opts.showForests ?? false
  const occupiedForests = opts.occupiedForests

  const cells: string[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => ' '),
  )

  const toCol = (x: number): number =>
    Math.min(width - 1, Math.max(0, Math.round(x * (width - 1))))
  const toRow = (y: number): number =>
    Math.min(height - 1, Math.max(0, Math.round(y * (height - 1))))

  const setCell = (col: number, row: number, ch: string): void => {
    if (col < 0 || col >= width || row < 0 || row >= height) return
    cells[row]![col] = ch
  }

  const placeChar = (x: number, y: number, ch: string): void => {
    setCell(toCol(x), toRow(y), ch)
  }

  const placeText = (x: number, y: number, text: string): void => {
    const col0 = Math.min(
      width - text.length,
      Math.max(0, Math.round(x * (width - 1) - (text.length - 1) / 2)),
    )
    const row = toRow(y)
    for (let i = 0; i < text.length; i++) {
      setCell(col0 + i, row, text[i]!)
    }
  }

  const drawEdge = (
    from: FallLayoutPoint2d,
    to: FallLayoutPoint2d,
    ch: string,
  ): void => {
    const steps = Math.max(
      4,
      Math.ceil(
        Math.hypot((to.x - from.x) * width, (to.y - from.y) * height) * 1.2,
      ),
    )
    for (let step = 0; step <= steps; step++) {
      const t = step / steps
      placeChar(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t, ch)
    }
  }

  for (const [a, b] of map.paths) {
    const pa = layout.clearings[a]
    const pb = layout.clearings[b]
    if (!pa || !pb) continue
    const steps = 8
    for (let i = 1; i < steps; i++) {
      const t = i / steps
      placeChar(pa.x + (pb.x - pa.x) * t, pa.y + (pb.y - pa.y) * t, '·')
    }
  }

  if (showForests) {
    const forests = fallForestLayouts()
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const point = {
          x: width === 1 ? 0 : col / (width - 1),
          y: height === 1 ? 0 : row / (height - 1),
        }
        const owner = owningForest(point, forests)
        if (owner === null) continue
        const occupied = occupiedForests?.has(owner.forestIndex) === true
        const fill = occupied ? FOREST_FILL_OCCUPIED : FOREST_FILL_EMPTY
        const current = cells[row]![col]!
        if (current === ' ' || current === '·') {
          setCell(col, row, fill)
        }
      }
    }
    for (const forest of forests) {
      for (let index = 0; index < forest.corners.length; index++) {
        const from = forest.corners[index]!
        const to = forest.corners[(index + 1) % forest.corners.length]!
        drawEdge(from, to, FOREST_EDGE)
      }
    }
    for (const forest of forests) {
      const occupant = occupiedForests?.get(forest.forestIndex)
      const label =
        occupant !== undefined
          ? `[${occupant}${forest.forestIndex}]`
          : `[f${forest.forestIndex}]`
      placeText(forest.centroid.x, forest.centroid.y, label)
    }
  }

  for (const c of map.clearings) {
    const p = layout.clearings[c.id]
    if (!p) continue
    if (showSuit) {
      const suit = SUIT_LETTER[c.suit] ?? '?'
      placeText(p.x, p.y, `${c.id}${suit}`)
    } else {
      placeText(p.x, p.y, c.id.toString(16).toUpperCase())
    }
  }

  return cells.map((row) => row.join('')).join('\n')
}
