/**
 * Rootbotics 2.1 priority markers: shown by each clearing's suit while a bot
 * plays (a human seat run by an AI player uses no priority).
 */
import { clearingPriority } from '@root/lib'
import { isBotFaction } from '@root/lib/bot-factions'

const NO_PRIORITIES: ReadonlyMap<number, number> = new Map<number, number>()

export function botClearingPriorities(
  factions: readonly string[],
  clearingIds: readonly number[],
): ReadonlyMap<number, number> {
  if (!factions.some((faction: string): boolean => isBotFaction(faction))) {
    return NO_PRIORITIES
  }
  return new Map<number, number>(
    clearingIds.map((clearingId: number): [number, number] => [clearingId, clearingPriority(clearingId)]),
  )
}
