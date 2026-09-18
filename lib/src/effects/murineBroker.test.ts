import { describe, expect, it } from 'vitest'
import './register.js'
import { craftCard } from '../rules/craft.js'
import { EFFECTS } from '../triggers/effects.js'
import type { GameSignal } from '../triggers/signals.js'
import { card, minimalState, player, testContext, withPieces } from '../test/fixtures.js'

function buildCraftContext(state: ReturnType<typeof minimalState>) {
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

describe('Murine Broker', () => {
  it('Rule: Murine Broker — other player crafts item → draw', () => {
    const hammer = card('ROOT-204')
    const state = withPieces(
      minimalState({
        players: [
          player(0, 'marquise', { hand: [hammer] }),
          player(1, 'marquise', { hand: [], playArea: [card('ROOT-85')] }),
        ],
        deck: { draw: [card('ROOT-209', 9)], discard: [] },
      }),
      0,
      [{ id: 'ws', kind: 'building', owner: 0, type: 'workshop', used: false }],
    )
    craftCard(state, 0, hammer.id, buildCraftContext(state))
    expect(state.players[1]!.hand).toHaveLength(1)
  })
})
