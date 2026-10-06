import type { ClearingId } from '#map/types.js'
import type { Piece, Seat } from '#pieces/types.js'
import type { GameState, PlayerState } from '#state/types.js'

function riverfolkSeatOf(state: GameState): Seat | null {
  const player = state.players.find(
    (entry: PlayerState): boolean => entry.faction === 'riverfolk',
  )
  return player?.seat ?? null
}

/**
 * Rule: 11.2.7.III Mercenaries — during Daylight and Evening of the turn the
 * service was bought, the buyer treats Riverfolk warriors as their own.
 */
export function mercenaryBuyer(state: GameState): Seat | null {
  if (!state.turnScratch.mercenaries) return null
  if (state.phase === 'birdsong') return null
  return state.currentSeat
}

/** Seat whose rule a piece counts toward (mercenaries count for the buyer). */
export function ruleOwnerOf(state: GameState, piece: Piece): Seat {
  const buyer = mercenaryBuyer(state)
  if (
    buyer !== null &&
    piece.kind === 'warrior' &&
    piece.owner === riverfolkSeatOf(state)
  ) {
    return buyer
  }
  return piece.owner
}

export interface BattleSide {
  clearing: ClearingId
  seat: Seat
  opponent: Seat
}

/**
 * Riverfolk warriors fighting for `seat` in a battle — none unless the seat
 * bought Mercenaries, and never when battling the Riverfolk themselves.
 */
export function mercenaryWarriors(state: GameState, side: BattleSide): Piece[] {
  const riverfolk = riverfolkSeatOf(state)
  if (riverfolk === null || mercenaryBuyer(state) !== side.seat) return []
  if (side.opponent === riverfolk || side.seat === riverfolk) return []
  return (state.clearings[side.clearing]?.pieces ?? []).filter(
    (piece: Piece): boolean =>
      piece.kind === 'warrior' && piece.owner === riverfolk,
  )
}

/** Warriors a seat fights with: its own plus hired mercenaries. */
export function battleWarriorCount(state: GameState, side: BattleSide): number {
  const own = (state.clearings[side.clearing]?.pieces ?? []).filter(
    (piece: Piece): boolean =>
      piece.kind === 'warrior' && piece.owner === side.seat,
  ).length
  return own + mercenaryWarriors(state, side).length
}

export interface MercenaryHitSplit {
  ownWarriors: number
  mercenaries: number
  /** Owned buildings and tokens — only once no warrior is left. */
  otherPieces: number
}

interface HitPool {
  ownWarriors: number
  mercenaries: number
  otherPieces: number
}

/**
 * Rule: 11.2.7.IIIa Taking Hits — odd hits remove owned warriors, even hits
 * Riverfolk warriors; owned buildings and tokens go only when the buyer has
 * no warriors (including Riverfolk) left in the clearing.
 */
export function splitMercenaryHits(
  pool: HitPool,
  hits: number,
): MercenaryHitSplit {
  const left: HitPool = { ...pool }
  const split: MercenaryHitSplit = {
    ownWarriors: 0,
    mercenaries: 0,
    otherPieces: 0,
  }
  for (let hit = 1; hit <= hits; hit++) {
    const ownFirst = hit % 2 === 1
    const firstChoice: keyof HitPool = ownFirst ? 'ownWarriors' : 'mercenaries'
    const secondChoice: keyof HitPool = ownFirst ? 'mercenaries' : 'ownWarriors'
    const taken: keyof HitPool | null =
      left[firstChoice] > 0
        ? firstChoice
        : left[secondChoice] > 0
          ? secondChoice
          : left.otherPieces > 0
            ? 'otherPieces'
            : null
    if (taken === null) break
    left[taken] -= 1
    split[taken] += 1
  }
  return split
}
