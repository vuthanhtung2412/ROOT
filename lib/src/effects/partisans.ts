import { defOf } from '../cards/Deck.js'
import { Deck } from '../cards/Deck.js'
import type { CardEffect } from '../triggers/effects.js'
import type { Ctx } from '../game/ctx.js'
import { FALL } from '../map/fall.js'
import type { Seat } from '../pieces/types.js'
import { playerOf } from '../queries/seat.js'
import type { GameState } from '../state/types.js'
import type { BattleEvent } from '../events/types.js'

const PARTISAN_DEFS = new Set(['ROOT-77', 'ROOT-84', 'ROOT-88'])

export function hasPartisan(state: GameState, seat: Seat, clearing: BattleEvent['clearing']): boolean {
  const suit = FALL.clearings[clearing]!.suit
  return playerOf(state, seat).playArea.some((c) => {
    const def = defOf(c)
    return PARTISAN_DEFS.has(def.defId) && def.suit === suit
  })
}

export function hasBattleEffect(state: GameState, ev: BattleEvent, seat: Seat): boolean {
  return hasPartisan(state, seat, ev.clearing)
}

export function applyBattleEffect(
  state: GameState,
  ev: BattleEvent,
  seat: Seat,
  _ctx: Ctx,
): void {
  const suit = FALL.clearings[ev.clearing]!.suit
  const player = playerOf(state, seat)
  const kept: typeof player.hand = []
  for (const c of player.hand) {
    const def = defOf(c)
    if (def.suit === suit || def.suit === 'bird') {
      kept.push(c)
      continue
    }
    Deck.discard(state.deck, c, {
      onDominance: (card) => state.dominanceAvailable.push(card),
    })
  }
  player.hand = kept
}

export const foxPartisansEffect: CardEffect = {
  defId: 'ROOT-77',
  hooks: {
    extraHits(state, ev, side) {
      const seat = side === 'attacker' ? ev.attacker : ev.defender
      if (!hasPartisan(state, seat, ev.clearing)) return 0
      if (FALL.clearings[ev.clearing]!.suit !== 'fox') return 0
      return 1
    },
  },
}
