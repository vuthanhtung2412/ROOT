import {
  PLACE_STEP_MS,
  type BoardEffect,
  type BoardEffectBatch,
  type BoardMoveEffect,
  type BoardPlaceEffect,
} from '#game/boardEffects.ts'

/** How long an effect stays on the map, slide and fade included. */
export const EFFECT_LIFETIME_MS = 2800
export const MOVE_SLIDE_MS = 700
export const MOVE_LIFETIME_MS = 1200

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
