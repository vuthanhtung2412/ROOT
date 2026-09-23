export type FactionId = 'marquise' | 'eyrie' | 'alliance' | 'vagabond'

export type Seat = 0 | 1 | 2 | 3

export type ItemType =
  | 'boot'
  | 'bag'
  | 'crossbow'
  | 'hammer'
  | 'sword'
  | 'tea'
  | 'coin'
  | 'torch'

/** Buildings that can craft cards (activate once per turn). */
export type CraftingBuildingType = 'workshop' | 'roost'

/** Buildings that never craft. */
export type NonCraftingBuildingType = 'sawmill' | 'recruiter' | 'base'

export type BuildingType = CraftingBuildingType | NonCraftingBuildingType

export type TokenType = 'wood' | 'keep' | 'sympathy'

type PieceBase = {
  id: string
  owner: Seat
}

export type Warrior = PieceBase & { kind: 'warrior' }
export type Pawn = PieceBase & { kind: 'pawn' }

/**
 * Rule: Craft — each crafting piece activates once per turn.
 * Only workshop (Marquise) / roost (Eyrie) carry `used`; reset on endTurn.
 */
export type CraftingBuilding = PieceBase & {
  kind: 'building'
  type: CraftingBuildingType
  used: boolean
}

export type NonCraftingBuilding = PieceBase & {
  kind: 'building'
  type: NonCraftingBuildingType
}

export type Building = CraftingBuilding | NonCraftingBuilding

export type Token = PieceBase & {
  kind: 'token'
  type: TokenType
}

export type Piece = Warrior | Pawn | Building | Token

export function isCraftingBuilding(piece: Piece): piece is CraftingBuilding {
  return (
    piece.kind === 'building' &&
    (piece.type === 'workshop' || piece.type === 'roost')
  )
}
