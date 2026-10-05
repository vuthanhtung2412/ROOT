import { describe, expect, it } from 'vitest'
import type { VagabondItemChoice } from '#actions/types.js'
import {
  enqueueVagabondDamage,
  vagabondDamageResolver,
} from '#events/vagabondDamage.js'
import type { VagabondDamageEvent } from '#events/types.js'
import { boardOf } from '#factions/vagabond/items.js'
import { Game } from '#game/Game.js'
import type { Seat } from '#pieces/types.js'
import { removePieces } from '#rules/remove.js'
import type { GameState } from '#state/types.js'
import { isVagabondDamageEvent } from '#typeGuards.js'
import { minimalState, player, testContext, withPieces } from '#test/fixtures.js'

const ALLIANCE_SEAT: Seat = 0
const VAGABOND_SEAT: Seat = 1
const REVOLT_CLEARING = 7
const FULL_REMOVAL_ITEM_DAMAGE = 3

const BOOT: VagabondItemChoice = { type: 'boot', exhausted: false }
const TORCH: VagabondItemChoice = { type: 'torch', exhausted: false }
const SWORD: VagabondItemChoice = { type: 'sword', exhausted: false }
const HAMMER: VagabondItemChoice = { type: 'hammer', exhausted: false }
const CROSSBOW: VagabondItemChoice = { type: 'crossbow', exhausted: true }

function stateWithSatchel(satchel: VagabondItemChoice[]): GameState {
  const state: GameState = minimalState({
    factions: ['alliance', 'vagabond'],
    players: [player(ALLIANCE_SEAT, 'alliance'), player(VAGABOND_SEAT, 'vagabond')],
  })
  const board = boardOf(state, VAGABOND_SEAT)
  board.satchel = satchel.map((item) => ({ ...item }))
  board.tracks = { tea: [], coin: [], bag: [] }
  board.damaged = []
  return state
}

function pendingDamageEvent(state: GameState): VagabondDamageEvent {
  const head = state.pending[0]
  if (head === undefined || !isVagabondDamageEvent(head)) {
    throw new Error('expected vagabondDamage pending')
  }
  return head
}

describe('vagabondDamage event', () => {
  it('Rule: 9.2.3.I Full Removal — Vagabond chooses which three items to damage', () => {
    const base: GameState = stateWithSatchel([BOOT, TORCH, SWORD, HAMMER, CROSSBOW])
    const state: GameState = withPieces(base, REVOLT_CLEARING, [
      { id: 'pawn-1', kind: 'pawn', owner: VAGABOND_SEAT },
    ])
    const context = testContext({ state })
    removePieces(
      state,
      { clearing: REVOLT_CLEARING, pieceIds: ['pawn-1'], scorer: ALLIANCE_SEAT },
      context,
    )
    const board = boardOf(state, VAGABOND_SEAT)
    expect(board.damaged).toEqual([])
    const event: VagabondDamageEvent = pendingDamageEvent(state)
    expect(vagabondDamageResolver.legalActions(state, event, context)).toEqual([
      {
        type: 'resolveEvent',
        actor: VAGABOND_SEAT,
        params: {
          vagabondItems: [BOOT, TORCH, SWORD, HAMMER, CROSSBOW],
          itemCount: [FULL_REMOVAL_ITEM_DAMAGE],
        },
      },
    ])

    const chosen: VagabondItemChoice[] = [SWORD, HAMMER, CROSSBOW]
    vagabondDamageResolver.apply(
      state,
      {
        event,
        action: { type: 'resolveEvent', items: chosen },
        actor: VAGABOND_SEAT,
      },
      context,
    )
    expect(board.damaged).toEqual(chosen)
    expect(board.satchel).toEqual([BOOT, TORCH])
    expect(state.pending).toEqual([])
  })

  it('Rule: 9.2.6 — rejects a choice with the wrong number of items', () => {
    const state: GameState = stateWithSatchel([BOOT, TORCH, SWORD, HAMMER])
    const context = testContext({ state })
    enqueueVagabondDamage(state, VAGABOND_SEAT, FULL_REMOVAL_ITEM_DAMAGE)
    const event: VagabondDamageEvent = pendingDamageEvent(state)
    expect(
      vagabondDamageResolver.matchesAction(
        state,
        event,
        { type: 'resolveEvent', items: [BOOT, TORCH] },
        context,
      ),
    ).toBe(false)
    expect(
      vagabondDamageResolver.matchesAction(
        state,
        event,
        { type: 'resolveEvent', items: [BOOT, BOOT, TORCH] },
        context,
      ),
    ).toBe(false)
  })

  it('Rule: 9.2.6 — Game.apply accepts the Vagabond item choice', () => {
    const state: GameState = stateWithSatchel([BOOT, TORCH, SWORD, HAMMER])
    enqueueVagabondDamage(state, VAGABOND_SEAT, FULL_REMOVAL_ITEM_DAMAGE)
    const game: Game = Game.fromJSON({
      state,
      history: [],
      log: [],
      rng: { seed: 1, cursor: 0 },
    })
    const chosen: VagabondItemChoice[] = [TORCH, SWORD, HAMMER]
    game.apply({ type: 'resolveEvent', items: chosen })
    expect(boardOf(game.state, VAGABOND_SEAT).damaged).toEqual(chosen)
    expect(game.state.pending).toEqual([])
  })

  it('Rule: 9.2.6 — no choice is asked when every undamaged item is damaged', () => {
    const state: GameState = stateWithSatchel([BOOT, TORCH])
    enqueueVagabondDamage(state, VAGABOND_SEAT, FULL_REMOVAL_ITEM_DAMAGE)
    expect(state.pending).toEqual([])
    expect(boardOf(state, VAGABOND_SEAT).damaged).toEqual([BOOT, TORCH])
  })
})
