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

export type BuildingType = 'sawmill' | 'workshop' | 'recruiter' | 'roost' | 'base'

export type TokenType = 'wood' | 'keep' | 'sympathy'

type PieceBase = {
  id: string
  owner: Seat
}

export type Warrior = PieceBase & { kind: 'warrior' }
export type Pawn = PieceBase & { kind: 'pawn' }
export type Building = PieceBase & {
  kind: 'building'
  type: BuildingType
  used: boolean
}
export type Token = PieceBase & {
  kind: 'token'
  type: TokenType
}

export type Piece = Warrior | Pawn | Building | Token
