import { beforeEach, describe, expect, it } from 'vitest'
import type { ActionSpec } from '#actions/types.js'
import { battleResolver, openBattle } from '#events/battle.js'
import type { BattleEvent } from '#events/types.js'
import { botEventAnswer } from '#factions/bots/botAnswers.js'
import {
  drawInsteadOfTakingFromBot,
  giveCard,
  hasCardToTake,
} from '#factions/bots/manualDexterity.js'
import { Game } from '#game/Game.js'
import type { Piece } from '#pieces/types.js'
import { warriors } from '#queries/pieces.js'
import { removePieces } from '#rules/remove.js'
import { resetPlaceIds } from '#rules/place.js'
import { createElectricEyrieBoard, createMechanicalMarquiseBoard } from '#state/botBoards.js'
import type { GameState } from '#state/types.js'
import {
  card,
  createTestRng,
  minimalState,
  player,
  testContext,
  withPieces,
} from '#test/fixtures.js'

const HUMAN_SEAT = 0
const BOT_SEAT = 1
const BATTLE_CLEARING = 4
const BIRD_AMBUSH = 'ROOT-200'

function humanVersusMechanicalMarquise(pieces: Piece[]): GameState {
  return withPieces(
    minimalState({
      factions: ['eyrie', 'mechanicalMarquise'],
      players: [
        player(HUMAN_SEAT, 'eyrie', { hand: [card('ROOT-204')] }),
        player(BOT_SEAT, 'mechanicalMarquise', { board: createMechanicalMarquiseBoard() }),
      ],
    }),
    BATTLE_CLEARING,
    pieces,
  )
}

function battleEvent(overrides: Partial<BattleEvent>): BattleEvent {
  return {
    type: 'battle',
    clearing: BATTLE_CLEARING,
    attacker: HUMAN_SEAT,
    defender: BOT_SEAT,
    stage: 'removeDefender',
    hits: { attacker: 0, defender: 0 },
    ...overrides,
  }
}

beforeEach(() => {
  resetPlaceIds()
})

describe('Rootbotics 1.2.1 Taking Hits', () => {
  it('a bot removes its tokens before any of its buildings', () => {
    const state = humanVersusMechanicalMarquise([
      { id: 'sawmill', kind: 'building', type: 'sawmill', owner: BOT_SEAT },
      { id: 'keep', kind: 'token', type: 'keep', owner: BOT_SEAT },
      { id: 'enemy', kind: 'warrior', owner: HUMAN_SEAT },
    ])
    const event = battleEvent({ hits: { attacker: 1, defender: 0 } })
    const specs = battleResolver.legalActions(state, event, testContext({ state }))
    expect(specs.map((spec: ActionSpec) => spec.params?.pieceIds)).toEqual([['keep']])
  })

  it('a bot picks at random which building goes once its tokens are gone', () => {
    const state = humanVersusMechanicalMarquise([
      { id: 'sawmill', kind: 'building', type: 'sawmill', owner: BOT_SEAT },
      { id: 'recruiter', kind: 'building', type: 'recruiter', owner: BOT_SEAT },
      { id: 'enemy', kind: 'warrior', owner: HUMAN_SEAT },
    ])
    const event = battleEvent({ hits: { attacker: 1, defender: 0 } })
    const specs = battleResolver.legalActions(state, event, testContext({ state }))
    expect(botEventAnswer(event, specs, createTestRng([1]))).toEqual({
      type: 'resolveEvent',
      pieceIds: ['recruiter'],
    })
  })

  it('removed bot buildings go back to their track', () => {
    const state = humanVersusMechanicalMarquise([
      { id: 'sawmill', kind: 'building', type: 'sawmill', owner: BOT_SEAT },
    ])
    removePieces(state, { clearing: BATTLE_CLEARING, pieceIds: ['sawmill'], scorer: HUMAN_SEAT })
    const board = state.players[BOT_SEAT]!.board
    expect(board.kind === 'mechanicalMarquise' && board.tracks.sawmill.placed).toBe(1)
    expect(state.players[HUMAN_SEAT]!.vp).toBe(1)
  })
})

describe('Rootbotics 2.8.2 Hates Surprises', () => {
  it('a human defending against a bot cannot play an ambush: the battle rolls at once', () => {
    const state = withPieces(
      minimalState({
        factions: ['eyrie', 'mechanicalMarquise'],
        currentSeat: BOT_SEAT,
        players: [
          player(HUMAN_SEAT, 'eyrie', { hand: [card(BIRD_AMBUSH)] }),
          player(BOT_SEAT, 'mechanicalMarquise', { board: createMechanicalMarquiseBoard() }),
        ],
      }),
      BATTLE_CLEARING,
      [
        { id: 'bot', kind: 'warrior', owner: BOT_SEAT },
        { id: 'human', kind: 'warrior', owner: HUMAN_SEAT },
      ],
    )
    openBattle(
      state,
      { clearing: BATTLE_CLEARING, attacker: BOT_SEAT, defender: HUMAN_SEAT },
      testContext({ state, dice: [0, 0] }),
    )
    const event = state.pending[0]
    expect(event?.type === 'battle' && event.stage).not.toBe('ambush')
  })
})

describe('Rootbotics 2.8.1 Poor Manual Dexterity', () => {
  it('a card given to a bot is discarded and the bot scores one point', () => {
    const state = humanVersusMechanicalMarquise([])
    const given = card('ROOT-205')
    const logs = giveCard(state, { card: given, receiver: BOT_SEAT }, testContext({ state }))
    expect(state.players[BOT_SEAT]!.hand).toEqual([])
    expect(state.deck.discard).toEqual([given])
    expect(state.players[BOT_SEAT]!.vp).toBe(1)
    expect(logs).toEqual([{ t: 'vp', actor: BOT_SEAT, delta: 1, reason: 'card given to bot' }])
  })

  it('taking a card from a bot draws one instead', () => {
    const drawn = card('ROOT-206')
    const state: GameState = {
      ...humanVersusMechanicalMarquise([]),
      deck: { draw: [drawn], discard: [] },
    }
    expect(hasCardToTake(state, BOT_SEAT)).toBe(true)
    drawInsteadOfTakingFromBot(state, HUMAN_SEAT, testContext({ state }))
    expect(state.players[HUMAN_SEAT]!.hand).toContainEqual(drawn)
  })
})

describe('bots answer their own prompts (Rootbotics 2.6)', () => {
  it('declines what it is offered to decline', () => {
    const event = battleEvent({ stage: 'ambush' })
    const specs: ActionSpec[] = [
      { type: 'resolveEvent', actor: BOT_SEAT, params: { decline: [true] } },
    ]
    expect(botEventAnswer(event, specs, createTestRng())).toEqual({
      type: 'resolveEvent',
      decline: true,
    })
  })

  it('Game answers a bot defender\'s hits right after the human battles', () => {
    const state: GameState = withPieces(
      minimalState({
        factions: ['marquise', 'electricEyrie'],
        players: [
          player(HUMAN_SEAT, 'marquise'),
          player(BOT_SEAT, 'electricEyrie', { board: createElectricEyrieBoard() }),
        ],
      }),
      BATTLE_CLEARING,
      [
        { id: 'cat-1', kind: 'warrior', owner: HUMAN_SEAT },
        { id: 'cat-2', kind: 'warrior', owner: HUMAN_SEAT },
        { id: 'cat-3', kind: 'warrior', owner: HUMAN_SEAT },
        { id: 'bird-1', kind: 'warrior', owner: BOT_SEAT },
        { id: 'bird-2', kind: 'warrior', owner: BOT_SEAT },
        { id: 'bird-3', kind: 'warrior', owner: BOT_SEAT },
      ],
    )
    const game = Game.fromJSON({ state, history: [], log: [], rng: { seed: 5, cursor: 0 } })

    game.apply({ type: 'battle', clearing: BATTLE_CLEARING, defender: BOT_SEAT })

    const waitingOn = game.legalActions().map((spec: ActionSpec) => spec.actor)
    expect(waitingOn.every((seat) => seat === HUMAN_SEAT)).toBe(true)
    expect(warriors(game.state, BATTLE_CLEARING, BOT_SEAT)).toBeLessThanOrEqual(3)
  })
})
