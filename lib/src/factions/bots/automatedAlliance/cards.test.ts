import { beforeEach, describe, expect, it } from 'vitest'
import { openBattle } from '#events/battle.js'
import { AUTOMATED_ALLIANCE } from '#factions/bots/AutomatedAlliance.js'
import { automatedAllianceBoardOf } from '#factions/bots/botBoards.js'
import { organizeWarriors } from '#factions/bots/automatedAlliance/cards.js'
import { spreadSympathy } from '#factions/bots/automatedAlliance/sympathy.js'
import { publicPity } from '#factions/bots/automatedAlliance/turn.js'
import type { ClearingId } from '#map/types.js'
import type { Piece, Seat } from '#pieces/types.js'
import type { AutomatedAllianceTrait, BotDifficulty } from '#public/botSettings.js'
import { resetPlaceIds } from '#rules/place.js'
import { removePieces } from '#rules/remove.js'
import type { GameState } from '#state/types.js'
import { card, minimalState, player, testContext } from '#test/fixtures.js'

const BOT: Seat = 0
const MARQUISE: Seat = 1
const FOX_ORDER = 'ROOT-204'
const BIRD_ORDER = 'ROOT-205'
/** Fall: 6 (mouse) borders 7 and 11 (fox); battles in 4. */
const MOUSE_CLEARING: ClearingId = 6
const FOX_CLEARING: ClearingId = 7
const OTHER_FOX_CLEARING: ClearingId = 11
const BATTLE_CLEARING: ClearingId = 4

let nextPieceNumber = 0

function nextId(prefix: string): string {
  nextPieceNumber += 1
  return `${prefix}-${nextPieceNumber}`
}

function sympathy(): Piece {
  return { id: nextId('sympathy'), kind: 'token', type: 'sympathy', owner: BOT }
}

function cats(count: number): Piece[] {
  return Array.from({ length: count }, (): Piece => ({
    id: nextId('cat'),
    kind: 'warrior',
    owner: MARQUISE,
  }))
}

function allianceState(
  settings: { difficulty?: BotDifficulty; traits?: AutomatedAllianceTrait[]; order?: string },
  clearings: Partial<Record<ClearingId, Piece[]>>,
): GameState {
  const state = minimalState({
    currentSeat: BOT,
    phase: 'evening',
    step: 'organize',
    factions: ['automatedAlliance', 'marquise'],
    players: [player(BOT, 'automatedAlliance'), player(MARQUISE, 'marquise')],
    botSettings: {
      automatedAlliance: {
        difficulty: settings.difficulty ?? 'default',
        traits: settings.traits ?? [],
      },
    },
  })
  const board = automatedAllianceBoardOf(state, BOT)
  board.orderCard = card(settings.order ?? FOX_ORDER)
  for (const [clearing, pieces] of Object.entries(clearings)) {
    state.clearings[Number(clearing)]!.pieces = [...(pieces ?? [])]
    board.sympathyTrack.placed -= (pieces ?? []).filter(
      (piece: Piece): boolean => piece.kind === 'token',
    ).length
  }
  return state
}

beforeEach(() => {
  resetPlaceIds()
  nextPieceNumber = 0
})

describe('Automated Alliance difficulty', () => {
  it('Easy organizes at four warriors, Challenging and Nightmare at two', () => {
    expect(organizeWarriors(allianceState({ difficulty: 'easy' }, {}), BOT)).toBe(4)
    expect(organizeWarriors(allianceState({}, {}), BOT)).toBe(3)
    expect(organizeWarriors(allianceState({ difficulty: 'challenging' }, {}), BOT)).toBe(2)
    expect(organizeWarriors(allianceState({ difficulty: 'nightmare' }, {}), BOT)).toBe(2)
  })
})

describe('Automated Alliance traits', () => {
  it('Steadfast ignores Martial Law', () => {
    const state = allianceState(
      { traits: ['steadfast'] },
      { [MOUSE_CLEARING]: [sympathy()], [FOX_CLEARING]: cats(3), [OTHER_FOX_CLEARING]: cats(3) },
    )
    spreadSympathy(state, { seat: BOT, scores: true }, testContext({ state }))

    expect(state.players[BOT]!.vp).toBe(1)
  })

  it('Steadfast skips Public Pity when a Surprise Revolt will happen', () => {
    const revolting = allianceState(
      { traits: ['steadfast'], order: BIRD_ORDER },
      { [MOUSE_CLEARING]: [sympathy(), ...cats(1)] },
    )
    expect(publicPity(revolting, BOT).followUps).toEqual([])

    const plain = allianceState({ order: BIRD_ORDER }, { [MOUSE_CLEARING]: [sympathy(), ...cats(1)] })
    expect(publicPity(plain, BOT).followUps).toHaveLength(2)
  })

  it('Wildfire spreads at the end of Evening without points', () => {
    const state = allianceState({ traits: ['wildfire'] }, { [MOUSE_CLEARING]: [sympathy()] })
    const context = testContext({ state })
    while (state.turnScratch.botPlan?.tasks.length !== 0) {
      AUTOMATED_ALLIANCE.apply(state, { type: 'botStep' }, context)
    }

    expect(automatedAllianceBoardOf(state, BOT).sympathyTrack.placed).toBe(8)
    expect(state.players[BOT]!.vp).toBe(0)
    expect(automatedAllianceBoardOf(state, BOT).orderCard).toBeNull()
  })

  it('Informants: a defenseless sympathy token still deals the Automated Ambush hit', () => {
    const state = allianceState({ traits: ['informants'] }, {
      [BATTLE_CLEARING]: [...cats(2), sympathy()],
    })
    state.currentSeat = MARQUISE
    openBattle(
      state,
      { clearing: BATTLE_CLEARING, attacker: MARQUISE, defender: BOT },
      testContext({ state, dice: [0, 0] }),
    )
    const battleCats = state.clearings[BATTLE_CLEARING]!.pieces.filter(
      (piece: Piece): boolean => piece.owner === MARQUISE,
    )
    expect(state.pending.some((pending) => pending.type === 'battle')).toBe(true)
    expect(battleCats).toHaveLength(2)
    const event = state.pending.find((pending) => pending.type === 'battle')
    expect(event?.type === 'battle' && event.hits.defender).toBe(1)
  })

  it('Popularity: removing its sympathy scores nothing', () => {
    const state = allianceState({ traits: ['popularity'] }, { [FOX_CLEARING]: [sympathy()] })
    removePieces(
      state,
      { clearing: FOX_CLEARING, pieceIds: ['sympathy-1'], scorer: MARQUISE },
      testContext({ state }),
    )

    expect(state.players[MARQUISE]!.vp).toBe(0)
  })

  it('Veterans: as defender it deals the higher roll', () => {
    const state = allianceState({ traits: ['veterans'] }, {
      [BATTLE_CLEARING]: [
        ...cats(3),
        { id: 'rebel-1', kind: 'warrior', owner: BOT },
        { id: 'rebel-2', kind: 'warrior', owner: BOT },
      ],
    })
    state.currentSeat = MARQUISE
    openBattle(
      state,
      { clearing: BATTLE_CLEARING, attacker: MARQUISE, defender: BOT },
      testContext({ state, dice: [2, 0] }),
    )
    // Defender: high roll 2 + Automated Ambush 1 removes all three cats; attacker: low roll 0.
    const survivors = state.clearings[BATTLE_CLEARING]!.pieces.map((piece: Piece): Seat => piece.owner)
    expect(survivors).toEqual([BOT, BOT])
  })
})
