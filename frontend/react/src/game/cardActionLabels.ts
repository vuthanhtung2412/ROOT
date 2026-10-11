import type { GameState } from '#api/client.ts'

type Clearings = GameState['clearings']

const WARRIOR_KIND = 'warrior'

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
