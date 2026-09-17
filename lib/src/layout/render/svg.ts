import type { GameMap } from '../../map/GameMap.js'
import type { MapLayout } from '../types.js'

const SUIT_COLOR: Record<string, string> = {
  fox: '#c45c26',
  rabbit: '#e8b923',
  mouse: '#d4782a',
}

/** Render map graph as SVG overlay (viewBox 0..1). Optional state omitted for now. */
export function toSvg(map: GameMap, layout: MapLayout): string {
  const lines: string[] = []
  lines.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1">`)
  lines.push(`  <image href="${layout.image}" x="0" y="0" width="1" height="1" preserveAspectRatio="xMidYMid slice"/>`)

  for (const [a, b] of map.paths) {
    const pa = layout.clearings[a]
    const pb = layout.clearings[b]
    if (!pa || !pb) continue
    lines.push(
      `  <line x1="${pa.x}" y1="${pa.y}" x2="${pb.x}" y2="${pb.y}" stroke="#333" stroke-width="0.004" stroke-dasharray="0.01 0.008"/>`,
    )
  }

  for (const c of map.clearings) {
    const p = layout.clearings[c.id]
    if (!p) continue
    const fill = SUIT_COLOR[c.suit] ?? '#888'
    lines.push(
      `  <circle cx="${p.x}" cy="${p.y}" r="${p.r}" fill="${fill}" fill-opacity="0.35" stroke="#222" stroke-width="0.003"/>`,
    )
    lines.push(
      `  <text x="${p.x}" y="${p.y}" text-anchor="middle" dominant-baseline="central" font-size="0.04" fill="#111">${c.id}</text>`,
    )
  }

  lines.push(`</svg>`)
  return lines.join('\n')
}
