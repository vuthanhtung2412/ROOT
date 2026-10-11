import { describe, expect, it } from 'vitest'
import { actionOptionsOf, type ActionOption } from '#actions/options.js'
import type { Card } from '#cards/types.js'
import { falseOrdersEffect, tryApplyFalseOrders } from '#effects/falseOrders.js'
import '#effects/register.js'
import { FALL } from '#map/fall.js'
import type { ClearingId } from '#map/types.js'
import type { Seat } from '#pieces/types.js'
import { warriors } from '#queries/pieces.js'
import { RuleError } from '#rules/RuleError.js'
import type { GameState } from '#state/types.js'
import {
  buildCraftContext,
  card,
  createPlayingGame,
  minimalState,
  player,
  withPieces,
} from '#test/fixtures.js'

describe('False Orders', () => {
  it('Rule: False Orders — discard self to force half enemy warriors to move ignoring rule', () => {
    const game = createPlayingGame({ seed: 31 })

    const orders = card('ROOT-72')
    game.state.players[0]!.playArea.push(orders)

    // Enemy: 3 warriors in clearing 2; path to 5; neither ruled by enemy needed (ignore rule).
    const fromClearing = 2
    const toClearing = 5
    expect(FALL.isAdjacent(fromClearing, toClearing)).toBe(true)
    game.state.clearings[fromClearing]!.pieces = [
      { id: 'e1', kind: 'warrior', owner: 1 },
      { id: 'e2', kind: 'warrior', owner: 1 },
      { id: 'e3', kind: 'warrior', owner: 1 },
    ]
    game.state.clearings[toClearing]!.pieces = game.state.clearings[toClearing]!.pieces.filter(
      (piece) => piece.owner !== 1,
    )

    expect(game.legalActions().some((spec) => spec.type === 'falseOrders')).toBe(true)
    game.apply({
      type: 'falseOrders',
      target: 1,
      from: fromClearing,
      to: toClearing,
    })

    expect(game.state.players[0]!.playArea.some((playCard) => playCard.id === orders.id)).toBe(
      false,
    )
    expect(warriors(game.state, fromClearing, 1)).toBe(1) // ceil(3/2)=2 moved, 1 left
    expect(warriors(game.state, toClearing, 1)).toBe(2)
  })
})

const FALSE_ORDERS_DEF_ID = 'ROOT-72'
const BOAT_BUILDERS_DEF_ID = 'ROOT-57'
const OWNER_SEAT: Seat = 0
const ENEMY_SEAT: Seat = 1
const ENEMY_CLEARING: ClearingId = 9
/** Paths of clearing 9 on the Autumn map. */
const PATH_NEIGHBOURS: ClearingId[] = [0, 1, 11]
/** Rivers of clearing 9: no path to these. */
const RIVER_NEIGHBOURS: ClearingId[] = [4, 10]
const FAR_CLEARING: ClearingId = 2

/** Marquise Birdsong with False Orders; three Eyrie warriors on clearing 9. */
function falseOrdersState(enemyPlayArea: Card[] = []): GameState {
  const base: GameState = minimalState({
    phase: 'birdsong',
    players: [
      player(OWNER_SEAT, 'marquise', { playArea: [card(FALSE_ORDERS_DEF_ID)] }),
      player(ENEMY_SEAT, 'eyrie', { playArea: enemyPlayArea }),
    ],
  })
  return withPieces(base, ENEMY_CLEARING, [
    { id: 'bird-1', kind: 'warrior', owner: ENEMY_SEAT },
    { id: 'bird-2', kind: 'warrior', owner: ENEMY_SEAT },
    { id: 'bird-3', kind: 'warrior', owner: ENEMY_SEAT },
  ])
}

function offeredDestinations(state: GameState): ClearingId[] {
  const options: ActionOption[] = actionOptionsOf(
    falseOrdersEffect.grants?.(state)[0]?.params?.options,
  )
  return options.map((option: ActionOption): ClearingId => Number(option.to))
}

describe('False Orders — legal payloads', () => {
  it('offers every clearing the enemy could move to, ignoring rule', () => {
    const state: GameState = falseOrdersState()

    expect(offeredDestinations(state)).toEqual(PATH_NEIGHBOURS)
  })

  it('Rule: 1.5.5 Use of Force — the enemy moves as it could itself (Boat Builders: rivers)', () => {
    const state: GameState = falseOrdersState([card(BOAT_BUILDERS_DEF_ID)])

    expect(offeredDestinations(state).sort((left, right) => left - right)).toEqual(
      [...PATH_NEIGHBOURS, ...RIVER_NEIGHBOURS].sort((left, right) => left - right),
    )
  })

  it('a move the enemy cannot make keeps the card in play and changes nothing', () => {
    const state: GameState = falseOrdersState()
    const before: GameState = structuredClone(state)

    expect(() =>
      tryApplyFalseOrders(
        state,
        {
          type: 'falseOrders',
          target: ENEMY_SEAT,
          from: ENEMY_CLEARING,
          to: FAR_CLEARING,
        },
        buildCraftContext(state),
      ),
    ).toThrow(RuleError)
    expect(state).toEqual(before)
  })

  it('moves half the warriors, rounded up, and discards the card', () => {
    const state: GameState = falseOrdersState()

    tryApplyFalseOrders(
      state,
      { type: 'falseOrders', target: ENEMY_SEAT, from: ENEMY_CLEARING, to: 11 },
      buildCraftContext(state),
    )

    expect(warriors(state, ENEMY_CLEARING, ENEMY_SEAT)).toBe(1)
    expect(warriors(state, 11, ENEMY_SEAT)).toBe(2)
    expect(state.players[OWNER_SEAT]!.playArea).toEqual([])
    expect(state.deck.discard).toEqual([card(FALSE_ORDERS_DEF_ID)])
  })
})
