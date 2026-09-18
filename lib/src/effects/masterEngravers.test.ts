import { describe, expect, it } from 'vitest'
import './register.js'
import { defOf } from '../cards/Deck.js'
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

describe('Master Engravers', () => {
  it('Rule: Master Engravers — +1 VP on craft.item', () => {
    const hammer = card('ROOT-204')
    const state = withPieces(
      minimalState({
        players: [
          player(0, 'marquise', {
            hand: [hammer],
            playArea: [card('ROOT-82')],
            vp: 0,
          }),
          player(1, 'marquise'),
        ],
      }),
      0,
      [{ id: 'ws', kind: 'building', owner: 0, type: 'workshop', used: false }],
    )
    craftCard(state, 0, hammer.id, buildCraftContext(state))
    expect(state.players[0]!.vp).toBe((defOf(hammer).vp ?? 0) + 1)
  })
})
