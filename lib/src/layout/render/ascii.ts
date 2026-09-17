import type { GameMap } from '../../map/GameMap.js'
import type { MapLayout } from '../types.js'

/** Project clearings onto a coarse ASCII grid for terminal preview. */
export function toAscii(map: GameMap, layout: MapLayout, width = 40, height = 20): string {
  const grid: string[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => ' '),
  )

  const place = (x: number, y: number, ch: string) => {
    const col = Math.min(width - 1, Math.max(0, Math.round(x * (width - 1))))
    const row = Math.min(height - 1, Math.max(0, Math.round(y * (height - 1))))
    const cell = grid[row]!
    cell[col] = ch
  }

  for (const [a, b] of map.paths) {
    const pa = layout.clearings[a]
    const pb = layout.clearings[b]
    if (!pa || !pb) continue
    const steps = 8
    for (let i = 1; i < steps; i++) {
      const t = i / steps
      place(pa.x + (pb.x - pa.x) * t, pa.y + (pb.y - pa.y) * t, '·')
    }
  }

  for (const c of map.clearings) {
    const p = layout.clearings[c.id]
    if (!p) continue
    const label = c.id.toString(16).toUpperCase()
    place(p.x, p.y, label)
  }

  return grid.map((row) => row.join('')).join('\n')
}
