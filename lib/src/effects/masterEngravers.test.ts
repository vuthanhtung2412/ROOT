import { describe, expect, it } from 'vitest'
import './register.js'
import { defOf } from '../cards/Deck.js'
import { craftCard } from '../rules/craft.js'
import { FALL } from '../map/fall.js'
import { buildRuleHooks } from '../triggers/buildHooks.js'
import { EFFECTS } from '../triggers/effects.js'
import type { GameSignal } from '../triggers/signals.js'
import { card, minimalState, player, withPieces } from '../test/fixtures.js'

function buildCraftCtx(state: ReturnType<typeof minimalState>) {
  const hooks = buildRuleHooks(state, FALL)
  const ctx: {
    map: typeof FALL
    rng: { roll: () => number; toJSON: () => { seed: number; cursor: number } }
    emit: (s: GameSignal) => void
    hooks: ReturnType<typeof buildRuleHooks>
    grantedActions: () => []
  } = {
    map: FALL,
    rng: { roll: () => 1, toJSON: () => ({ seed: 1, cursor: 0 }) },
    emit: () => {},
    hooks,
    grantedActions: () => [],
  }
  ctx.emit = (s: GameSignal) => {
    for (const player of state.players) {
      for (const c of player.playArea) {
        EFFECTS[c.defId]?.onSignal?.(state, s, ctx)
      }
    }
  }
  return ctx
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
    craftCard(state, 0, hammer.id, buildCraftCtx(state))
    expect(state.players[0]!.vp).toBe((defOf(hammer).vp ?? 0) + 1)
  })
})
