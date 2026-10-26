import { beforeEach, describe, expect, it } from 'vitest'
import { openBattle } from '#events/battle.js'
import { outrageResolver } from '#events/outrage.js'
import type { OutrageEvent } from '#events/types.js'
import { automatedAllianceBoardOf } from '#factions/bots/botBoards.js'
import type { FactionId, Piece } from '#pieces/types.js'
import { moveWarriors } from '#rules/move.js'
import { resetPlaceIds } from '#rules/place.js'
import { removePieces } from '#rules/remove.js'
import type { GameState } from '#state/types.js'
import { card, minimalState, player, testContext, withPieces } from '#test/fixtures.js'

const HUMAN_SEAT = 0
const ALLIANCE_SEAT = 1
const OTHER_BOT_SEAT = 2
/** Fall clearings 0 and 5 are fox, 3 and 4 rabbit; 4 borders 0. */
const FOX_CLEARING = 0
const OTHER_FOX_CLEARING = 5
const RABBIT_CLEARING = 3
const FOX_CARD = 'ROOT-204'
const MOUSE_CARD = 'ROOT-210'

function allianceState(humanHand: string[] = []): GameState {
  const factions: FactionId[] = ['eyrie', 'automatedAlliance', 'mechanicalMarquise']
  return minimalState({
    factions,
    players: [
      player(HUMAN_SEAT, 'eyrie', { hand: humanHand.map((id: string) => card(id)) }),
      player(ALLIANCE_SEAT, 'automatedAlliance'),
      player(OTHER_BOT_SEAT, 'mechanicalMarquise'),
    ],
  })
}

function sympathy(id: string): Piece {
  return { id, kind: 'token', type: 'sympathy', owner: ALLIANCE_SEAT }
}

function warrior(id: string, owner: 0 | 1 | 2): Piece {
  return { id, kind: 'warrior', owner }
}

function pendingOutrage(state: GameState): OutrageEvent {
  const event = state.pending[0]
  if (event?.type !== 'outrage') throw new Error('no pending outrage')
  return event
}

beforeEach(() => {
  resetPlaceIds()
})

describe('Rootbotics 6.2.3 Automated Outrage', () => {
  it('a human moving into a sympathetic clearing must discard a matching card', () => {
    const state = withPieces(
      withPieces(allianceState([FOX_CARD]), FOX_CLEARING, [sympathy('sympathy')]),
      4,
      [warrior('eyrie', HUMAN_SEAT)],
    )
    const context = testContext({ state })
    moveWarriors(state, { seat: HUMAN_SEAT, from: 4, to: FOX_CLEARING, count: 1 }, context)

    const event = pendingOutrage(state)
    expect(outrageResolver.legalActions(state, event, context)).toEqual([
      { type: 'resolveEvent', actor: HUMAN_SEAT, params: { cardIds: [card(FOX_CARD).id] } },
    ])
    outrageResolver.apply(
      state,
      { event, action: { type: 'resolveEvent', cardId: card(FOX_CARD).id }, actor: HUMAN_SEAT },
      context,
    )
    expect(state.players[HUMAN_SEAT]!.hand).toEqual([])
    expect(state.deck.discard.map((discarded) => discarded.id)).toEqual([card(FOX_CARD).id])
    expect(state.players[ALLIANCE_SEAT]!.vp).toBe(0)
  })

  it('without a matching card the Alliance scores one point', () => {
    const state = withPieces(allianceState([MOUSE_CARD]), FOX_CLEARING, [sympathy('sympathy')])
    const context = testContext({ state })
    removePieces(
      state,
      { clearing: FOX_CLEARING, pieceIds: ['sympathy'], scorer: HUMAN_SEAT },
      context,
    )
    const event = pendingOutrage(state)
    outrageResolver.apply(
      state,
      { event, action: { type: 'resolveEvent', decline: true }, actor: HUMAN_SEAT },
      context,
    )
    expect(state.players[HUMAN_SEAT]!.hand).toHaveLength(1)
    // One point for the removed token to the human, one outrage point to the Alliance.
    expect(state.players[ALLIANCE_SEAT]!.vp).toBe(1)
    expect(state.pending).toEqual([])
  })

  it('a bot moving into a sympathetic clearing triggers nothing', () => {
    const state = withPieces(
      withPieces(allianceState(), FOX_CLEARING, [sympathy('sympathy')]),
      4,
      [warrior('cat', OTHER_BOT_SEAT)],
    )
    moveWarriors(
      state,
      { seat: OTHER_BOT_SEAT, from: 4, to: FOX_CLEARING, count: 1 },
      testContext({ state }),
    )
    expect(state.pending).toEqual([])
  })
})

describe('Rootbotics 6.2.4 Crackdown', () => {
  it('a removed base returns to the Bases box with every sympathy token of its suit', () => {
    const state = withPieces(
      withPieces(
        withPieces(allianceState(), FOX_CLEARING, [
          { id: 'base', kind: 'building', type: 'base', owner: ALLIANCE_SEAT },
        ]),
        OTHER_FOX_CLEARING,
        [sympathy('fox-sympathy')],
      ),
      RABBIT_CLEARING,
      [sympathy('rabbit-sympathy')],
    )
    const board = automatedAllianceBoardOf(state, ALLIANCE_SEAT)
    board.bases = ['rabbit', 'mouse']
    board.sympathyTrack.placed = 8

    removePieces(
      state,
      { clearing: FOX_CLEARING, pieceIds: ['base'], scorer: OTHER_BOT_SEAT },
      testContext({ state }),
    )

    expect(board.bases).toEqual(['rabbit', 'mouse', 'fox'])
    expect(state.clearings[OTHER_FOX_CLEARING]!.pieces).toEqual([])
    expect(state.clearings[RABBIT_CLEARING]!.pieces).toEqual([sympathy('rabbit-sympathy')])
    expect(board.sympathyTrack.placed).toBe(9)
    expect(state.players[OTHER_BOT_SEAT]!.vp).toBe(1)
  })
})

describe('Rootbotics 6.2.2 Automated Ambush', () => {
  it('as defender with a warrior the Alliance deals one extra hit', () => {
    const state = withPieces(allianceState(), 4, [
      warrior('eyrie-1', HUMAN_SEAT),
      warrior('eyrie-2', HUMAN_SEAT),
      warrior('alliance', ALLIANCE_SEAT),
    ])
    openBattle(
      state,
      { clearing: 4, attacker: HUMAN_SEAT, defender: ALLIANCE_SEAT },
      testContext({ state, dice: [0, 0] }),
    )
    const event = state.pending[0]
    expect(event?.type === 'battle' && event.hits).toEqual({ attacker: 0, defender: 1 })
  })

  it('a defenseless Alliance deals no extra hit', () => {
    const state = withPieces(allianceState(), 4, [
      warrior('eyrie', HUMAN_SEAT),
      sympathy('sympathy'),
    ])
    openBattle(
      state,
      { clearing: 4, attacker: HUMAN_SEAT, defender: ALLIANCE_SEAT },
      testContext({ state, dice: [0, 0] }),
    )
    // The defenseless hit removes the token (outrage); the human warrior survives.
    expect(state.clearings[4]!.pieces).toEqual([warrior('eyrie', HUMAN_SEAT)])
    expect(state.pending.map((pending) => pending.type)).toEqual(['outrage'])
  })
})
