import type { FactionBoard } from '#state/boards.js'

export type WarriorSupply = { warriors: number }

/** Warrior supply of a faction board; the Vagabond has no warriors. */
export function warriorSupplyOf(board: FactionBoard): WarriorSupply | null {
  if (board.kind === 'vagabond') return null
  return board.supply
}
