export type FactionId =
  | 'marquise'
  | 'eyrie'
  | 'alliance'
  | 'vagabond'
  | 'lizard'
  | 'riverfolk'
  /** Rule: Rootbotics 4 — bot replacing the Marquise de Cat. */
  | 'mechanicalMarquise'
  /** Rule: Rootbotics 5 — bot replacing the Eyrie Dynasties. */
  | 'electricEyrie'
  /** Rule: Rootbotics 6 — bot replacing the Woodland Alliance. */
  | 'automatedAlliance'
  /** Rule: Rootbotics 7 — bot replacing the Vagabond. */
  | 'vagabot'

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
export type CraftingBuildingType = 'workshop' | 'roost' | 'garden'

/** Buildings that never craft. */
export type NonCraftingBuildingType = 'sawmill' | 'recruiter' | 'base'

export type BuildingType = CraftingBuildingType | NonCraftingBuildingType

export type TokenType = 'wood' | 'keep' | 'sympathy' | 'tradePost'

type PieceBase = {
  id: string
  owner: Seat
}

export type Warrior = PieceBase & { kind: 'warrior' }
export type Pawn = PieceBase & { kind: 'pawn' }

/**
 * Rule: Craft — each crafting piece activates once per turn.
 * Workshop (Marquise) / roost (Eyrie) / garden (Lizard Cult) carry `used`;
 * reset on endTurn.
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

export function isCraftingBuildingType(
  type: BuildingType,
): type is CraftingBuildingType {
  return type === 'workshop' || type === 'roost' || type === 'garden'
}

export function isCraftingBuilding(piece: Piece): piece is CraftingBuilding {
  return piece.kind === 'building' && isCraftingBuildingType(piece.type)
}
