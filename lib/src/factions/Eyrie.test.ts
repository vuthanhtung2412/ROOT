import { describe, expect, it, beforeEach } from 'vitest'
import { defOf } from '../cards/Deck.js'
import { Game } from '../game/Game.js'
import { FALL } from '../map/fall.js'
import { warriors } from '../queries/pieces.js'
import { removePieces } from '../rules/remove.js'
import { resetPlaceIds } from '../rules/place.js'
import { defaultRuleHooks } from '../triggers/hooks.js'
import { card, eyrieBoard, minimalState, player, withPieces } from '../test/fixtures.js'
import { isVizier } from './eyrie/viziers.js'
import { EYRIE, eyrieStartClearing } from './Eyrie.js'
import { MARQUISE } from './Marquise.js'

function setupCtx() {
  return {
    map: FALL,
    rng: { roll: () => 1, toJSON: () => ({ seed: 1, cursor: 0 }) },
    emit: () => {},
    hooks: defaultRuleHooks(FALL),
    grantedActions: () => [],
  }
}

describe('Eyrie setup', () => {
  beforeEach(() => resetPlaceIds())

  it('Rule: Eyrie > Setup 2 — roost + 6 at opposite Marquise corner', () => {
    const state = minimalState({
      factions: ['marquise', 'eyrie'],
      players: [player(0, 'marquise'), player(1, 'eyrie')],
    })
    MARQUISE.setup(state, 0, setupCtx())
    EYRIE.setup(state, 1, setupCtx())
    const start = eyrieStartClearing(state)
    expect(start).toBe(FALL.opposite(FALL.corners[0]))
    expect(warriors(state, start, 1)).toBe(6)
    expect(
      state.clearings[start]!.pieces.some(
        (p) => p.kind === 'building' && p.type === 'roost' && p.owner === 1,
      ),
    ).toBe(true)
    const board = state.players[1]!.board
    expect(board.kind).toBe('eyrie')
    if (board.kind === 'eyrie') {
      expect(board.roostTrack.placed).toBe(6)
      expect(board.supply.warriors).toBe(20 - 6)
      expect(board.decree.recruit).toHaveLength(1)
      expect(board.decree.move).toHaveLength(1)
      expect(isVizier(board.decree.recruit[0]!)).toBe(true)
      expect(isVizier(board.decree.move[0]!)).toBe(true)
    }
  })
})

describe('Eyrie birdsong / craft / evening', () => {
  beforeEach(() => resetPlaceIds())

  it('Rule: 7.4.1 Emergency Orders — empty hand draws 1', () => {
    const state = minimalState({
      factions: ['marquise', 'eyrie'],
      players: [player(0, 'marquise'), player(1, 'eyrie')],
      currentSeat: 1,
      phase: 'birdsong',
      step: 'emergency',
      deck: { draw: [card('ROOT-57')], discard: [] },
    })
    const logs = EYRIE.apply(state, { type: 'emergencyOrders' }, setupCtx())
    expect(state.players[1]!.hand).toHaveLength(1)
    expect(logs[0]).toMatchObject({ t: 'action' })
  })

  it('Rule: 7.4.2 addToDecree — 1–2 cards ≤1 bird', () => {
    const fox = card('ROOT-57')
    const state = minimalState({
      factions: ['marquise', 'eyrie'],
      players: [
        player(0, 'marquise'),
        player(1, 'eyrie', { hand: [fox], board: eyrieBoard() }),
      ],
      currentSeat: 1,
      phase: 'birdsong',
      step: 'decreeAdd',
    })
    EYRIE.validate(
      state,
      { type: 'addToDecree', cards: [{ cardId: fox.id, column: 'battle' }] },
      setupCtx(),
    )
    EYRIE.apply(
      state,
      { type: 'addToDecree', cards: [{ cardId: fox.id, column: 'battle' }] },
      setupCtx(),
    )
    const board = state.players[1]!.board
    expect(board.kind).toBe('eyrie')
    if (board.kind === 'eyrie') {
      expect(board.decree.battle.map((c) => c.id)).toEqual([fox.id])
    }
    expect(state.players[1]!.hand).toHaveLength(0)
  })

  it('Rule: 7.6.1 evening roost VP', () => {
    const state = withPieces(
      minimalState({
        factions: ['marquise', 'eyrie'],
        players: [
          player(0, 'marquise'),
          player(1, 'eyrie', { board: eyrieBoard({ roostTrack: { placed: 5 } }) }),
        ],
        currentSeat: 1,
        phase: 'evening',
        step: 'score',
      }),
      0,
      [
        { id: 'r1', kind: 'building', type: 'roost', owner: 1, used: false },
        { id: 'r2', kind: 'building', type: 'roost', owner: 1, used: false },
        { id: 'r3', kind: 'building', type: 'roost', owner: 1, used: false },
      ],
    )
    EYRIE.apply(state, { type: 'eveningScore' }, setupCtx())
    expect(state.players[1]!.vp).toBe(2)
  })
})

describe('Eyrie decree + turmoil', () => {
  beforeEach(() => resetPlaceIds())

  it('Rule: 7.5.2 decree recruit from roost clearing', () => {
    const start = 0 as const // fox
    const handCard = card('ROOT-57') // fox cost/suit card
    expect(defOf(handCard).suit === 'fox' || defOf(handCard).suit === 'bird').toBe(true)
    const state = withPieces(
      minimalState({
        factions: ['marquise', 'eyrie'],
        players: [
          player(0, 'marquise'),
          player(1, 'eyrie', {
            board: eyrieBoard({
              decree: {
                recruit: [handCard],
                move: [],
                battle: [],
                build: [],
              },
              supply: { warriors: 10 },
            }),
          }),
        ],
        currentSeat: 1,
        phase: 'daylight',
        step: 'decree',
        turnScratch: {
          actionsLeft: 0,
          extraActions: 0,
          recruited: false,
          birdsongWoodDone: false,
          eveningDrawDone: false,
          swapMeetUsed: false,
          emergencyOrdersDone: false,
          eveningScoreDone: false,
          decree: { column: 'recruit', remaining: [handCard.id] },
        },
      }),
      start,
      [{ id: 'r', kind: 'building', type: 'roost', owner: 1, used: false }],
    )
    EYRIE.apply(
      state,
      { type: 'decree', column: 'recruit', cardId: handCard.id, clearing: start },
      setupCtx(),
    )
    expect(warriors(state, start, 1)).toBe(1)
  })

  it('Rule: 7.7 turmoil when decree impossible', () => {
    const battleCard = card('ROOT-57')
    const [v0, v1] = [
      { id: 'vizier-0', defId: 'VIZIER' as const },
      { id: 'vizier-1', defId: 'VIZIER' as const },
    ]
    const state = minimalState({
      factions: ['marquise', 'eyrie'],
      players: [
        player(0, 'marquise'),
        player(1, 'eyrie', {
          vp: 5,
          board: eyrieBoard({
            decree: {
              recruit: [v0],
              move: [v1],
              battle: [battleCard],
              build: [],
            },
          }),
        }),
      ],
      currentSeat: 1,
      phase: 'daylight',
      step: 'decree',
      turnScratch: {
        actionsLeft: 0,
        extraActions: 0,
        recruited: false,
        birdsongWoodDone: false,
        eveningDrawDone: false,
        swapMeetUsed: false,
        emergencyOrdersDone: false,
        eveningScoreDone: false,
        decree: { column: 'battle', remaining: [battleCard.id] },
      },
    })
    const specs = EYRIE.legalActions(state, setupCtx())
    expect(specs.some((s) => s.type === 'turmoil')).toBe(true)
    EYRIE.apply(state, { type: 'turmoil' }, setupCtx())
    expect(state.phase).toBe('evening')
    expect(state.step).toBe('score')
    // 2 viziers + ROOT-57 bird on battle → −3vp
    expect(state.players[1]!.vp).toBe(2)
    const board = state.players[1]!.board
    expect(board.kind).toBe('eyrie')
    if (board.kind === 'eyrie') {
      expect(board.decree.recruit).toHaveLength(1)
      expect(board.decree.move).toHaveLength(1)
      expect(isVizier(board.decree.recruit[0]!)).toBe(true)
      expect(board.decree.battle).toHaveLength(0)
    }
  })
})

describe('Eyrie roost return', () => {
  beforeEach(() => resetPlaceIds())

  it('returns roost to track on remove', () => {
    const state = withPieces(
      minimalState({
        factions: ['marquise', 'eyrie'],
        players: [
          player(0, 'marquise'),
          player(1, 'eyrie', { board: eyrieBoard({ roostTrack: { placed: 5 } }) }),
        ],
      }),
      4,
      [{ id: 'r', kind: 'building', type: 'roost', owner: 1, used: false }],
    )
    removePieces(state, 4, ['r'], 0)
    const board = state.players[1]!.board
    expect(board.kind).toBe('eyrie')
    if (board.kind === 'eyrie') expect(board.roostTrack.placed).toBe(6)
  })
})

describe('Eyrie integration lobby', () => {
  it('Game.create marquise+eyrie setup runs', () => {
    const game = Game.create({ seed: 1, factions: ['marquise', 'eyrie'] })
    game.apply({ type: 'join', playerId: 'a' })
    game.apply({ type: 'join', playerId: 'b' })
    game.apply({ type: 'start' })
    expect(game.state.players[1]!.faction).toBe('eyrie')
    expect(game.state.phase).toBe('birdsong')
  })
})
