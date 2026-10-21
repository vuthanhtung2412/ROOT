import { beforeEach, describe, expect, it } from 'vitest'
import type { Card } from '#cards/types.js'
import { mechanicalMarquiseBoardOf } from '#factions/bots/botBoards.js'
import { eveningVictoryPoints, escalatedBuildingType } from '#factions/bots/mechanicalMarquise/buildings.js'
import {
  daylightTasks,
  runMechanicalMarquiseDaylightTask,
} from '#factions/bots/mechanicalMarquise/turn.js'
import { MECHANICAL_MARQUISE } from '#factions/bots/MechanicalMarquise.js'
import type { ClearingId } from '#map/types.js'
import type { Piece, Seat } from '#pieces/types.js'
import { buildings, warriors } from '#queries/pieces.js'
import { resetPlaceIds } from '#rules/place.js'
import { createMechanicalMarquiseBoard } from '#state/botBoards.js'
import type { GameState } from '#state/types.js'
import { card, minimalState, player, testContext } from '#test/fixtures.js'

const BOT: Seat = 0
const EYRIE: Seat = 1
const ALLIANCE: Seat = 2
/** Fall fox clearings, highest priority first. */
const FOX_CLEARINGS: ClearingId[] = [0, 5, 7, 11]
const FOX_ITEM_ANVIL = 'ROOT-204'
const FOX_PERSISTENT_INFORMANTS = 'ROOT-79'
const RABBIT_ITEM = 'ROOT-206'
const BIRD_ITEM = 'ROOT-205'

let nextPieceNumber = 0

function catWarriors(count: number): Piece[] {
  return Array.from({ length: count }, (): Piece => {
    nextPieceNumber += 1
    return { id: `cat-${nextPieceNumber}`, kind: 'warrior', owner: BOT }
  })
}

function enemyWarriors(owner: Seat, count: number): Piece[] {
  return Array.from({ length: count }, (): Piece => {
    nextPieceNumber += 1
    return { id: `enemy-${nextPieceNumber}`, kind: 'warrior', owner }
  })
}

function botState(order: Card | null, clearings: Partial<Record<ClearingId, Piece[]>>): GameState {
  const state = minimalState({
    currentSeat: BOT,
    phase: 'daylight',
    step: 'actions',
    factions: ['mechanicalMarquise', 'eyrie', 'alliance'],
    players: [
      player(BOT, 'mechanicalMarquise', {
        board: {
          ...createMechanicalMarquiseBoard(),
          tracks: { sawmill: { placed: 5 }, workshop: { placed: 5 }, recruiter: { placed: 5 } },
          orderCard: order,
        },
      }),
      player(EYRIE, 'eyrie'),
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

describe('Mechanical Marquise Birdsong (Rootbotics 4.4)', () => {
  it('4.4.1–4.4.2 reveals the order card and crafts its available item for one point', () => {
    const state = botState(null, {})
    state.phase = 'birdsong'
    state.step = 'order'
    state.deck.draw = [card(FOX_ITEM_ANVIL)]
    const ctx = testContext({ state })

    MECHANICAL_MARQUISE.apply(state, { type: 'botStep' }, ctx)
    MECHANICAL_MARQUISE.apply(state, { type: 'botStep' }, ctx)

    expect(mechanicalMarquiseBoardOf(state, BOT).orderCard).toEqual(card(FOX_ITEM_ANVIL))
    expect(state.players[BOT]!.craftedItems).toEqual([{ type: 'hammer', exhausted: false }])
    expect(state.itemSupply.hammer).toBe(0)
    expect(state.players[BOT]!.vp).toBe(1)
    expect(MECHANICAL_MARQUISE.autoActions(state, 'birdsong', 'order')).toEqual([
      { type: 'endPhase' },
    ])
  })

  it('1.1.3 never crafts a persistent effect', () => {
    const state = botState(null, {})
    state.phase = 'birdsong'
    state.step = 'order'
    state.deck.draw = [card(FOX_PERSISTENT_INFORMANTS)]
    const ctx = testContext({ state })
    MECHANICAL_MARQUISE.apply(state, { type: 'botStep' }, ctx)
    MECHANICAL_MARQUISE.apply(state, { type: 'botStep' }, ctx)
    expect(state.players[BOT]!.craftedItems).toEqual([])
    expect(state.players[BOT]!.playArea).toEqual([])
  })
})

describe('Mechanical Marquise Daylight (Rootbotics 4.5)', () => {
  it('plans battles, recruit, build, moves in ordered clearings by priority, then Expand', () => {
    const state = botState(card(FOX_ITEM_ANVIL), {})
    expect(daylightTasks(state, BOT)).toEqual([
      ...FOX_CLEARINGS.map((clearing) => ({ kind: 'battle', clearing })),
      { kind: 'recruit' },
      { kind: 'build' },
      ...FOX_CLEARINGS.map((clearing) => ({ kind: 'move', clearing })),
      { kind: 'expand' },
    ])
  })

  it('4.5.1 battles the player with the most pieces; 4.5.1.I tie → most points', () => {
    const state = botState(card(FOX_ITEM_ANVIL), {
      5: [...catWarriors(2), ...enemyWarriors(EYRIE, 2), ...enemyWarriors(ALLIANCE, 2)],
    })
    state.players[ALLIANCE]!.vp = 4
    runMechanicalMarquiseDaylightTask(state, { kind: 'battle', clearing: 5 }, testContext({ state, dice: [1, 1] }))
    const battle = state.pending[0]
    expect(battle?.type === 'battle' && battle.defender).toBe(ALLIANCE)
  })

  it('4.5.2 four warriors split evenly among ordered ruled clearings, extra to highest priority', () => {
    const state = botState(card(FOX_ITEM_ANVIL), {
      0: catWarriors(1),
      5: catWarriors(1),
      11: catWarriors(1),
    })
    runMechanicalMarquiseDaylightTask(state, { kind: 'recruit' }, testContext({ state }))
    expect([warriors(state, 0, BOT), warriors(state, 5, BOT), warriors(state, 11, BOT)]).toEqual([3, 2, 2])
  })

  it('4.5.3 a fox order places a sawmill where it rules with the most warriors', () => {
    const state = botState(card(FOX_ITEM_ANVIL), {
      2: catWarriors(4),
      4: catWarriors(2),
    })
    runMechanicalMarquiseDaylightTask(state, { kind: 'build' }, testContext({ state }))
    expect(state.clearings[2]!.pieces.some((piece) => piece.kind === 'building' && piece.type === 'sawmill')).toBe(true)
    expect(mechanicalMarquiseBoardOf(state, BOT).tracks.sawmill.placed).toBe(4)
    expect(state.turnScratch.botBuiltThisTurn).toBe(true)
  })

  it('4.5.4 moves all but three warriors to the adjacent clearing with the most enemy pieces', () => {
    const state = botState(card(FOX_ITEM_ANVIL), {
      0: catWarriors(5),
      8: enemyWarriors(EYRIE, 1),
      9: enemyWarriors(EYRIE, 2),
    })
    runMechanicalMarquiseDaylightTask(state, { kind: 'move', clearing: 0 }, testContext({ state }))
    expect(warriors(state, 0, BOT)).toBe(3)
    expect(warriors(state, 9, BOT)).toBe(2)
  })

  it('4.5.5 no building placed: new order card and Daylight again', () => {
    const state = botState(card(FOX_ITEM_ANVIL), {})
    state.deck.draw = [card(RABBIT_ITEM)]
    const result = runMechanicalMarquiseDaylightTask(state, { kind: 'expand' }, testContext({ state }))
    expect(mechanicalMarquiseBoardOf(state, BOT).orderCard).toEqual(card(RABBIT_ITEM))
    expect(state.deck.discard).toEqual([card(FOX_ITEM_ANVIL)])
    expect(result.followUps.at(-1)).toEqual({ kind: 'expand' })
    expect(state.players[BOT]!.craftedItems).toEqual([])
  })

  it('4.5.5 no Expand after placing a building', () => {
    const state = botState(card(FOX_ITEM_ANVIL), {})
    state.turnScratch.botBuiltThisTurn = true
    const result = runMechanicalMarquiseDaylightTask(state, { kind: 'expand' }, testContext({ state }))
    expect(result.followUps).toEqual([])
  })
})

describe('Mechanical Marquise Escalated Daylight (Rootbotics 4.7)', () => {
  it('plans a battle in every clearing on a bird order', () => {
    const tasks = daylightTasks(botState(card(BIRD_ITEM), {}), BOT)
    expect(tasks.filter((task) => task.kind === 'battle')).toHaveLength(12)
    expect(tasks.slice(-3)).toEqual([
      { kind: 'escalatedRecruit' },
      { kind: 'escalatedBuild' },
      { kind: 'escalatedMoves' },
    ])
  })

  it('4.7.2 two warriors in each of the two lowest-priority ruled clearings', () => {
    const state = botState(card(BIRD_ITEM), { 1: catWarriors(1), 6: catWarriors(1), 10: catWarriors(1) })
    runMechanicalMarquiseDaylightTask(state, { kind: 'escalatedRecruit' }, testContext({ state }))
    expect([warriors(state, 1, BOT), warriors(state, 6, BOT), warriors(state, 10, BOT)]).toEqual([1, 3, 3])
  })

  it('4.7.3 ties go to sawmills, then recruiters over workshops', () => {
    const sawmillTie = botState(card(BIRD_ITEM), {
      0: [{ id: 's', kind: 'building', type: 'sawmill', owner: BOT }],
      1: [{ id: 'w', kind: 'building', type: 'workshop', owner: BOT, used: false }],
    })
    expect(escalatedBuildingType(sawmillTie, BOT)).toBe('sawmill')
    const recruiterTie = botState(card(BIRD_ITEM), {
      1: [{ id: 'w', kind: 'building', type: 'workshop', owner: BOT, used: false }],
      2: [{ id: 'r', kind: 'building', type: 'recruiter', owner: BOT }],
    })
    expect(escalatedBuildingType(recruiterTie, BOT)).toBe('recruiter')
  })

  it('4.7.4 moves out, then battles in each clearing it moved into', () => {
    const state = botState(card(BIRD_ITEM), {
      0: catWarriors(5),
      9: enemyWarriors(EYRIE, 1),
    })
    const result = runMechanicalMarquiseDaylightTask(state, { kind: 'escalatedMoves' }, testContext({ state }))
    expect(warriors(state, 9, BOT)).toBe(2)
    expect(result.followUps).toEqual([{ kind: 'battle', clearing: 9 }])
  })
})

describe('Mechanical Marquise Evening (Rootbotics 4.6)', () => {
  it('4.6.1 scores the rightmost empty space of the ordered track; a bird scores the best track', () => {
    const state = botState(card(FOX_ITEM_ANVIL), {})
    const board = mechanicalMarquiseBoardOf(state, BOT)
    board.tracks.sawmill.placed = 3
    board.tracks.workshop.placed = 2
    board.tracks.recruiter.placed = 1
    expect(eveningVictoryPoints(state, BOT, 'fox')).toBe(2)
    // Bot board: every track reads +0 … +5 (the Marquise de Cat recruiter shows +3 here).
    expect(eveningVictoryPoints(state, BOT, 'mouse')).toBe(4)
    expect(eveningVictoryPoints(state, BOT, 'bird')).toBe(4)
    expect(buildings(state, 0, BOT)).toBe(0)
  })
})
