import { beforeEach, describe, expect, it } from 'vitest'
import { defendersInOrder, enemyPieceCount } from '#factions/bots/botQueries.js'
import { relentless } from '#factions/bots/electricEyrie/cards.js'
import { bySetupPriority } from '#factions/bots/priority.js'
import type { ClearingId } from '#map/types.js'
import type { Piece, Seat } from '#pieces/types.js'
import { resetPlaceIds } from '#rules/place.js'
import type { GameState } from '#state/types.js'
import { minimalState, player, testContext } from '#test/fixtures.js'

const MECHANICAL_MARQUISE_SEAT: Seat = 0
const ELECTRIC_EYRIE_SEAT: Seat = 1
const ALLIANCE_SEAT: Seat = 2
const BATTLE_CLEARING: ClearingId = 0

function warrior(owner: Seat, number: number): Piece {
  return { id: `warrior-${owner}-${number}`, kind: 'warrior', owner }
}

/** Both bots and the Alliance, each with a warrior in the battle clearing. */
function tableState(isCooperative: boolean): GameState {
  const state = minimalState({
    currentSeat: MECHANICAL_MARQUISE_SEAT,
    factions: ['mechanicalMarquise', 'electricEyrie', 'alliance'],
    players: [
      player(MECHANICAL_MARQUISE_SEAT, 'mechanicalMarquise'),
      player(ELECTRIC_EYRIE_SEAT, 'electricEyrie'),
      player(ALLIANCE_SEAT, 'alliance'),
    ],
    ...(isCooperative ? { cooperative: true } : {}),
  })
  state.clearings[BATTLE_CLEARING]!.pieces = [
    warrior(MECHANICAL_MARQUISE_SEAT, 1),
    warrior(ELECTRIC_EYRIE_SEAT, 1),
    warrior(ALLIANCE_SEAT, 1),
  ]
  return state
}

beforeEach(() => {
  resetPlaceIds()
})

describe('bots in a cooperative game (Rootbotics 3.5.1)', () => {
  it('count only human pieces as enemies', () => {
    expect(enemyPieceCount(tableState(true), BATTLE_CLEARING, MECHANICAL_MARQUISE_SEAT)).toBe(1)
    expect(enemyPieceCount(tableState(false), BATTLE_CLEARING, MECHANICAL_MARQUISE_SEAT)).toBe(2)
  })

  it('never battle the other bot', () => {
    const battle = { seat: MECHANICAL_MARQUISE_SEAT, clearing: BATTLE_CLEARING }
    const cooperative = tableState(true)
    const freeForAll = tableState(false)

    expect(defendersInOrder(cooperative, battle, [bySetupPriority(cooperative)])).toEqual([
      ALLIANCE_SEAT,
    ])
    expect(defendersInOrder(freeForAll, battle, [bySetupPriority(freeForAll)])).toEqual([
      ELECTRIC_EYRIE_SEAT,
      ALLIANCE_SEAT,
    ])
  })

  it('Relentless spares the other bot defenseless buildings', () => {
    const state = tableState(true)
    state.currentSeat = ELECTRIC_EYRIE_SEAT
    const sawmill: Piece = {
      id: 'sawmill-1',
      kind: 'building',
      owner: MECHANICAL_MARQUISE_SEAT,
      type: 'sawmill',
    }
    state.clearings[BATTLE_CLEARING]!.pieces = [warrior(ELECTRIC_EYRIE_SEAT, 1), sawmill]

    relentless(state, ELECTRIC_EYRIE_SEAT, testContext({ state }))

    expect(state.clearings[BATTLE_CLEARING]!.pieces).toContainEqual(sawmill)
  })
})
