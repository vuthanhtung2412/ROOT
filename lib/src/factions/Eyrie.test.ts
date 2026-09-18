import { describe, expect, it, beforeEach } from 'vitest'
import { defOf } from '../cards/Deck.js'
import { Game } from '../game/Game.js'
import { FALL } from '../map/fall.js'
import { canCraft } from '../queries/craft.js'
import { warriors } from '../queries/pieces.js'
import { ruler } from '../queries/ruler.js'
import { removePieces } from '../rules/remove.js'
import { resetPlaceIds } from '../rules/place.js'
import { craftCard } from '../rules/craft.js'
import { HAND_LIMIT } from '../state/constants.js'
import type { DecreeCursor } from '../state/types.js'
import { defaultRuleHooks } from '../triggers/hooks.js'
import { card, eyrieBoard, minimalState, player, withPieces } from '../test/fixtures.js'
import { isVizier, makeViziers } from './eyrie/viziers.js'
import { EYRIE, eyrieStartClearing } from './Eyrie.js'
import { MARQUISE } from './Marquise.js'

const hooks = defaultRuleHooks(FALL)

function setupCtx() {
  return {
    map: FALL,
    rng: { roll: () => 1, toJSON: () => ({ seed: 1, cursor: 0 }) },
    emit: () => {},
    hooks,
    grantedActions: () => [],
  }
}

function scratch(decree: DecreeCursor | null = null, decreeDone = false) {
  return {
    actionsLeft: 0,
    extraActions: 0,
    recruited: false,
    birdsongWoodDone: false,
    eveningDrawDone: false,
    swapMeetUsed: false,
    emergencyOrdersDone: false,
    eveningScoreDone: false,
    decree,
    decreeDone,
  }
}

/** Fox suit card (not bird) for decree / craft. */
const FOX = () => card('ROOT-72')
const FOX2 = () => card('ROOT-72', 2)
const BIRD = () => card('ROOT-57')
const HAMMER = () => card('ROOT-204')

function eyrieState(
  overrides: Parameters<typeof minimalState>[0] & {
    board?: ReturnType<typeof eyrieBoard>
    hand?: ReturnType<typeof card>[]
    vp?: number
  } = {},
) {
  const { board, hand, vp, ...rest } = overrides
  return minimalState({
    factions: ['marquise', 'eyrie'],
    players: [
      player(0, 'marquise'),
      player(1, 'eyrie', {
        board: board ?? eyrieBoard(),
        hand: hand ?? [],
        vp: vp ?? 0,
      }),
    ],
    currentSeat: 1,
    ...rest,
  })
}

describe('Law 7.2 Faction Rules and Abilities', () => {
  beforeEach(() => resetPlaceIds())

  it('Rule: 7.2.1 Crafting — daylight craft step before decree; roosts craft', () => {
    expect(EYRIE.steps.daylight).toEqual(['craft', 'decree'])
    const hammer = HAMMER()
    const state = withPieces(
      eyrieState({
        phase: 'daylight',
        step: 'craft',
        hand: [hammer],
        board: eyrieBoard({ supply: { warriors: 14 } }),
      }),
      0, // fox
      [{ id: 'r', kind: 'building', type: 'roost', owner: 1, used: false }],
    )
    expect(canCraft(state, 1, hammer)).toBe(true)
    craftCard(state, 1, hammer.id, setupCtx())
    expect(state.clearings[0]!.pieces[0]!.kind).toBe('building')
    if (state.clearings[0]!.pieces[0]!.kind === 'building') {
      expect(state.clearings[0]!.pieces[0]!.used).toBe(true)
    }
  })

  it('Rule: 7.2.2 Lords of the Forest — Eyrie wins warrior/building ties', () => {
    const state = withPieces(
      eyrieState(),
      4,
      [
        { id: 'w0', kind: 'warrior', owner: 0 },
        { id: 'w1', kind: 'warrior', owner: 1 },
      ],
    )
    expect(ruler(state, 4, hooks)).toBe(1)
  })

  it('Rule: 7.2.3 Disdain for Trade — non-Builder item craft scores 1 VP', () => {
    const hammer = HAMMER()
    const state = withPieces(
      eyrieState({
        hand: [hammer],
        board: eyrieBoard({ leader: 'charismatic' }),
        phase: 'daylight',
        step: 'craft',
      }),
      0,
      [{ id: 'r', kind: 'building', type: 'roost', owner: 1, used: false }],
    )
    craftCard(state, 1, hammer.id, setupCtx())
    expect(state.players[1]!.vp).toBe(1)
    expect(defOf(hammer).vp).toBeGreaterThan(1)
  })
})

describe('Law 7.3 Faction Setup', () => {
  beforeEach(() => resetPlaceIds())

  it('Rule: 7.3.1 Gather Warriors — supply of 20', () => {
    const state = eyrieState()
    MARQUISE.setup(state, 0, setupCtx())
    EYRIE.setup(state, 1, setupCtx())
    const board = state.players[1]!.board
    expect(board.kind).toBe('eyrie')
    if (board.kind === 'eyrie') {
      expect(board.supply.warriors + warriors(state, eyrieStartClearing(state), 1)).toBe(20)
    }
  })

  it('Rule: 7.3.2 Place Roost and Starting Warriors — opposite corner, 1 roost + 6', () => {
    const state = eyrieState()
    MARQUISE.setup(state, 0, setupCtx())
    EYRIE.setup(state, 1, setupCtx())
    const start = eyrieStartClearing(state)
    expect(start).toBe(FALL.opposite(FALL.corners[0]))
    expect(warriors(state, start, 1)).toBe(6)
    expect(
      state.clearings[start]!.pieces.filter(
        (p) => p.kind === 'building' && p.type === 'roost' && p.owner === 1,
      ),
    ).toHaveLength(1)
  })

  it('Rule: 7.3.3 Choose Leader — Builder only (house)', () => {
    const state = eyrieState()
    EYRIE.setup(state, 1, setupCtx())
    const board = state.players[1]!.board
    expect(board.kind).toBe('eyrie')
    if (board.kind === 'eyrie') expect(board.leader).toBe('builder')
  })

  it('Rule: 7.3.4 Tuck Viziers — Builder → Recruit + Move', () => {
    const state = eyrieState()
    EYRIE.setup(state, 1, setupCtx())
    const board = state.players[1]!.board
    expect(board.kind).toBe('eyrie')
    if (board.kind === 'eyrie') {
      expect(board.decree.recruit).toHaveLength(1)
      expect(board.decree.move).toHaveLength(1)
      expect(isVizier(board.decree.recruit[0]!)).toBe(true)
      expect(isVizier(board.decree.move[0]!)).toBe(true)
      expect(board.decree.battle).toHaveLength(0)
      expect(board.decree.build).toHaveLength(0)
    }
  })

  it('Rule: 7.3.5 Fill Roosts Track — 6 remaining on track', () => {
    const state = eyrieState()
    EYRIE.setup(state, 1, setupCtx())
    const board = state.players[1]!.board
    expect(board.kind).toBe('eyrie')
    if (board.kind === 'eyrie') expect(board.roostTrack.placed).toBe(6)
  })
})

describe('Law 7.4 Birdsong', () => {
  beforeEach(() => resetPlaceIds())

  it('Rule: 7.4.1 Emergency Orders — empty hand draws 1', () => {
    const state = eyrieState({
      phase: 'birdsong',
      step: 'emergency',
      deck: { draw: [FOX()], discard: [] },
    })
    EYRIE.apply(state, { type: 'emergencyOrders' }, setupCtx())
    expect(state.players[1]!.hand).toHaveLength(1)
  })

  it('Rule: 7.4.1 Emergency Orders — non-empty hand does not auto-draw', () => {
    const state = eyrieState({
      phase: 'birdsong',
      step: 'emergency',
      hand: [FOX()],
      deck: { draw: [FOX2()], discard: [] },
    })
    expect(EYRIE.autoActions(state, 'birdsong', 'emergency')).toEqual([])
  })

  it('Rule: 7.4.2 Add to the Decree — 1–2 cards, ≤1 bird, any columns', () => {
    const fox = FOX()
    const bird = BIRD()
    const state = eyrieState({
      phase: 'birdsong',
      step: 'decreeAdd',
      hand: [fox, bird],
    })
    EYRIE.apply(
      state,
      {
        type: 'addToDecree',
        cards: [
          { cardId: fox.id, column: 'battle' },
          { cardId: bird.id, column: 'build' },
        ],
      },
      setupCtx(),
    )
    const board = state.players[1]!.board
    expect(board.kind).toBe('eyrie')
    if (board.kind === 'eyrie') {
      expect(board.decree.battle.map((c) => c.id)).toEqual([fox.id])
      expect(board.decree.build.map((c) => c.id)).toEqual([bird.id])
    }
  })

  it('Rule: 7.4.2 Add to the Decree — rejects two bird cards', () => {
    const b1 = BIRD()
    const b2 = card('ROOT-57', 2)
    const state = eyrieState({
      phase: 'birdsong',
      step: 'decreeAdd',
      hand: [b1, b2],
    })
    expect(() =>
      EYRIE.validate(
        state,
        {
          type: 'addToDecree',
          cards: [
            { cardId: b1.id, column: 'recruit' },
            { cardId: b2.id, column: 'move' },
          ],
        },
        setupCtx(),
      ),
    ).toThrow(/TOO_MANY_BIRDS/)
  })

  it('Rule: 7.4.3 A New Roost — no roosts → roost + 3 at fewest-warrior clearing', () => {
    const state = eyrieState({
      phase: 'birdsong',
      step: 'newRoost',
      board: eyrieBoard({ roostTrack: { placed: 6 }, supply: { warriors: 20 } }),
    })
    // clearing 1 has fewest (0) and open slot
    EYRIE.apply(state, { type: 'newRoost', clearing: 1 }, setupCtx())
    expect(
      state.clearings[1]!.pieces.some(
        (p) => p.kind === 'building' && p.type === 'roost' && p.owner === 1,
      ),
    ).toBe(true)
    expect(warriors(state, 1, 1)).toBe(3)
    const board = state.players[1]!.board
    expect(board.kind).toBe('eyrie')
    if (board.kind === 'eyrie') expect(board.roostTrack.placed).toBe(5)
  })
})

describe('Law 7.5 Daylight', () => {
  beforeEach(() => resetPlaceIds())

  it('Rule: 7.5.1 Craft — may craft via roosts in craft step', () => {
    const hammer = HAMMER()
    const state = withPieces(
      eyrieState({
        phase: 'daylight',
        step: 'craft',
        hand: [hammer],
        board: eyrieBoard({ leader: 'builder' }),
      }),
      0,
      [{ id: 'r', kind: 'building', type: 'roost', owner: 1, used: false }],
    )
    const specs = EYRIE.legalActions(state, setupCtx())
    expect(specs.some((s) => s.type === 'craft')).toBe(true)
    EYRIE.apply(state, { type: 'craft', cardId: hammer.id }, setupCtx())
    expect(state.players[1]!.craftedItems).toContain('hammer')
  })

  it('Rule: 7.5.2 Resolve the Decree — leftmost column first', () => {
    const fox = FOX()
    const battleCard = FOX2()
    const state = withPieces(
      eyrieState({
        phase: 'daylight',
        step: 'decree',
        board: eyrieBoard({
          decree: {
            recruit: [fox],
            move: [],
            battle: [battleCard],
            build: [],
          },
          supply: { warriors: 10 },
        }),
        turnScratch: scratch(null),
      }),
      0,
      [{ id: 'r', kind: 'building', type: 'roost', owner: 1, used: false }],
    )
    EYRIE.legalActions(state, setupCtx())
    expect(state.turnScratch.decree?.column).toBe('recruit')
    expect(() =>
      EYRIE.validate(
        state,
        {
          type: 'decree',
          column: 'battle',
          cardId: battleCard.id,
          clearing: 0,
          defender: 0,
        },
        setupCtx(),
      ),
    ).toThrow(/WRONG_DECREE_COLUMN/)
  })

  it('Rule: 7.5.2 — viziers stay on decree but columns resolve once (no L→R loop)', () => {
    const [v0, v1] = makeViziers()
    const state = withPieces(
      eyrieState({
        phase: 'daylight',
        step: 'decree',
        board: eyrieBoard({
          decree: { recruit: [v0!], move: [v1!], battle: [], build: [] },
          supply: { warriors: 10 },
        }),
        turnScratch: scratch(null),
      }),
      2, // rabbit roost (vizier = bird → any clearing)
      [
        { id: 'r', kind: 'building', type: 'roost', owner: 1, used: false },
        { id: 'w0', kind: 'warrior', owner: 1 },
        { id: 'w1', kind: 'warrior', owner: 1 },
      ],
    )
    // also put a warrior target path: need adj for move — C2 rabbit adj to C5/C6/C10
    const ctx = setupCtx()
    EYRIE.legalActions(state, ctx) // init cursor on recruit
    expect(state.turnScratch.decree?.column).toBe('recruit')
    EYRIE.apply(state, { type: 'decree', column: 'recruit', cardId: v0!.id, clearing: 2 }, ctx)
    expect(state.turnScratch.decree?.column).toBe('move')
    EYRIE.apply(
      state,
      { type: 'decree', column: 'move', cardId: v1!.id, moves: [{ from: 2, to: 5, count: 1 }] },
      ctx,
    )
    expect(state.turnScratch.decreeDone).toBe(true)
    const board = state.players[1]!.board
    expect(board.kind).toBe('eyrie')
    if (board.kind === 'eyrie') {
      expect(isVizier(board.decree.recruit[0]!)).toBe(true)
      expect(isVizier(board.decree.move[0]!)).toBe(true)
    }
    const specs = EYRIE.legalActions(state, ctx)
    expect(specs.every((s) => s.type !== 'decree')).toBe(true)
    expect(specs.some((s) => s.type === 'endPhase')).toBe(true)
  })

  it('Rule: 7.5.2.I Recruit — warrior in roost clearing matching suit', () => {
    const fox = FOX()
    const state = withPieces(
      eyrieState({
        phase: 'daylight',
        step: 'decree',
        board: eyrieBoard({
          decree: { recruit: [fox], move: [], battle: [], build: [] },
          supply: { warriors: 10 },
        }),
        turnScratch: scratch({ column: 'recruit', remaining: [fox.id] }),
      }),
      0,
      [{ id: 'r', kind: 'building', type: 'roost', owner: 1, used: false }],
    )
    EYRIE.apply(
      state,
      { type: 'decree', column: 'recruit', cardId: fox.id, clearing: 0 },
      setupCtx(),
    )
    expect(warriors(state, 0, 1)).toBe(1)
  })

  it('Rule: 7.5.2.II Move — from clearing matching suit, ≥1 warrior', () => {
    const fox = FOX()
    const to = FALL.adjacent(0)[0]!
    const state = withPieces(
      eyrieState({
        phase: 'daylight',
        step: 'decree',
        board: eyrieBoard({
          decree: { recruit: [], move: [fox], battle: [], build: [] },
          supply: { warriors: 10 },
        }),
        turnScratch: scratch({ column: 'move', remaining: [fox.id] }),
      }),
      0,
      [
        { id: 'r', kind: 'building', type: 'roost', owner: 1, used: false },
        { id: 'w', kind: 'warrior', owner: 1 },
        { id: 'w2', kind: 'warrior', owner: 1 },
      ],
    )
    EYRIE.apply(
      state,
      {
        type: 'decree',
        column: 'move',
        cardId: fox.id,
        moves: [{ from: 0, to, count: 1 }],
      },
      setupCtx(),
    )
    expect(warriors(state, 0, 1)).toBe(1)
    expect(warriors(state, to, 1)).toBe(1)
    const board = state.players[1]!.board
    expect(board.kind).toBe('eyrie')
    if (board.kind === 'eyrie') {
      // Rule: 7.7.2 — hand cards stay on decree until Purge (not discarded on resolve).
      expect(board.decree.move.map((c) => c.id)).toEqual([fox.id])
    }
  })

  it('Rule: 7.5.2.III Battle — initiate in clearing matching suit', () => {
    const fox = FOX()
    const state = withPieces(
      eyrieState({
        phase: 'daylight',
        step: 'decree',
        board: eyrieBoard({
          decree: { recruit: [], move: [], battle: [fox], build: [] },
        }),
        turnScratch: scratch({ column: 'battle', remaining: [fox.id] }),
      }),
      0,
      [
        { id: 'r', kind: 'building', type: 'roost', owner: 1, used: false },
        { id: 'w1', kind: 'warrior', owner: 1 },
        { id: 'w0', kind: 'warrior', owner: 0 },
      ],
    )
    EYRIE.apply(
      state,
      { type: 'decree', column: 'battle', cardId: fox.id, clearing: 0, defender: 0 },
      setupCtx(),
    )
    expect(state.pending.some((e) => e.type === 'battle')).toBe(true)
  })

  it('Rule: 7.5.2.IV Build — roost in ruled matching-suit clearing with no roost', () => {
    const fox = FOX()
    // Rule clearing 5 (fox) with warriors, no roost; track has roosts
    const state = withPieces(
      eyrieState({
        phase: 'daylight',
        step: 'decree',
        board: eyrieBoard({
          decree: { recruit: [], move: [], battle: [], build: [fox] },
          roostTrack: { placed: 4 },
          supply: { warriors: 10 },
        }),
        turnScratch: scratch({ column: 'build', remaining: [fox.id] }),
      }),
      5,
      [
        { id: 'w1', kind: 'warrior', owner: 1 },
        { id: 'w2', kind: 'warrior', owner: 1 },
      ],
    )
    expect(FALL.clearings[5]!.suit).toBe('fox')
    expect(ruler(state, 5, hooks)).toBe(1)
    EYRIE.apply(
      state,
      { type: 'decree', column: 'build', cardId: fox.id, clearing: 5 },
      setupCtx(),
    )
    expect(
      state.clearings[5]!.pieces.some(
        (p) => p.kind === 'building' && p.type === 'roost' && p.owner === 1,
      ),
    ).toBe(true)
    const board = state.players[1]!.board
    expect(board.kind).toBe('eyrie')
    if (board.kind === 'eyrie') expect(board.roostTrack.placed).toBe(3)
  })

  it('Rule: 7.5.2 — cannot fully resolve → turmoil legal', () => {
    const fox = FOX()
    const state = eyrieState({
      phase: 'daylight',
      step: 'decree',
      board: eyrieBoard({
        decree: { recruit: [], move: [], battle: [fox], build: [] },
      }),
      turnScratch: scratch({ column: 'battle', remaining: [fox.id] }),
    })
    // no warriors/enemies → battle impossible
    const specs = EYRIE.legalActions(state, setupCtx())
    expect(specs.map((s) => s.type)).toEqual(['turmoil'])
  })
})

describe('Law 7.6 Evening', () => {
  beforeEach(() => resetPlaceIds())

  it('Rule: 7.6.1 Score Points — VP by roosts on map', () => {
    const state = withPieces(
      eyrieState({
        phase: 'evening',
        step: 'score',
        board: eyrieBoard({ roostTrack: { placed: 4 } }),
      }),
      0,
      [
        { id: 'r1', kind: 'building', type: 'roost', owner: 1, used: false },
        { id: 'r2', kind: 'building', type: 'roost', owner: 1, used: false },
        { id: 'r3', kind: 'building', type: 'roost', owner: 1, used: false },
      ],
    )
    EYRIE.apply(state, { type: 'eveningScore' }, setupCtx())
    expect(state.players[1]!.vp).toBe(2) // 3 roosts → 2 VP
  })

  it('Rule: 7.6.2 Draw and Discard — draw 1 + bonuses; discard to 5', () => {
    const roosts = Array.from({ length: 3 }, (_, i) => ({
      id: `r${i}`,
      kind: 'building' as const,
      type: 'roost' as const,
      owner: 1 as const,
      used: false,
    }))
    const state = withPieces(
      eyrieState({
        phase: 'evening',
        step: 'draw',
        board: eyrieBoard({ roostTrack: { placed: 4 } }),
        hand: [],
        deck: {
          draw: [FOX(), FOX2(), BIRD(), card('ROOT-72', 3)],
          discard: [],
        },
        turnScratch: scratch(),
      }),
      0,
      roosts,
    )
    // 3 roosts → +1 draw bonus → draw 2
    EYRIE.apply(state, { type: 'eveningDraw' }, setupCtx())
    expect(state.players[1]!.hand.length).toBe(2)

    state.phase = 'evening'
    state.step = 'discard'
    state.players[1]!.hand = [
      FOX(),
      FOX2(),
      BIRD(),
      card('ROOT-72', 3),
      card('ROOT-72', 4),
      card('ROOT-72', 5),
    ]
    expect(state.players[1]!.hand.length).toBeGreaterThan(HAND_LIMIT)
    const drop = state.players[1]!.hand[0]!
    EYRIE.apply(state, { type: 'discard', cardIds: [drop.id] }, setupCtx())
    expect(state.players[1]!.hand.length).toBe(HAND_LIMIT)
  })
})

describe('Law 7.7 Turmoil', () => {
  beforeEach(() => resetPlaceIds())

  it('Rule: 7.7.1–4 Humiliate, Purge, Depose (Builder retuck), Rest', () => {
    const [v0, v1] = makeViziers()
    const bird = BIRD()
    const fox = FOX()
    const state = eyrieState({
      phase: 'daylight',
      step: 'decree',
      vp: 5,
      board: eyrieBoard({
        leader: 'builder',
        decree: {
          recruit: [v0],
          move: [v1],
          battle: [bird, fox],
          build: [],
        },
      }),
      turnScratch: scratch({ column: 'battle', remaining: [bird.id, fox.id] }),
    })
    EYRIE.apply(state, { type: 'turmoil' }, setupCtx())
    // Humiliate: viziers×2 + bird = 3 birds (fox not bird)
    expect(state.players[1]!.vp).toBe(2)
    const board = state.players[1]!.board
    expect(board.kind).toBe('eyrie')
    if (board.kind === 'eyrie') {
      // Purge: fox+bird gone; Depose: viziers on Recruit+Move
      expect(board.decree.battle).toHaveLength(0)
      expect(board.decree.recruit).toHaveLength(1)
      expect(board.decree.move).toHaveLength(1)
      expect(isVizier(board.decree.recruit[0]!)).toBe(true)
      expect(board.leader).toBe('builder')
    }
    // Rest → evening score
    expect(state.phase).toBe('evening')
    expect(state.step).toBe('score')
  })

  it('Rule: 7.7.1 Humiliate — score track cannot go below 0', () => {
    const [v0, v1] = makeViziers()
    const bird = BIRD()
    const state = eyrieState({
      phase: 'daylight',
      step: 'decree',
      vp: 1,
      board: eyrieBoard({
        leader: 'builder',
        decree: {
          recruit: [v0],
          move: [v1],
          battle: [bird],
          build: [],
        },
      }),
      turnScratch: scratch({ column: 'battle', remaining: [bird.id] }),
    })
    EYRIE.apply(state, { type: 'turmoil' }, setupCtx())
    // 3 birds would be −3, but track floors at 0
    expect(state.players[1]!.vp).toBe(0)
  })
})

describe('Law 7.8 Leaders Reference', () => {
  beforeEach(() => resetPlaceIds())

  it('Rule: 7.8.1 Builder — viziers Recruit+Move; ignore Disdain', () => {
    const state = eyrieState()
    EYRIE.setup(state, 1, setupCtx())
    const board = state.players[1]!.board
    expect(board.kind).toBe('eyrie')
    if (board.kind === 'eyrie') {
      expect(board.leader).toBe('builder')
      expect(board.decree.recruit).toHaveLength(1)
      expect(board.decree.move).toHaveLength(1)
    }
    const hammer = HAMMER()
    const craftState = withPieces(
      eyrieState({
        hand: [hammer],
        board: eyrieBoard({ leader: 'builder' }),
        phase: 'daylight',
        step: 'craft',
      }),
      0,
      [{ id: 'r', kind: 'building', type: 'roost', owner: 1, used: false }],
    )
    craftCard(craftState, 1, hammer.id, setupCtx())
    expect(craftState.players[1]!.vp).toBe(defOf(hammer).vp)
  })

  it('Rule: 7.8.2–4 Charismatic/Commander/Despot — deferred (Builder-only house)', () => {
    // Documented house rule: only Builder implemented this GP.
    expect(EYRIE.id).toBe('eyrie')
    const board = eyrieBoard({ leader: 'builder' })
    expect(board.leader).toBe('builder')
  })
})

describe('Law 7 extras / integration', () => {
  beforeEach(() => resetPlaceIds())

  it('destroyed roost returns to track', () => {
    const state = withPieces(
      eyrieState({ board: eyrieBoard({ roostTrack: { placed: 5 } }) }),
      4,
      [{ id: 'r', kind: 'building', type: 'roost', owner: 1, used: false }],
    )
    removePieces(state, { clearing: 4, pieceIds: ['r'], scorer: 0 })
    const board = state.players[1]!.board
    expect(board.kind).toBe('eyrie')
    if (board.kind === 'eyrie') expect(board.roostTrack.placed).toBe(6)
  })

  it('Game lobby marquise+eyrie starts on birdsong', () => {
    const game = Game.create({ seed: 1, factions: ['marquise', 'eyrie'] })
    game.apply({ type: 'join', playerId: 'a' })
    game.apply({ type: 'join', playerId: 'b' })
    game.apply({ type: 'start' })
    expect(game.state.players[1]!.faction).toBe('eyrie')
    expect(game.state.phase).toBe('birdsong')
  })
})

describe('Eyrie legalActions correlated choices', () => {
  beforeEach(() => resetPlaceIds())

  it('addToDecree exposes paired card×column options', () => {
    const fox = FOX()
    const bird = BIRD()
    const state = eyrieState({
      phase: 'birdsong',
      step: 'decreeAdd',
      hand: [fox, bird],
    })
    const spec = EYRIE.legalActions(state, setupCtx()).find((s) => s.type === 'addToDecree')
    expect(spec?.params?.birdCardIds).toEqual([bird.id])
    expect(spec?.params?.options).toEqual(
      expect.arrayContaining([
        { cardId: fox.id, column: 'recruit' },
        { cardId: fox.id, column: 'move' },
        { cardId: bird.id, column: 'battle' },
        { cardId: bird.id, column: 'build' },
      ]),
    )
    expect(spec?.params?.options).toHaveLength(8)
  })

  it('newRoost exposes clearings domain', () => {
    const state = eyrieState({
      phase: 'birdsong',
      step: 'newRoost',
      board: eyrieBoard({ roostTrack: { placed: 6 } }),
    })
    // 0 roosts on map → newRoost legal
    const spec = EYRIE.legalActions(state, setupCtx()).find((s) => s.type === 'newRoost')
    expect(spec?.params?.clearings?.length).toBeGreaterThan(0)
    expect(spec?.params?.clearing).toBeUndefined()
  })

  it('decree battle exposes paired targets not parallel arrays', () => {
    const fox = FOX()
    const state = withPieces(
      eyrieState({
        phase: 'daylight',
        step: 'decree',
        board: eyrieBoard({
          decree: { recruit: [], move: [], battle: [fox], build: [] },
        }),
        turnScratch: scratch({ column: 'battle', remaining: [fox.id] }),
      }),
      0, // fox clearing matches FOX card
      [
        { id: 'a1', kind: 'warrior', owner: 1 },
        { id: 'd1', kind: 'warrior', owner: 0 },
      ],
    )
    const spec = EYRIE.legalActions(state, setupCtx()).find((s) => s.type === 'decree')
    expect(spec?.params?.targets).toEqual([{ clearing: 0, defender: 0 }])
    expect(spec?.params?.clearing).toBeUndefined()
    expect(spec?.params?.defender).toBeUndefined()
  })

  it('decree move exposes paired moves with counts', () => {
    const [v0] = makeViziers()
    const state = withPieces(
      eyrieState({
        phase: 'daylight',
        step: 'decree',
        board: eyrieBoard({
          decree: { recruit: [], move: [v0!], battle: [], build: [] },
          supply: { warriors: 10 },
        }),
        turnScratch: scratch({ column: 'move', remaining: [v0!.id] }),
      }),
      0,
      [
        { id: 'r', kind: 'building', type: 'roost', owner: 1, used: false },
        { id: 'w0', kind: 'warrior', owner: 1 },
        { id: 'w1', kind: 'warrior', owner: 1 },
      ],
    )
    // Rule origin or dest; roost at 0 rules; move to adjacent
    const adjacent = FALL.adjacent(0)[0]!
    state.clearings[adjacent]!.pieces = []
    const spec = EYRIE.legalActions(state, setupCtx()).find((s) => s.type === 'decree')
    expect(spec?.params?.moves?.length).toBeGreaterThan(0)
    expect(spec?.params?.from).toBeUndefined()
    expect(spec?.params?.to).toBeUndefined()
    const sample = spec!.params!.moves![0]!
    expect(sample.count).toBeGreaterThanOrEqual(1)
  })

  it('decree recruit exposes clearings domain', () => {
    const fox = FOX()
    const state = withPieces(
      eyrieState({
        phase: 'daylight',
        step: 'decree',
        board: eyrieBoard({
          decree: { recruit: [fox], move: [], battle: [], build: [] },
          supply: { warriors: 10 },
        }),
        turnScratch: scratch({ column: 'recruit', remaining: [fox.id] }),
      }),
      0, // fox clearing
      [{ id: 'r', kind: 'building', type: 'roost', owner: 1, used: false }],
    )
    const spec = EYRIE.legalActions(state, setupCtx()).find((s) => s.type === 'decree')
    expect(spec?.params?.clearings).toContain(0)
    expect(spec?.params?.clearing).toBeUndefined()
  })
})
