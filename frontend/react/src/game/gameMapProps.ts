import type { BoardEffectBatch } from '#game/boardEffects.ts'
import type { BoardLayout } from '#game/boardLayout.ts'
import type { ClearingFlash } from '#game/clearingFlash.ts'
import type { ForestPawnMarker } from '#game/forestLayout.ts'
import type { ViewportLayoutMode } from '#game/viewportLayout.ts'
import type { BoardClearingPieces } from '#react/PieceStack.tsx'

export type ClearingSelectedHandler = (clearingId: number) => void
export type ForestSelectedHandler = (forestIndex: number) => void

export type GameMapProps = {
  layout?: BoardLayout
  layoutMode?: ViewportLayoutMode
  viewWidth?: number
  viewHeight?: number
  highlightedClearingIds?: readonly number[]
  highlightedForestIndexes?: readonly number[]
  clearings?: readonly BoardClearingPieces[]
  factions?: readonly string[]
  forestPawns?: readonly ForestPawnMarker[]
  /** What the last server update changed on the map. */
  effects?: BoardEffectBatch
  /** Game log: the clearing to point at for a moment. */
  flashedClearing?: ClearingFlash | null
  onClearingSelected?: ClearingSelectedHandler
  onForestSelected?: ForestSelectedHandler
}
