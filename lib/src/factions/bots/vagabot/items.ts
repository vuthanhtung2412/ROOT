import type { ItemType } from '#pieces/types.js'
import type { VagabotBoard, VagabotItem } from '#state/botBoards.js'

/** Rule: Rootbotics 7.2.4 — undamaged items needed for each Battle Track slot. */
const BATTLE_TRACK_THRESHOLDS: readonly number[] = [6, 9, 12]
/** Rule: Rootbotics 7.2.4 — maximum rolled hits start at one. */
const BASE_MAXIMUM_ROLLED_HITS = 1
/** Rule: Rootbotics 7.2.4 — the sixth and ninth items raise maximum hits. */
const SLOTS_RAISING_MAXIMUM_HITS = 2
/** Rule: Rootbotics 7.2.4 — the twelfth item: one extra hit as attacker. */
const SLOTS_FOR_ATTACKER_EXTRA_HIT = 3

export function isUndamaged(item: VagabotItem): boolean {
  return !item.damaged
}

export function undamagedItems(board: VagabotBoard): VagabotItem[] {
  return board.items.filter(isUndamaged)
}

export function damagedItems(board: VagabotBoard): VagabotItem[] {
  return board.items.filter((item: VagabotItem): boolean => item.damaged)
}

/** Battle Track slots filled by a count of items (Rootbotics 7.2.4). */
export function battleTrackSlotsFor(itemCount: number): number {
  return BATTLE_TRACK_THRESHOLDS.filter((threshold: number): boolean => itemCount >= threshold)
    .length
}

/**
 * Rule: Rootbotics 7.2.4 — Battle Track slots in use. Trait Questing:
 * damaged items count too and filled slots never empty again.
 */
export function battleTrackSlots(board: VagabotBoard): number {
  if (!board.questingBattleTrack) return battleTrackSlotsFor(undamagedItems(board).length)
  return Math.max(battleTrackSlotsFor(board.items.length), board.battleTrackRecord)
}

function staysOnTrack(board: VagabotBoard): (item: VagabotItem) => boolean {
  return (item: VagabotItem): boolean =>
    item.onBattleTrack && (board.questingBattleTrack || !item.damaged)
}

/**
 * Rule: Rootbotics 7.2.4 / 7.2.5 — fill the Battle Track up to its slots,
 * exhausted items before face-up ones; damaged items go back to the Satchel
 * (not with Questing).
 */
export function syncBattleTrack(board: VagabotBoard): void {
  const slots = battleTrackSlots(board)
  board.battleTrackRecord = Math.max(board.battleTrackRecord, slots)
  for (const item of board.items) {
    if (!staysOnTrack(board)(item)) item.onBattleTrack = false
  }
  const onTrack = board.items.filter(staysOnTrack(board))
  for (const extra of onTrack.slice(slots)) extra.onBattleTrack = false
  const free = board.items.filter(
    (item: VagabotItem): boolean =>
      !item.onBattleTrack && (board.questingBattleTrack || !item.damaged),
  )
  const candidates = [
    ...free.filter((item: VagabotItem): boolean => item.exhausted),
    ...free.filter((item: VagabotItem): boolean => !item.exhausted),
  ]
  for (const added of candidates.slice(0, Math.max(0, slots - onTrack.length))) {
    added.onBattleTrack = true
  }
}

function isExhaustible(item: VagabotItem): boolean {
  return !item.damaged && !item.exhausted && !item.onBattleTrack
}

/** Rule: Rootbotics 7.2.4 — face-up items in the Satchel (not on the track). */
export function exhaustibleItemCount(board: VagabotBoard): number {
  return board.items.filter(isExhaustible).length
}

/** Rule: Rootbotics 7.2.3 — exhaust items: flip face-up Satchel items face down. */
export function exhaustItems(board: VagabotBoard, count: number): boolean {
  const exhaustible = board.items.filter(isExhaustible)
  if (count > exhaustible.length) return false
  for (const item of exhaustible.slice(0, count)) item.exhausted = true
  return true
}

/** Rule: Rootbotics 7.2.4 — 1, +1 with six undamaged items, +1 with nine. */
export function maximumRolledHits(board: VagabotBoard): number {
  return BASE_MAXIMUM_ROLLED_HITS + Math.min(battleTrackSlots(board), SLOTS_RAISING_MAXIMUM_HITS)
}

/** Rule: Rootbotics 7.2.4 — the twelfth item: one extra hit as attacker. */
export function attackerExtraHits(board: VagabotBoard): number {
  return battleTrackSlots(board) >= SLOTS_FOR_ATTACKER_EXTRA_HIT ? 1 : 0
}

/** Rule: Rootbotics 7.2.5 — hits damage exhausted items first, then face-up ones. */
export function damageItems(board: VagabotBoard, hits: number): number {
  const order: VagabotItem[] = [
    ...board.items.filter((item: VagabotItem): boolean => !item.damaged && item.exhausted),
    ...board.items.filter((item: VagabotItem): boolean => !item.damaged && !item.exhausted),
  ]
  const damaged = order.slice(0, hits)
  for (const item of damaged) item.damaged = true
  syncBattleTrack(board)
  return damaged.length
}

/**
 * Rule: Rootbotics 7.5.5 / 7.6.2 — repair one damaged item, face-up ones
 * before exhausted ones; it keeps its side.
 */
export function repairOneItem(board: VagabotBoard): boolean {
  const item =
    board.items.find((entry: VagabotItem): boolean => entry.damaged && !entry.exhausted) ??
    board.items.find((entry: VagabotItem): boolean => entry.damaged)
  if (item === undefined) return false
  item.damaged = false
  syncBattleTrack(board)
  return true
}

export function repairItems(board: VagabotBoard, count: number): number {
  let repaired = 0
  while (repaired < count && repairOneItem(board)) repaired += 1
  return repaired
}

/** Rule: Rootbotics 7.6.1 — refresh: turn exhausted undamaged items face up. */
export function refreshItems(board: VagabotBoard, count: number): number {
  const exhausted = board.items.filter(
    (item: VagabotItem): boolean => !item.damaged && item.exhausted,
  )
  const refreshed = exhausted.slice(0, count)
  for (const item of refreshed) item.exhausted = false
  return refreshed.length
}

/** Rule: Rootbotics 7.2.3 — gained items go face up in the Satchel. */
export function gainItem(board: VagabotBoard, type: ItemType): void {
  board.items.push({ type, exhausted: false, damaged: false, onBattleTrack: false })
  syncBattleTrack(board)
}
