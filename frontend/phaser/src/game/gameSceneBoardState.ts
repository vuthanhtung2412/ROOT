import type { GameState } from '#api/client.ts'
import { createPhaserApi } from '#api/client.ts'
import { resolveDefaultApiBaseUrl } from '#api/defaultApiBaseUrl.ts'
import {
  boardLayoutFromFallResponse,
  FALL_BOARD_LAYOUT,
  type BoardLayout,
} from '#game/boardLayout.ts'
import {
  applyMarchMovesToClearings,
  type MarchPreviewMove,
} from '#game/resolution/marchClearingsPreview.ts'

export async function loadGameSceneBoardLayout(): Promise<BoardLayout> {
  try {
    const api = createPhaserApi({ baseUrl: resolveDefaultApiBaseUrl() })
    const response = await api.fallLayout()
    return boardLayoutFromFallResponse(response)
  } catch {
    return FALL_BOARD_LAYOUT
  }
}

export function buildCurrentSeatWarriorCounts(
  state: GameState | null,
): Map<number, number> {
  const counts: Map<number, number> = new Map<number, number>()
  if (state === null) {
    return counts
  }

  state.clearings.forEach((clearing, clearingId) => {
    const warriorCount: number = clearing.pieces.filter(
      (piece) =>
        piece.kind === 'warrior' && piece.owner === state.currentSeat,
    ).length
    if (warriorCount > 0) {
      counts.set(clearingId, warriorCount)
    }
  })
  return counts
}

export function applyMarchPreview(
  clearings: GameState['clearings'],
  warriorOwnerSeat: number,
  firstMove: MarchPreviewMove | null,
): GameState['clearings'] {
  if (firstMove === null) {
    return clearings
  }
  return applyMarchMovesToClearings(clearings, warriorOwnerSeat, [firstMove])
}
