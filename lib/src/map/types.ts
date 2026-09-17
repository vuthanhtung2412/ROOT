export type Suit = 'fox' | 'rabbit' | 'mouse'

export type ClearingId = number

export type Clearing = {
  id: ClearingId
  suit: Suit
  slots: number
  ruinSlot: boolean
}

export type Path = [ClearingId, ClearingId]
