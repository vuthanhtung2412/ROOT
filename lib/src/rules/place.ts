import type { BuildingType, Seat, TokenType } from '#pieces/types.js'
import type {
  CraftingBuilding,
  NonCraftingBuilding,
  Piece,
  Token,
  Warrior,
} from '#pieces/types.js'
import type { ClearingId } from '#map/types.js'
import { canPlace } from '#queries/place.js'
import { openSlots } from '#queries/slots.js'
import type { GameState } from '#state/types.js'
import { playerOf } from '#queries/seat.js'

export type PlaceSpec =
  | { kind: 'warrior' }
  | { kind: 'token'; type: TokenType }
  | { kind: 'building'; type: BuildingType }

export type PlaceRequest = {
  seat: Seat
  clearing: ClearingId
  spec: PlaceSpec
  count: number
}

let nextPieceId = 0

function newPieceId(prefix: string): string {
  nextPieceId += 1
  return `${prefix}-${nextPieceId}`
}

/** Reset id counter for deterministic tests. */
export function resetPlaceIds(): void {
  nextPieceId = 0
}

/** Rule: Pieces — place max possible; capped by supply and open slots. */
export function placeUpTo(state: GameState, request: PlaceRequest): number {
  return placeInternal(state, request, true)
}

/**
 * Place pieces already removed from the map (e.g. Field Hospitals).
 * Does not draw from supply — leftover count stays unplaced (caller returns to supply).
 */
export function placeReturning(state: GameState, request: PlaceRequest): number {
  return placeInternal(state, request, false)
}

function placeInternal(
  state: GameState,
  request: PlaceRequest,
  fromSupply: boolean,
): number {
  const { seat, clearing, spec, count } = request
  if (count <= 0) return 0
  if (!canPlace(state, seat, clearing)) return 0

  const clearingState = state.clearings[clearing]
  if (!clearingState) return 0

  let placed = 0
  while (placed < count) {
    if (spec.kind === 'building' && openSlots(state, clearing) < 1) break
    if (fromSupply && !takeFromSupply(state, seat, spec)) break

    const piece = makePiece(seat, spec)
    clearingState.pieces.push(piece)
    placed += 1
  }

  return placed
}

function takeFromSupply(state: GameState, seat: Seat, spec: PlaceSpec): boolean {
  const board = playerOf(state, seat).board
  switch (spec.kind) {
    case 'warrior': {
      if (board.kind === 'marquise' && board.supply.warriors > 0) {
        board.supply.warriors -= 1
        return true
      }
      if (board.kind === 'eyrie' && board.supply.warriors > 0) {
        board.supply.warriors -= 1
        return true
      }
      if (board.kind === 'alliance' && board.supply.warriors > 0) {
        board.supply.warriors -= 1
        return true
      }
      return false
    }
    case 'token': {
      if (spec.type === 'wood' && board.kind === 'marquise' && board.supply.wood > 0) {
        board.supply.wood -= 1
        return true
      }
      // keep / sympathy: no supply pool in Phase 3
      return spec.type !== 'wood'
    }
    case 'building':
      return true
  }
}

function makePiece(seat: Seat, spec: PlaceSpec): Piece {
  switch (spec.kind) {
    case 'warrior':
      return { id: newPieceId('w'), kind: 'warrior', owner: seat } satisfies Warrior
    case 'token':
      return {
        id: newPieceId('t'),
        kind: 'token',
        owner: seat,
        type: spec.type,
      } satisfies Token
    case 'building': {
      // Rule: Craft — only workshop/roost activate; others have no `used`.
      if (spec.type === 'workshop' || spec.type === 'roost') {
        return {
          id: newPieceId('b'),
          kind: 'building',
          owner: seat,
          type: spec.type,
          used: false,
        } satisfies CraftingBuilding
      }
      return {
        id: newPieceId('b'),
        kind: 'building',
        owner: seat,
        type: spec.type,
      } satisfies NonCraftingBuilding
    }
  }
}
