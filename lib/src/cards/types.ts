import type { Suit } from '../map/types.js'
import type { ItemType } from '../pieces/types.js'

export type CardSuit = Suit | 'bird'
export type CostSuit = Suit | 'wild'

export type CardType =
  | 'item'
  | 'persistent'
  | 'partisan'
  | 'ambush'
  | 'dominance'

export type CardDef = {
  defId: string
  name: string
  suit: CardSuit
  type: CardType
  cost: CostSuit[]
  item?: ItemType
  vp?: number
  description: string
  image: string
  copies: number
}

/** One physical card copy. `id` = `${defId}#${n}`. */
export type Card = {
  id: string
  defId: string
}
