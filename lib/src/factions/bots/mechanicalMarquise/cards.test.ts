import { beforeEach, describe, expect, it } from 'vitest'
import type { Card } from '#cards/types.js'
import { openBattle } from '#events/battle.js'
import { legalRemovalSpecs } from '#events/battle/removal.js'
import type { BattleEvent } from '#events/types.js'
import { mechanicalMarquiseBoardOf } from '#factions/bots/botBoards.js'
import {
  daylightTasks,
  runMechanicalMarquiseDaylightTask,
} from '#factions/bots/mechanicalMarquise/turn.js'
import { MECHANICAL_MARQUISE } from '#factions/bots/MechanicalMarquise.js'
import type { ClearingId } from '#map/types.js'
import type { Piece, Seat } from '#pieces/types.js'
import type { BotSettings } from '#public/botSettings.js'
import { warriors } from '#queries/pieces.js'
import { resetPlaceIds } from '#rules/place.js'
import { createMechanicalMarquiseBoard } from '#state/botBoards.js'
import type { GameState } from '#state/types.js'
import { card, minimalState, player, testContext } from '#test/fixtures.js'

const BOT: Seat = 0
const EYRIE: Seat = 1
const FOX_ORDER = 'ROOT-204'
const BIRD_ORDER = 'ROOT-205'
/** Fall fox clearings, highest priority first. */
const KEEP_CLEARING: ClearingId = 0
const FOX_CLEARING: ClearingId = 5
const OTHER_FOX_CLEARING: ClearingId = 7
const RABBIT_CLEARING: ClearingId = 2
/** Clearing 4 is adjacent to the keep corner (0). */
const NEXT_TO_KEEP: ClearingId = 4

let nextPieceNumber = 0

function catWarriors(count: number): Piece[] {
  return Array.from({ length: count }, (): Piece => {
    nextPieceNumber += 1
    return { id: `cat-${nextPieceNumber}`, kind: 'warrior', owner: BOT }
  })
}

function birdWarriors(count: number): Piece[] {
  return Array.from({ length: count }, (): Piece => {
    nextPieceNumber += 1
    return { id: `bird-${nextPieceNumber}`, kind: 'warrior', owner: EYRIE }
  })
}

type BotGame = {
  order: Card | null
  settings: BotSettings
  clearings: Partial<Record<ClearingId, Piece[]>>
}

function botState(game: BotGame): GameState {
  const state = minimalState({
    currentSeat: BOT,
    phase: 'daylight',
    step: 'actions',
    factions: ['mechanicalMarquise', 'eyrie'],
    botSettings: { mechanicalMarquise: game.settings },
    players: [
      player(BOT, 'mechanicalMarquise', {
        board: {
          ...createMechanicalMarquiseBoard(),
          tracks: { sawmill: { placed: 5 }, workshop: { placed: 5 }, recruiter: { placed: 5 } },
          orderCard: game.order,
        },
      }),
      player(EYRIE, 'eyrie'),
    ],
  })
  for (const [clearing, pieces] of Object.entries(game.clearings)) {
    state.clearings[Number(clearing)]!.pieces = [...(pieces ?? [])]
  }
  return state
}

function run(state: GameState, kind: 'recruit' | 'escalatedRecruit' | 'blitz' | 'expand'): void {
  runMechanicalMarquiseDaylightTask(state, { kind }, testContext({ state }))
}

beforeEach(() => {
  resetPlaceIds()
  nextPieceNumber = 0
})

describe('Mechanical Marquise difficulty (Rootbotics 3.3.1)', () => {
  it('Easy — recruits two warriors during the recruit action', () => {
    const state = botState({
      order: card(FOX_ORDER),
      settings: { difficulty: 'easy', traits: [] },
      clearings: { [FOX_CLEARING]: catWarriors(1), [OTHER_FOX_CLEARING]: catWarriors(1) },
    })
    run(state, 'recruit')
    expect([warriors(state, FOX_CLEARING, BOT), warriors(state, OTHER_FOX_CLEARING, BOT)]).toEqual([2, 2])
  })

  it('Challenging — after recruiting, two more warriors in the highest-priority ruled ordered clearing', () => {
    const state = botState({
      order: card(FOX_ORDER),
      settings: { difficulty: 'challenging', traits: [] },
      clearings: { [FOX_CLEARING]: catWarriors(1), [OTHER_FOX_CLEARING]: catWarriors(1) },
    })
    run(state, 'recruit')
    expect([warriors(state, FOX_CLEARING, BOT), warriors(state, OTHER_FOX_CLEARING, BOT)]).toEqual([5, 3])
  })

  it('Nightmare — scores 1 VP at the end of Evening', () => {
    const state = botState({ order: null, settings: { difficulty: 'nightmare', traits: [] }, clearings: {} })
    state.phase = 'evening'
    state.step = 'score'
    const ctx = testContext({ state })
    for (let step = 0; step < 3; step += 1) MECHANICAL_MARQUISE.apply(state, { type: 'botStep' }, ctx)
    expect(state.players[BOT]!.vp).toBe(1)
  })
})

describe('Mechanical Marquise traits (Rootbotics 3.3.2)', () => {
  it('Iron Will — Escalated Daylight recruits twice as many warriors', () => {
    const state = botState({
      order: card(BIRD_ORDER),
      settings: { difficulty: 'default', traits: ['ironWill'] },
      clearings: { [FOX_CLEARING]: catWarriors(1), [OTHER_FOX_CLEARING]: catWarriors(1) },
    })
    run(state, 'escalatedRecruit')
    expect(warriors(state, FOX_CLEARING, BOT) + warriors(state, OTHER_FOX_CLEARING, BOT)).toBe(2 + 8)
  })

  it('Overwhelming — a point for every two Recruit warriors it cannot place', () => {
    const state = botState({
      order: card(FOX_ORDER),
      settings: { difficulty: 'default', traits: ['overwhelming'] },
      clearings: { [FOX_CLEARING]: catWarriors(1) },
    })
    mechanicalMarquiseBoardOf(state, BOT).supply.warriors = 1
    run(state, 'recruit')
    // Four asked, one placed: three left over score one point.
    expect(warriors(state, FOX_CLEARING, BOT)).toBe(2)
    expect(state.players[BOT]!.vp).toBe(1)
  })

  it('Overwhelming — Expand triggers once per turn', () => {
    const state = botState({
      order: card(FOX_ORDER),
      settings: { difficulty: 'default', traits: ['overwhelming'] },
      clearings: {},
    })
    state.deck.draw = [card(FOX_ORDER, 2), card(FOX_ORDER, 3)]
    state.turnScratch.botExpandCount = 1
    run(state, 'expand')
    expect(state.deck.draw).toHaveLength(2)
  })

  it('Blitz — after the move action, all but one warrior leave the top ruled clearing with no enemy and battle', () => {
    const state = botState({
      order: card(FOX_ORDER),
      settings: { difficulty: 'default', traits: ['blitz'] },
      clearings: { [KEEP_CLEARING]: catWarriors(4), [NEXT_TO_KEEP]: birdWarriors(1) },
    })
    expect(daylightTasks(state, BOT).map((task) => task.kind)).toContain('blitz')
    const result = runMechanicalMarquiseDaylightTask(state, { kind: 'blitz' }, testContext({ state }))
    expect(warriors(state, KEEP_CLEARING, BOT)).toBe(1)
    expect(warriors(state, NEXT_TO_KEEP, BOT)).toBe(3)
    expect(result.followUps).toEqual([{ kind: 'battle', clearing: NEXT_TO_KEEP }])
  })

  it('Fortified — a building takes two hits; a lone hit on a building does nothing', () => {
    const sawmill: Piece = { id: 'sawmill', kind: 'building', owner: BOT, type: 'sawmill' }
    const state = botState({
      order: null,
      settings: { difficulty: 'default', traits: ['fortified'] },
      clearings: { [RABBIT_CLEARING]: [sawmill, ...catWarriors(1)] },
    })
    const event: BattleEvent = {
      type: 'battle',
      clearing: RABBIT_CLEARING,
      attacker: EYRIE,
      defender: BOT,
      stage: 'removeDefender',
      hits: { attacker: 2, defender: 0 },
    }
    expect(legalRemovalSpecs(state, event, BOT, 2).map((spec) => spec.params?.pieceIds)).toEqual([['cat-1']])
    expect(legalRemovalSpecs(state, event, BOT, 3).map((spec) => spec.params?.pieceIds)).toEqual([
      ['cat-1', 'sawmill'],
    ])
  })

  it('Hospitals — after losing two warriors as Defender, two warriors at the keep', () => {
    const keep: Piece = { id: 'keep', kind: 'token', owner: BOT, type: 'keep' }
    const state = botState({
      order: null,
      settings: { difficulty: 'default', traits: ['hospitals'] },
      clearings: {
        [KEEP_CLEARING]: [keep],
        [RABBIT_CLEARING]: [...catWarriors(2), ...birdWarriors(3)],
      },
    })
    state.currentSeat = EYRIE
    const ctx = testContext({ state, dice: [3, 0] })
    // Three hits on two warriors: the only removal resolves by itself.
    openBattle(state, { clearing: RABBIT_CLEARING, attacker: EYRIE, defender: BOT }, ctx)
    expect(state.pending).toEqual([])
    expect(warriors(state, RABBIT_CLEARING, BOT)).toBe(0)
    expect(warriors(state, KEEP_CLEARING, BOT)).toBe(2)
  })
})
