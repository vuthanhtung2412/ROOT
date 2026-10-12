import { PLACE_STEP_MS, type BoardPlaceEffect } from '#game/boardEffects.ts'

/** A recruit first stands beside the warriors it joins for this long… */
export const RECRUIT_WAIT_MS = 500
/** … then walks up to them for this long. */
export const RECRUIT_WALK_MS = 1000
/** From a recruit showing up to it standing in its stack. */
export const RECRUIT_JOIN_MS = RECRUIT_WAIT_MS + RECRUIT_WALK_MS
const WARRIOR_PIECE_KIND = 'warrior'

/** Warriors placed where warriors of theirs already stand: they join them. */
export function joinsStandingWarriors(effect: BoardPlaceEffect): boolean {
  return (
    effect.pieceKind === WARRIOR_PIECE_KIND && effect.stackCount > effect.count
  )
}

/**
 * How long placed pieces stay off the board: until their step starts, and
 * for recruits until they have reached their stack. 0 = on the board at once.
 */
export function placementHoldMs(effect: BoardPlaceEffect): number {
  return (
    effect.step * PLACE_STEP_MS +
    (joinsStandingWarriors(effect) ? RECRUIT_JOIN_MS : 0)
  )
}
