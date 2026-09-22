import type { Ctx } from '#game/ctx.js'
import type { GameState } from '#state/types.js'
import { testContext } from '#test/fixtures.js'
import { EFFECTS } from '#triggers/effects.js'
import type { GameSignal } from '#triggers/signals.js'

/** Test ctx that dispatches craft-related signals to play-area EFFECTS. */
export function buildCraftContext(state: GameState): Ctx {
  const context = testContext({ state })
  context.emit = (signal: GameSignal) => {
    for (const playerState of state.players) {
      for (const playCard of playerState.playArea) {
        EFFECTS[playCard.defId]?.onSignal?.(state, signal, context)
      }
    }
  }
  return context
}
