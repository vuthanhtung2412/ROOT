import { describe, expect, it } from 'vitest'
import './register.js'
import { craftCard } from '../rules/craft.js'
import { FALL } from '../map/fall.js'
import { buildRuleHooks } from '../triggers/buildHooks.js'
import { EFFECTS } from '../triggers/effects.js'
import type { GameSignal } from '../triggers/signals.js'
import { card, minimalState, player, withPieces } from '../test/fixtures.js'

function buildCraftCtx(state: ReturnType<typeof minimalState>) {
  const hooks = buildRuleHooks(state, FALL)
  const ctx = {
    map: FALL,
    rng: { roll: () => 1, toJSON: () => ({ seed: 1, cursor: 0 }) },
    emit: (s: GameSignal) => {
      for (const player of state.players) {
        for (const c of player.playArea) {
          EFFECTS[c.defId]?.onSignal?.(state, s, ctx)
        }
      }
    },
    hooks,
    grantedActions: () => [],
  }
  return ctx
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
    craftCard(state, 0, hammer.id, buildCraftCtx(state))
    expect(state.players[1]!.hand).toHaveLength(1)
  })
})
