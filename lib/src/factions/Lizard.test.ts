import { beforeEach, describe, expect, it } from 'vitest'
import type { Action, ActionSpec } from '#actions/types.js'
import { LIZARD } from '#factions/Lizard.js'
import {
  adjustOutcast,
  lizardBoardOf,
  lizardEveningDrawCount,
} from '#factions/lizard/rules.js'
import { Game } from '#game/Game.js'
import { FALL } from '#map/fall.js'
import type { Piece, Seat } from '#pieces/types.js'
import { canCraft } from '#queries/craft.js'
import { warriors } from '#queries/pieces.js'
import { ruler } from '#queries/ruler.js'
import { resetPlaceIds } from '#rules/place.js'
import { removePieces } from '#rules/remove.js'
import { LIZARD_GARDENS_PER_SUIT } from '#state/lizardBoard.js'
import type { LizardBoard } from '#state/lizardBoard.js'
import { createTurnScratch } from '#state/turnScratch.js'
import type { GameState, Phase, Step } from '#state/types.js'
import {
  buildCraftContext,
  card,
  eyrieBoard,
  finishSetup,
  lizardBoard,
  minimalState,
  player,
  testContext,
  withPieces,
} from '#test/fixtures.js'
import { defaultRuleHooks } from '#triggers/hooks.js'

const CULT: Seat = 0
const ENEMY: Seat = 1
const FOX_CLEARING = 0
const RABBIT_CLEARING = 4
const FOX_CARD = card('ROOT-204')
const RABBIT_CARD = card('ROOT-206')
const BIRD_CARD = card('ROOT-209')
const FOX_DOMINANCE = card('ROOT-213')

type CultStateOptions = {
  board?: Partial<LizardBoard>
  phase?: Phase
  step?: Step
  hand?: GameState['players'][number]['hand']
}

function cultState(options: CultStateOptions = {}): GameState {
  return minimalState({
    factions: ['lizard', 'marquise'],
    players: [
      player(CULT, 'lizard', {
        board: lizardBoard(options.board),
        hand: options.hand ?? [],
      }),
      player(ENEMY, 'marquise'),
    ],
    phase: options.phase ?? 'daylight',
    step: options.step ?? 'rituals',
    deck: { draw: [], discard: [], lostSouls: [] },
    turnScratch: createTurnScratch({ outcastAdjusted: true }),
  })
}

function cultWarrior(id: string): Piece {
  return { id, kind: 'warrior', owner: CULT }
}

function enemyWarrior(id: string): Piece {
  return { id, kind: 'warrior', owner: ENEMY }
}

function garden(id: string): Piece {
  return { id, kind: 'building', owner: CULT, type: 'garden', used: false }
}

function specOf(state: GameState, type: string): ActionSpec | undefined {
  return LIZARD.legalActions(state, testContext({ state })).find(
    (spec: ActionSpec): boolean => spec.type === type,
  )
}

function applyCult(state: GameState, action: Action): void {
  const context = testContext({ state, dice: [0, 0] })
  LIZARD.validate(state, action, context)
  LIZARD.apply(state, action, context)
}

describe('Lizard Cult setup', () => {
  beforeEach(() => resetPlaceIds())

  it('Rule: 10.3.2 — corner opposite the keep, 4 warriors, garden, 1 warrior next door', () => {
    const game = Game.create({ seed: 5, factions: ['marquise', 'lizard'] })
    game.join('first')
    game.join('second')
    game.start()
    finishSetup(game, { keep: FALL.corners[0], outcast: 'mouse' })

    const corner = FALL.opposite(FALL.corners[0])
    const cornerSuit = FALL.clearings[corner]!.suit
    const board = lizardBoardOf(game.state, 1)
    expect(warriors(game.state, corner, 1)).toBe(4)
    expect(
      game.state.clearings[corner]!.pieces.some(
        (piece) => piece.kind === 'building' && piece.type === 'garden',
      ),
    ).toBe(true)
    for (const adjacent of FALL.adjacent(corner)) {
      expect(warriors(game.state, adjacent, 1)).toBe(1)
    }
    expect(board.gardens[cornerSuit]).toBe(LIZARD_GARDENS_PER_SUIT - 1)
    expect(board.outcast).toBe('mouse')
    expect(game.state.deck.lostSouls).toEqual([])
    expect(game.state.status).toBe('playing')
  })

  it('Rule: 10.3.2 — any free corner when no starting corner is opposite', () => {
    const game = Game.create({ seed: 5, factions: ['eyrie', 'lizard'] })
    game.join('first')
    game.join('second')
    game.start()
    game.apply({ type: 'resolveEvent', leader: 'builder' })
    const corners = game.legalActions()[0]?.params?.clearing
    expect(corners).toEqual([FALL.corners[0]])
  })
})

describe('Lizard Cult Birdsong', () => {
  it('Rule: 10.4.1 — suit with most Lost Souls becomes the Outcast, birds ignored', () => {
    const state = cultState({ board: { outcast: 'fox', hated: true } })
    state.deck.lostSouls = [RABBIT_CARD, card('ROOT-207'), FOX_CARD, BIRD_CARD]
    adjustOutcast(state, CULT)
    const board = lizardBoardOf(state, CULT)
    expect(board.outcast).toBe('rabbit')
    expect(board.hated).toBe(false)
  })

  it('Rule: 10.4.1 — same suit again flips the marker to Hated', () => {
    const state = cultState({ board: { outcast: 'fox' } })
    state.deck.lostSouls = [FOX_CARD]
    adjustOutcast(state, CULT)
    expect(lizardBoardOf(state, CULT).hated).toBe(true)
  })

  it('Rule: 10.4.1 — a tie keeps the suit and flips to Hated', () => {
    const state = cultState({ board: { outcast: 'mouse' } })
    state.deck.lostSouls = [FOX_CARD, RABBIT_CARD]
    adjustOutcast(state, CULT)
    const board = lizardBoardOf(state, CULT)
    expect(board.outcast).toBe('mouse')
    expect(board.hated).toBe(true)
  })

  it('Rule: 10.4.2 — Lost Souls are discarded; dominance becomes available', () => {
    const state = cultState()
    state.deck.lostSouls = [FOX_CARD, FOX_DOMINANCE]
    adjustOutcast(state, CULT)
    expect(state.deck.lostSouls).toEqual([])
    expect(state.deck.discard).toEqual([FOX_CARD])
    expect(state.dominanceAvailable).toEqual([FOX_DOMINANCE])
  })

  it('Rule: 10.4.3 — a Hated Outcast makes conspiracies cost one fewer acolyte', () => {
    const base = cultState({
      phase: 'birdsong',
      step: 'conspiracies',
      board: { acolytes: 1, hated: true },
    })
    const state = withPieces(base, FOX_CLEARING, [
      cultWarrior('c1'),
      enemyWarrior('e1'),
    ])
    expect(specOf(state, 'convert')).toBeDefined()
    expect(specOf(state, 'sanctify')).toBeUndefined()
    state.players[CULT]!.board = lizardBoard({ acolytes: 1, hated: false })
    expect(specOf(state, 'convert')).toBeUndefined()
  })

  it('Rule: 10.4.3.II Convert — replaces an enemy warrior in an Outcast clearing', () => {
    const base = cultState({
      phase: 'birdsong',
      step: 'conspiracies',
      board: { acolytes: 2 },
    })
    const state = withPieces(base, FOX_CLEARING, [enemyWarrior('e1')])
    applyCult(state, { type: 'convert', clearing: FOX_CLEARING, target: ENEMY })
    expect(warriors(state, FOX_CLEARING, ENEMY)).toBe(0)
    expect(warriors(state, FOX_CLEARING, CULT)).toBe(1)
    expect(lizardBoardOf(state, CULT).acolytes).toBe(0)
  })

  it('Rule: G.1.21 Replace — a converted warrior is not placed on Coffin Makers', () => {
    const coffinMakers = card('ROOT-62')
    const base = cultState({
      phase: 'birdsong',
      step: 'conspiracies',
      board: { acolytes: 2 },
    })
    base.players[CULT]!.playArea = [coffinMakers]
    const state = withPieces(base, FOX_CLEARING, [enemyWarrior('e1')])

    LIZARD.apply(
      state,
      { type: 'convert', clearing: FOX_CLEARING, target: ENEMY },
      buildCraftContext(state),
    )

    expect(warriors(state, FOX_CLEARING, CULT)).toBe(1)
    expect(coffinMakers.heldWarriors ?? 0).toBe(0)
  })

  it('Rule: 10.4.3 — conspiracies only target Outcast clearings', () => {
    const base = cultState({
      phase: 'birdsong',
      step: 'conspiracies',
      board: { acolytes: 2 },
    })
    const state = withPieces(base, RABBIT_CLEARING, [enemyWarrior('e1')])
    expect(() =>
      applyCult(state, {
        type: 'convert',
        clearing: RABBIT_CLEARING,
        target: ENEMY,
      }),
    ).toThrow(expect.objectContaining({ code: 'ILLEGAL_ACTION' }))
  })

  it('Rule: 10.4.3.III Sanctify — replaces an enemy building with a garden, scoring it', () => {
    const base = cultState({
      phase: 'birdsong',
      step: 'conspiracies',
      board: { acolytes: 3 },
    })
    const state = withPieces(base, FOX_CLEARING, [
      { id: 's1', kind: 'building', owner: ENEMY, type: 'sawmill' },
    ])
    applyCult(state, {
      type: 'sanctify',
      clearing: FOX_CLEARING,
      target: ENEMY,
      building: 'sawmill',
    })
    const pieces = state.clearings[FOX_CLEARING]!.pieces
    expect(pieces).toHaveLength(1)
    expect(pieces[0]).toMatchObject({ kind: 'building', type: 'garden', owner: CULT })
    expect(lizardBoardOf(state, CULT).gardens.fox).toBe(LIZARD_GARDENS_PER_SUIT - 1)
    expect(state.players[CULT]!.vp).toBe(1)
  })

  it('Rule: 10.4.3.I Crusade — a move may end in a free battle in the destination', () => {
    const base = cultState({
      phase: 'birdsong',
      step: 'conspiracies',
      board: { acolytes: 2 },
    })
    const state = withPieces(
      withPieces(base, FOX_CLEARING, [cultWarrior('c1'), cultWarrior('c2')]),
      RABBIT_CLEARING,
      [enemyWarrior('e1')],
    )
    applyCult(state, {
      type: 'crusadeMove',
      from: FOX_CLEARING,
      to: RABBIT_CLEARING,
      count: 2,
    })
    expect(lizardBoardOf(state, CULT).acolytes).toBe(0)
    expect(state.turnScratch.crusadeFollowUpClearing).toBe(RABBIT_CLEARING)
    expect(specOf(state, 'endPhase')).toBeUndefined()
    expect(specOf(state, 'skipCrusadeBattle')).toBeDefined()

    applyCult(state, {
      type: 'crusadeBattle',
      clearing: RABBIT_CLEARING,
      defender: ENEMY,
    })
    expect(state.turnScratch.crusadeFollowUpClearing).toBeNull()
    expect(state.pending[0]?.type).toBe('battle')
  })
})

describe('Lizard Cult abilities', () => {
  it('Rule: 10.2.4 Pilgrims — gardens rule, even against more warriors and the Eyrie', () => {
    const base = minimalState({
      factions: ['lizard', 'eyrie'],
      players: [
        player(CULT, 'lizard', { board: lizardBoard() }),
        player(ENEMY, 'eyrie', { board: eyrieBoard() }),
      ],
    })
    const state = withPieces(base, FOX_CLEARING, [
      garden('g1'),
      enemyWarrior('e1'),
      enemyWarrior('e2'),
      enemyWarrior('e3'),
    ])
    expect(ruler(state, FOX_CLEARING, defaultRuleHooks(FALL))).toBe(CULT)
  })

  it('Rule: 10.2.3 Revenge — warriors removed while defending become acolytes', () => {
    const state = withPieces(cultState(), FOX_CLEARING, [
      cultWarrior('c1'),
      cultWarrior('c2'),
    ])
    removePieces(state, {
      clearing: FOX_CLEARING,
      pieceIds: ['c1'],
      scorer: ENEMY,
      options: { fromBattle: true, defendingInBattle: true },
    })
    removePieces(state, {
      clearing: FOX_CLEARING,
      pieceIds: ['c2'],
      scorer: ENEMY,
      options: { fromBattle: true, defendingInBattle: false },
    })
    const board = lizardBoardOf(state, CULT)
    expect(board.acolytes).toBe(1)
    expect(board.supply.warriors).toBe(26)
  })

  it('Rule: 10.2.5 Fear of the Faithful — a removed garden costs a random card', () => {
    const base = cultState({
      hand: [FOX_CARD],
      board: { gardens: { fox: 4, rabbit: 5, mouse: 5 } },
    })
    const state = withPieces(base, FOX_CLEARING, [garden('g1')])
    removePieces(state, {
      clearing: FOX_CLEARING,
      pieceIds: ['g1'],
      scorer: ENEMY,
    })
    expect(state.players[CULT]!.hand).toEqual([])
    expect(state.deck.lostSouls).toEqual([FOX_CARD])
    expect(lizardBoardOf(state, CULT).gardens.fox).toBe(LIZARD_GARDENS_PER_SUIT)
    expect(state.players[ENEMY]!.vp).toBe(1)
  })

  it('Rule: 10.2.1 — only gardens matching the Outcast craft', () => {
    const base = cultState({ board: { outcast: 'rabbit' } })
    const foxGarden = withPieces(base, FOX_CLEARING, [garden('g1')])
    expect(canCraft(foxGarden, CULT, FOX_CARD)).toBe(false)
    foxGarden.players[CULT]!.board = lizardBoard({ outcast: 'fox' })
    expect(canCraft(foxGarden, CULT, FOX_CARD)).toBe(true)
  })
})

describe('Lizard Cult Daylight rituals', () => {
  it('Rule: 10.5.1 Build — garden in a ruled clearing matching the revealed card', () => {
    const base = cultState({ hand: [FOX_CARD] })
    const state = withPieces(base, FOX_CLEARING, [cultWarrior('c1')])
    expect(specOf(state, 'ritualBuild')?.params?.options).toEqual([
      { cardId: FOX_CARD.id, clearing: FOX_CLEARING },
    ])
    applyCult(state, {
      type: 'ritualBuild',
      cardId: FOX_CARD.id,
      clearing: FOX_CLEARING,
    })
    const board = lizardBoardOf(state, CULT)
    expect(board.revealed).toEqual([FOX_CARD])
    expect(state.players[CULT]!.hand).toEqual([])
    expect(board.gardens.fox).toBe(LIZARD_GARDENS_PER_SUIT - 1)
  })

  it('Rule: 10.2.2 Hatred of Birds — a bird card only allows Sacrifice', () => {
    const base = cultState({ hand: [BIRD_CARD] })
    const state = withPieces(base, FOX_CLEARING, [cultWarrior('c1')])
    expect(specOf(state, 'ritualBuild')).toBeUndefined()
    expect(specOf(state, 'ritualRecruit')).toBeUndefined()
    expect(specOf(state, 'ritualScore')).toBeUndefined()
    applyCult(state, { type: 'ritualSacrifice', cardId: BIRD_CARD.id })
    const board = lizardBoardOf(state, CULT)
    expect(board.acolytes).toBe(1)
    expect(board.supply.warriors).toBe(24)
  })

  it('Rule: 10.5.2 Recruit — warrior in a clearing matching the revealed card', () => {
    const state = cultState({ hand: [RABBIT_CARD] })
    applyCult(state, {
      type: 'ritualRecruit',
      cardId: RABBIT_CARD.id,
      clearing: RABBIT_CLEARING,
    })
    expect(warriors(state, RABBIT_CLEARING, CULT)).toBe(1)
  })

  it('Rule: 10.5.3 Score — spend the card for track points, once per suit per turn', () => {
    const state = cultState({
      hand: [FOX_CARD, card('ROOT-215')],
      board: { gardens: { fox: 2, rabbit: 5, mouse: 5 } },
    })
    applyCult(state, { type: 'ritualScore', cardId: FOX_CARD.id })
    expect(state.players[CULT]!.vp).toBe(2)
    expect(state.deck.lostSouls).toEqual([FOX_CARD])
    expect(lizardBoardOf(state, CULT).revealed).toEqual([])
    expect(specOf(state, 'ritualScore')).toBeUndefined()
  })

  it('Rule: 10.5.3 Score — no points while no garden of the suit is on the map', () => {
    const state = cultState({ hand: [FOX_CARD] })
    expect(specOf(state, 'ritualScore')).toBeUndefined()
  })
})

describe('Lizard Cult Evening', () => {
  it('Rule: 10.6.1 — revealed cards return to hand', () => {
    const state = cultState({
      phase: 'evening',
      step: 'craft',
      board: { revealed: [FOX_CARD] },
    })
    expect(LIZARD.autoActions(state, 'evening', 'craft')).toEqual([
      { type: 'returnRevealed' },
    ])
    applyCult(state, { type: 'returnRevealed' })
    expect(state.players[CULT]!.hand).toEqual([FOX_CARD])
    expect(LIZARD.autoActions(state, 'evening', 'craft')).toEqual([])
  })

  it('Rule: 10.6.3 — draw one card plus one per uncovered draw bonus', () => {
    expect(lizardEveningDrawCount(lizardBoard())).toBe(1)
    expect(
      lizardEveningDrawCount(
        lizardBoard({ gardens: { fox: 3, rabbit: 4, mouse: 2 } }),
      ),
    ).toBe(3)
  })
})
