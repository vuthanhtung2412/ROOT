import type { FactionBoard } from '#state/boards.js'

export type WarriorSupply = { warriors: number }

/** Warrior supply of a faction board; the Vagabond and Vagabot have no warriors. */
export function warriorSupplyOf(board: FactionBoard): WarriorSupply | null {
  if (board.kind === 'vagabond' || board.kind === 'vagabot') return null
  return board.supply
}
