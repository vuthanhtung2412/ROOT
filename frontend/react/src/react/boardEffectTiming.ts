import {
  PLACE_STEP_MS,
  type BoardEffect,
  type BoardEffectBatch,
  type BoardMoveEffect,
  type BoardPlaceEffect,
} from '#game/boardEffects.ts'

/** How long an effect stays on the map, slide and fade included. */
export const EFFECT_LIFETIME_MS = 2800
/** One move action, first piece leaving to last piece arriving. */
export const MOVE_SLIDE_MS = 3000
/** … and the short fade of its trail after that. */
export const MOVE_LIFETIME_MS = 3400
/**
 * Speed of a piece on the move, as a Bézier curve: a slow start, a brisk
 * middle, a soft landing.
 */
export const MOVE_EASING = 'cubic-bezier(0.65, 0, 0.35, 1)'
/** Where the curve turns from speeding up to slowing down. */
const MOVE_EASING_MIDDLE = 0.5
/** The curve is a cubic, eased in and out: these are its two factors. */
const MOVE_EASING_IN_FACTOR = 4
const MOVE_EASING_OUT_FACTOR = 2

/**
 * When a piece on the move reaches a point of its way: the share of its
 * travel time (0..1) after which it has covered that share of the way. The
 * inverse of `MOVE_EASING`, which follows an eased-in-and-out cubic.
 */
export function marchArrivalShare(wayShare: number): number {
  const share: number = Math.min(Math.max(wayShare, 0), 1)
  if (share < MOVE_EASING_MIDDLE) {
    return Math.cbrt(share / MOVE_EASING_IN_FACTOR)
  }
  return (
    1 -
    Math.cbrt(MOVE_EASING_OUT_FACTOR * (1 - share)) / MOVE_EASING_OUT_FACTOR
  )
}

/** Pieces walk in a line: each sets off this long after the one before. */
const MARCH_STEP_MS = 140
/** The whole line sets off within this share of the move, however long. */
const MARCH_MAXIMUM_SPREAD_SHARE = 0.45
/** More pieces than this walk as a line of this many. */
export const MARCH_MAXIMUM_PIECE_COUNT = 12

export type MarchTiming = {
  /** Pieces drawn on the move. */
  pieceCount: number
  /** Wait between two pieces setting off. */
  stepMs: number
  /** How long one piece is on its way. */
  travelMs: number
}

/**
 * How the pieces of a move walk in a line so that, whatever their number,
 * the last one arrives `MOVE_SLIDE_MS` after the first one left.
 */
export function marchTiming(movedCount: number): MarchTiming {
  const pieceCount: number = Math.min(
    Math.max(movedCount, 1),
    MARCH_MAXIMUM_PIECE_COUNT,
  )
  const followerCount: number = pieceCount - 1
  const spreadMs: number = Math.min(
    followerCount * MARCH_STEP_MS,
    MOVE_SLIDE_MS * MARCH_MAXIMUM_SPREAD_SHARE,
  )
  return {
    pieceCount,
    stepMs: followerCount === 0 ? 0 : spreadMs / followerCount,
    travelMs: MOVE_SLIDE_MS - spreadMs,
  }
}

/** When a move starts: once every earlier move of its update has landed. */
export function moveStartDelay(effect: BoardMoveEffect): number {
  return effect.step * MOVE_SLIDE_MS
}

/** When a placement appears: one step after the placement before it. */
export function placeStartDelay(effect: BoardPlaceEffect): number {
  return effect.step * PLACE_STEP_MS
}

/** When an effect is over, its wait for earlier steps included. */
function effectEnd(effect: BoardEffect): number {
  if (effect.kind === 'move') {
    return moveStartDelay(effect) + MOVE_LIFETIME_MS
  }
  if (effect.kind === 'place') {
    return placeStartDelay(effect) + EFFECT_LIFETIME_MS
  }
  return EFFECT_LIFETIME_MS
}

/** How long a batch stays on the map: long enough for its last effect. */
export function batchLifetime(batch: BoardEffectBatch): number {
  return batch.effects.reduce(
    (lifetime: number, effect: BoardEffect): number =>
      Math.max(lifetime, effectEnd(effect)),
    EFFECT_LIFETIME_MS,
  )
}
