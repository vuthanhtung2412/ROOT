import type { GameState } from '#api/client.ts'

type Clearings = GameState['clearings']

const WARRIOR_KIND = 'warrior'

/**
 * Type of the item at `itemIndex` in the Crafted Items box of the player whose
 * turn it is; null when there is none.
 */
export function craftedItemTypeOfCurrentPlayer(
  state: GameState,
  itemIndex: number,
): string | null {
  const currentPlayer = state.players.find(
    (player): boolean => player.seat === state.currentSeat,
  )
  const item = currentPlayer?.craftedItems?.[itemIndex]
  if (item === undefined) return null
  return typeof item === 'string' ? item : item.type
}

/** Seat owning the warrior `pieceId` on the map; null when it is not there. */
export function warriorOwnerSeat(
  clearings: Clearings,
  pieceId: string,
): number | null {
  for (const clearing of clearings) {
    for (const piece of clearing.pieces) {
      if (piece.id === pieceId && piece.kind === WARRIOR_KIND) {
        return piece.owner
      }
    }
  }
  return null
}
