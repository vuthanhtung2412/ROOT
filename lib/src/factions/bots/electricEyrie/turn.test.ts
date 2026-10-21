import { beforeEach, describe, expect, it } from 'vitest'
import type { Card } from '#cards/types.js'
import { electricEyrieBoardOf } from '#factions/bots/botBoards.js'
import {
  decreeBattle,
  decreeMove,
  decreeRecruit,
  decreeTasks,
  warriorsToRule,
} from '#factions/bots/electricEyrie/decree.js'
import { buildRoost, newRoost, scoreRoosts } from '#factions/bots/electricEyrie/roosts.js'
import { ELECTRIC_EYRIE } from '#factions/bots/ElectricEyrie.js'
import { makeViziers } from '#factions/eyrie/viziers.js'
import type { ClearingId } from '#map/types.js'
import type { Piece, Seat } from '#pieces/types.js'
import { warriors } from '#queries/pieces.js'
import { resetPlaceIds } from '#rules/place.js'
import { createElectricEyrieBoard } from '#state/botBoards.js'
import type { GameState } from '#state/types.js'
import { card, minimalState, player, testContext } from '#test/fixtures.js'

const BOT: Seat = 0
const MARQUISE: Seat = 1
const ALLIANCE: Seat = 2
const FOX_ITEM = 'ROOT-204'
const MOUSE_ITEM = 'ROOT-210'
const BIRD_ITEM = 'ROOT-205'
const RABBIT_ITEM = 'ROOT-206'

let nextPieceNumber = 0

function birds(count: number): Piece[] {
  return Array.from({ length: count }, (): Piece => {
    nextPieceNumber += 1
    return { id: `bird-${nextPieceNumber}`, kind: 'warrior', owner: BOT }
  })
}

function enemies(owner: Seat, count: number): Piece[] {
  return Array.from({ length: count }, (): Piece => {
    nextPieceNumber += 1
    return { id: `enemy-${nextPieceNumber}`, kind: 'warrior', owner }
  })
}

function roost(): Piece {
  nextPieceNumber += 1
  return { id: `roost-${nextPieceNumber}`, kind: 'building', type: 'roost', owner: BOT, used: false }
}

function sawmill(owner: Seat): Piece {
  nextPieceNumber += 1
  return { id: `sawmill-${nextPieceNumber}`, kind: 'building', type: 'sawmill', owner }
}

function botState(
  decree: Partial<Record<'fox' | 'mouse' | 'rabbit' | 'bird', Card[]>>,
  clearings: Partial<Record<ClearingId, Piece[]>>,
): GameState {
  const state = minimalState({
    currentSeat: BOT,
    phase: 'daylight',
    step: 'decree',
    factions: ['electricEyrie', 'marquise', 'alliance'],
    players: [
      player(BOT, 'electricEyrie', {
        board: {
          ...createElectricEyrieBoard(),
          roostTrack: { placed: 5 },
          decree: { fox: [], mouse: [], rabbit: [], bird: makeViziers(), ...decree },
        },
      }),
      player(MARQUISE, 'marquise'),
      player(ALLIANCE, 'alliance'),
    ],
  })
  for (const [clearing, pieces] of Object.entries(clearings)) {
    state.clearings[Number(clearing)]!.pieces = [...(pieces ?? [])]
  }
  return state
}

beforeEach(() => {
  resetPlaceIds()
  nextPieceNumber = 0
})

describe('Electric Eyrie Birdsong (Rootbotics 5.4)', () => {
  it('5.4.1–5.4.3 reveals, crafts for one point, adds the order to its Decree column', () => {
    const state = botState({}, { 0: [roost()] })
    state.phase = 'birdsong'
    state.step = 'order'
    state.deck.draw = [card(MOUSE_ITEM)]
    const ctx = testContext({ state })
    for (let step = 0; step < 4; step += 1) {
      ELECTRIC_EYRIE.apply(state, { type: 'botStep' }, ctx)
    }
    expect(electricEyrieBoardOf(state, BOT).decree.mouse).toEqual([card(MOUSE_ITEM)])
    expect(state.players[BOT]!.craftedItems).toEqual([{ type: 'crossbow', exhausted: false }])
    expect(state.players[BOT]!.vp).toBe(1)
  })

  it('5.4.4 no roost on the map: roost and four warriors in the ordered clearing of highest priority', () => {
    const state = botState({}, {})
    electricEyrieBoardOf(state, BOT).orderCard = card(RABBIT_ITEM)
    newRoost(state, BOT)
    expect(warriors(state, 2, BOT)).toBe(4)
    expect(state.clearings[2]!.pieces.some((piece) => piece.kind === 'building')).toBe(true)
    expect(electricEyrieBoardOf(state, BOT).roostTrack.placed).toBe(4)
  })
})

describe('Electric Eyrie Daylight (Rootbotics 5.5)', () => {
  it('5.5.1 recruits, then moves, then battles for each column with cards, left to right, then builds', () => {
    const state = botState({ fox: [card(FOX_ITEM)], rabbit: [card(RABBIT_ITEM)] }, {})
    expect(decreeTasks(state, BOT).map((task) => `${task.kind}:${'column' in task ? task.column : ''}`)).toEqual([
      'decreeRecruit:fox',
      'decreeRecruit:rabbit',
      'decreeRecruit:bird',
      'decreeMove:fox',
      'decreeMove:rabbit',
      'decreeMove:bird',
      'decreeBattle:fox',
      'decreeBattle:rabbit',
      'decreeBattle:bird',
      'buildRoost:',
    ])
  })

  it('5.5.1.I recruits as many warriors as cards, where a matching roost has the most enemy pieces', () => {
    const state = botState({ fox: [card(FOX_ITEM), card(FOX_ITEM, 2)] }, {
      0: [roost()],
      5: [roost(), ...enemies(MARQUISE, 1)],
    })
    decreeRecruit(state, 'fox')
    expect(warriors(state, 5, BOT)).toBe(2)
    expect(warriors(state, 0, BOT)).toBe(0)
  })

  it('5.5.1.Ib–Ic ties: fewest Eyrie warriors, then lowest priority', () => {
    const state = botState({ fox: [card(FOX_ITEM)] }, { 0: [roost()], 7: [roost()] })
    decreeRecruit(state, 'fox')
    expect(warriors(state, 7, BOT)).toBe(1)
  })

  it('5.5.1.II leaves enough to rule (or the card count) and moves to an adjacent clearing with no roost', () => {
    const state = botState({ fox: [card(FOX_ITEM)] }, {
      0: [...birds(5), ...enemies(MARQUISE, 2)],
      4: [roost()],
      8: enemies(MARQUISE, 1),
    })
    const ctx = testContext({ state })
    expect(warriorsToRule(state, 0, ctx)).toBe(2)
    decreeMove(state, 'fox', ctx)
    expect(warriors(state, 0, BOT)).toBe(2)
    expect(warriors(state, 9, BOT)).toBe(3)
  })

  it('5.5.1.III battles the player with the most buildings; the longest column deals an extra hit', () => {
    const state = botState({ mouse: [card(MOUSE_ITEM), card(MOUSE_ITEM, 2), card(MOUSE_ITEM, 3)] }, {
      1: [...birds(2), sawmill(MARQUISE), ...enemies(MARQUISE, 1), ...enemies(ALLIANCE, 3)],
    })
    const result = decreeBattle(state, 'mouse', testContext({ state, dice: [0, 0] }))
    expect(result.logs[0]).toEqual({
      t: 'action',
      actor: BOT,
      action: { type: 'botBattle', clearing: 1, defender: MARQUISE },
    })
    // Both dice show 0: only the extra hit removes the Marquise warrior.
    expect(warriors(state, 1, MARQUISE)).toBe(0)
  })

  it('5.5.1.IIIa prefers a clearing with no roost', () => {
    const state = botState({ fox: [card(FOX_ITEM)] }, {
      0: [...birds(1), roost(), ...enemies(MARQUISE, 1)],
      11: [...birds(1), ...enemies(MARQUISE, 1)],
    })
    const result = decreeBattle(state, 'fox', testContext({ state, dice: [0, 0] }))
    expect(result.logs[0]).toEqual({
      t: 'action',
      actor: BOT,
      action: { type: 'botBattle', clearing: 11, defender: MARQUISE },
    })
  })

  it('5.5.1.IV builds a roost in the ruled clearing of highest priority with no roost', () => {
    const state = botState({}, { 0: [roost(), ...birds(1)], 9: birds(1), 4: birds(1) })
    buildRoost(state, BOT, testContext({ state }))
    expect(state.clearings[4]!.pieces.some((piece) => piece.kind === 'building')).toBe(true)
  })

  it('5.7 cannot build: turmoil loses a point per bird card and keeps only the viziers', () => {
    const state = botState({ fox: [card(FOX_ITEM)], bird: [...makeViziers(), card(BIRD_ITEM)] }, {})
    state.players[BOT]!.vp = 5
    buildRoost(state, BOT, testContext({ state }))
    expect(state.players[BOT]!.vp).toBe(2)
    const decree = electricEyrieBoardOf(state, BOT).decree
    expect(decree.fox).toEqual([])
    expect(decree.bird).toEqual(makeViziers())
    expect(state.deck.discard).toEqual([card(FOX_ITEM), card(BIRD_ITEM)])
  })
})

describe('Electric Eyrie Evening (Rootbotics 5.6)', () => {
  it('scores the rightmost empty space of the Roosts track', () => {
    const state = botState({}, { 0: [roost()], 4: [roost()], 9: [roost()] })
    scoreRoosts(state, BOT, testContext({ state }))
    expect(state.players[BOT]!.vp).toBe(2)
  })
})
