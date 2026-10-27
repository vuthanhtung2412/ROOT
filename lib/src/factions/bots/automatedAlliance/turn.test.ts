import { beforeEach, describe, expect, it } from 'vitest'
import { automatedAllianceBoardOf } from '#factions/bots/botBoards.js'
import { spreadSympathy, spreadTarget } from '#factions/bots/automatedAlliance/sympathy.js'
import {
  birdsongRevolt,
  organize,
  publicPity,
  recruitAtBases,
  surpriseRevolt,
} from '#factions/bots/automatedAlliance/turn.js'
import type { ClearingId } from '#map/types.js'
import type { Piece, Seat } from '#pieces/types.js'
import { warriors } from '#queries/pieces.js'
import { resetPlaceIds } from '#rules/place.js'
import type { GameState } from '#state/types.js'
import { card, minimalState, player, testContext } from '#test/fixtures.js'

const BOT: Seat = 0
const MARQUISE: Seat = 1
const FOX_ORDER = 'ROOT-204'
const BIRD_ORDER = 'ROOT-205'
/** Fall: 6 is mouse and borders 2, 7, 11; 7 and 11 are fox. */
const MOUSE_CLEARING: ClearingId = 6
const FOX_CLEARING: ClearingId = 7
const OTHER_FOX_CLEARING: ClearingId = 11

let nextPieceNumber = 0

function nextId(prefix: string): string {
  nextPieceNumber += 1
  return `${prefix}-${nextPieceNumber}`
}

function sympathy(): Piece {
  return { id: nextId('sympathy'), kind: 'token', type: 'sympathy', owner: BOT }
}

function base(): Piece {
  return { id: nextId('base'), kind: 'building', type: 'base', owner: BOT }
}

function rebels(count: number): Piece[] {
  return Array.from({ length: count }, (): Piece => ({
    id: nextId('rebel'),
    kind: 'warrior',
    owner: BOT,
  }))
}

function cats(count: number): Piece[] {
  return Array.from({ length: count }, (): Piece => ({
    id: nextId('cat'),
    kind: 'warrior',
    owner: MARQUISE,
  }))
}

function sawmill(): Piece {
  return { id: nextId('sawmill'), kind: 'building', type: 'sawmill', owner: MARQUISE }
}

function allianceState(
  order: string,
  clearings: Partial<Record<ClearingId, Piece[]>>,
): GameState {
  const state = minimalState({
    currentSeat: BOT,
    phase: 'birdsong',
    step: 'order',
    factions: ['automatedAlliance', 'marquise'],
    players: [player(BOT, 'automatedAlliance'), player(MARQUISE, 'marquise')],
  })
  const board = automatedAllianceBoardOf(state, BOT)
  board.orderCard = card(order)
  let tokensOnMap = 0
  for (const [clearing, pieces] of Object.entries(clearings)) {
    state.clearings[Number(clearing)]!.pieces = [...(pieces ?? [])]
    tokensOnMap += (pieces ?? []).filter((piece: Piece): boolean => piece.kind === 'token').length
  }
  board.sympathyTrack.placed -= tokensOnMap
  return state
}

function sympathyAt(state: GameState, clearing: ClearingId): boolean {
  return state.clearings[clearing]!.pieces.some(
    (piece: Piece): boolean => piece.kind === 'token' && piece.type === 'sympathy',
  )
}

beforeEach(() => {
  resetPlaceIds()
  nextPieceNumber = 0
})

describe('Rootbotics 6.5.1 Spread Sympathy', () => {
  it('6.5.1.I no sympathy yet: the clearing with the fewest enemy pieces, highest priority', () => {
    const state = allianceState(FOX_ORDER, { 0: cats(1) })
    expect(spreadTarget(state, { seat: BOT, suit: 'fox' })).toBe(1)
  })

  it('an ordered clearing next to sympathy with the fewest enemy warriors; scores the revealed space', () => {
    const state = allianceState(FOX_ORDER, {
      [MOUSE_CLEARING]: [sympathy()],
      [FOX_CLEARING]: cats(2),
      [OTHER_FOX_CLEARING]: cats(1),
    })
    spreadSympathy(state, { seat: BOT, scores: true }, testContext({ state }))

    expect(sympathyAt(state, OTHER_FOX_CLEARING)).toBe(true)
    expect(state.players[BOT]!.vp).toBe(1)
    expect(automatedAllianceBoardOf(state, BOT).sympathyTrack.placed).toBe(8)
  })

  it('6.2.5 Martial Law: three warriors of one enemy cost a point', () => {
    const state = allianceState(FOX_ORDER, {
      [MOUSE_CLEARING]: [sympathy()],
      [FOX_CLEARING]: cats(3),
      [OTHER_FOX_CLEARING]: cats(3),
    })
    spreadSympathy(state, { seat: BOT, scores: true }, testContext({ state }))

    expect(sympathyAt(state, FOX_CLEARING)).toBe(true)
    expect(state.players[BOT]!.vp).toBe(0)
  })

  it('6.5.1.II an empty Sympathy track scores five points', () => {
    const state = allianceState(FOX_ORDER, {})
    automatedAllianceBoardOf(state, BOT).sympathyTrack.placed = 0
    spreadSympathy(state, { seat: BOT, scores: true }, testContext({ state }))

    expect(state.players[BOT]!.vp).toBe(5)
  })
})

describe('Rootbotics 6.4.3 Revolt', () => {
  it('removes every enemy piece from the ordered sympathetic clearing with the most, then places the base', () => {
    const state = allianceState(FOX_ORDER, {
      [FOX_CLEARING]: [sympathy(), sawmill(), ...cats(1)],
      [OTHER_FOX_CLEARING]: [sympathy(), ...cats(2)],
    })
    birdsongRevolt(state, BOT, testContext({ state }))

    const pieces = state.clearings[FOX_CLEARING]!.pieces
    expect(pieces.map((piece: Piece): string => piece.kind)).toEqual(['token', 'building'])
    expect(warriors(state, OTHER_FOX_CLEARING, MARQUISE)).toBe(2)
    expect(automatedAllianceBoardOf(state, BOT).bases).toEqual(['rabbit', 'mouse'])
    expect(state.players[BOT]!.vp).toBe(1)
    expect(state.turnScratch.botRevolted).toBe(true)
  })

  it('no revolt on a bird in Birdsong; the Surprise Revolt takes any suit in Daylight', () => {
    const state = allianceState(BIRD_ORDER, {
      [MOUSE_CLEARING]: [sympathy(), ...cats(1)],
    })
    birdsongRevolt(state, BOT, testContext({ state }))
    expect(automatedAllianceBoardOf(state, BOT).bases).toHaveLength(3)

    surpriseRevolt(state, BOT, testContext({ state }))
    expect(automatedAllianceBoardOf(state, BOT).bases).toEqual(['fox', 'rabbit'])
    expect(warriors(state, MOUSE_CLEARING, MARQUISE)).toBe(0)
  })

  it('no revolt where the ordered base already left the board', () => {
    const state = allianceState(FOX_ORDER, { [FOX_CLEARING]: [sympathy(), ...cats(1)] })
    automatedAllianceBoardOf(state, BOT).bases = ['rabbit', 'mouse']
    birdsongRevolt(state, BOT, testContext({ state }))

    expect(warriors(state, FOX_CLEARING, MARQUISE)).toBe(1)
    expect(state.turnScratch.botRevolted).toBeUndefined()
  })
})

describe('Rootbotics 6.4.4 Public Pity', () => {
  it('spreads twice with four or fewer tokens on the map', () => {
    const state = allianceState(FOX_ORDER, { [MOUSE_CLEARING]: [sympathy()] })
    expect(publicPity(state, BOT).followUps).toEqual([
      { kind: 'spreadSympathy' },
      { kind: 'spreadSympathy' },
    ])
  })

  it('spreads once with five or more, never after a Birdsong revolt', () => {
    const state = allianceState(FOX_ORDER, {})
    automatedAllianceBoardOf(state, BOT).sympathyTrack.placed = 5
    expect(publicPity(state, BOT).followUps).toEqual([{ kind: 'spreadSympathy' }])

    state.turnScratch.botRevolted = true
    expect(publicPity(state, BOT).followUps).toEqual([])
  })
})

describe('Rootbotics 6.6 Evening', () => {
  it('6.6.1 Organize: a base with three warriors sends them back and spreads sympathy', () => {
    const state = allianceState(FOX_ORDER, {
      [MOUSE_CLEARING]: [sympathy(), base(), ...rebels(3)],
      [FOX_CLEARING]: [base(), ...rebels(2)],
    })
    const supplyBefore = automatedAllianceBoardOf(state, BOT).supply.warriors
    organize(state, { seat: BOT, threshold: 3 }, testContext({ state }))

    expect(warriors(state, MOUSE_CLEARING, BOT)).toBe(0)
    expect(warriors(state, FOX_CLEARING, BOT)).toBe(2)
    expect(automatedAllianceBoardOf(state, BOT).supply.warriors).toBe(supplyBefore + 3)
    expect(automatedAllianceBoardOf(state, BOT).sympathyTrack.placed).toBe(8)
  })

  it('6.6.2 Recruit: one warrior in each clearing with a base', () => {
    const state = allianceState(FOX_ORDER, {
      [MOUSE_CLEARING]: [base()],
      [FOX_CLEARING]: [base()],
    })
    recruitAtBases(state, BOT)

    expect(warriors(state, MOUSE_CLEARING, BOT)).toBe(1)
    expect(warriors(state, FOX_CLEARING, BOT)).toBe(1)
  })
})
