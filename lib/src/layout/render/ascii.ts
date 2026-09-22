import type { GameMap } from '#map/GameMap.js'
import type { MapLayout } from '#layout/types.js'

export type AsciiOpts = {
  width?: number
  height?: number
  /** Append suit letter: fox=F rabbit=R mouse=M (e.g. `0F`, `10R`). */
  showSuit?: boolean
}

const SUIT_LETTER: Record<string, string> = {
  fox: 'F',
  rabbit: 'R',
  mouse: 'M',
}

/** Project clearings onto a coarse ASCII grid for terminal preview. */
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

  const cells: string[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => ' '),
  )

  const placeChar = (x: number, y: number, ch: string): void => {
    const col = Math.min(width - 1, Math.max(0, Math.round(x * (width - 1))))
    const row = Math.min(height - 1, Math.max(0, Math.round(y * (height - 1))))
    cells[row]![col] = ch
  }

  const placeText = (x: number, y: number, text: string): void => {
    const col0 = Math.min(
      width - text.length,
      Math.max(0, Math.round(x * (width - 1) - (text.length - 1) / 2)),
    )
    const row = Math.min(height - 1, Math.max(0, Math.round(y * (height - 1))))
    for (let i = 0; i < text.length; i++) {
      const col = col0 + i
      if (col >= 0 && col < width) cells[row]![col] = text[i]!
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
