import type { JSX } from 'react'
import {
  imagePathForAssetKey,
  vagabondPawnTextureKey,
} from '#assets/gameAssets.ts'
import type {
  ForestPawnMarker,
  ForestPixelLayout,
} from '#game/forestLayout.ts'
import { PIECE_DRAW } from '#game/theme.ts'

export type ForestPawnLayerProps = {
  forestLayouts: readonly ForestPixelLayout[]
  forestPawns: readonly ForestPawnMarker[]
}

export function ForestPawnLayer(props: ForestPawnLayerProps): JSX.Element {
  const size = PIECE_DRAW.buildingIconSize
  const nodes: JSX.Element[] = []

  for (const marker of props.forestPawns) {
    const layout = props.forestLayouts.find(
      (entry) => entry.forestIndex === marker.forestIndex,
    )
    if (layout === undefined) continue

    const points = layout.corners
      .map((corner) => `${String(corner.x)},${String(corner.y)}`)
      .join(' ')
    nodes.push(
      <svg
        key={`forest-area-${String(marker.forestIndex)}-${String(marker.seat)}`}
        className="pointer-events-none absolute inset-0 z-2 overflow-visible"
        width="100%"
        height="100%"
        aria-hidden
      >
        <polygon
          points={points}
          fill="rgba(90, 140, 70, 0.22)"
          stroke="rgba(60, 100, 50, 0.55)"
          strokeWidth={2}
        />
      </svg>,
    )

    const pawnPath = imagePathForAssetKey(
      vagabondPawnTextureKey(marker.character),
    )
    if (pawnPath !== null) {
      nodes.push(
        <img
          key={`forest-pawn-${String(marker.seat)}`}
          className="pointer-events-none absolute z-3 -translate-x-1/2 -translate-y-1/2 object-fill select-none"
          src={pawnPath}
          alt={`Vagabond in forest ${String(marker.forestIndex)}`}
          draggable={false}
          style={{
            left: layout.centroid.x,
            top: layout.centroid.y,
            width: size,
            height: size,
          }}
        />,
      )
    }
  }

  return <>{nodes}</>
}
