import { describe, expect, it } from 'vitest'
import { legalRemovalSpecs } from '#events/battle/removal.js'
import { offerRiverfolkServices } from '#events/buyServices.js'
import type { BattleEvent } from '#events/types.js'
import { riverfolkBoardOf } from '#factions/riverfolk/rules.js'
import {
  purchasableServices,
  servicesPerTurn,
} from '#factions/riverfolk/services.js'
import { Game } from '#game/Game.js'
import { FALL } from '#map/fall.js'
import type { Piece, Seat } from '#pieces/types.js'
import { canBattle } from '#queries/battle.js'
import { splitMercenaryHits } from '#queries/mercenaries.js'
import { canMove } from '#queries/move.js'
import { ruler } from '#queries/ruler.js'
import { warriorSupplyOf } from '#queries/supply.js'
import { createFactionBoard } from '#state/boards.js'
import type { RiverfolkBoard } from '#state/riverfolkBoard.js'
import { createTurnScratch } from '#state/turnScratch.js'
import type { GameState, Phase, TurnScratch } from '#state/types.js'
import {
  card,
  finishSetup,
  minimalState,
  player,
  riverfolkBoard,
  withPieces,
} from '#test/fixtures.js'
import { defaultRuleHooks } from '#triggers/hooks.js'

const BUYER: Seat = 0
const COMPANY: Seat = 1
const THIRD: Seat = 2
const RIVER_CLEARING = 4
const DOWNRIVER_CLEARING = 9
const FOX_CARD = card('ROOT-204')
const hooks = defaultRuleHooks(FALL)

type ServiceStateOptions = {
  board?: Partial<RiverfolkBoard>
  phase?: Phase
  scratch?: Partial<TurnScratch>
}

function serviceState(options: ServiceStateOptions = {}): GameState {
  return minimalState({
    factions: ['marquise', 'riverfolk', 'eyrie'],
    players: [
      player(BUYER, 'marquise'),
      player(COMPANY, 'riverfolk', {
        board: riverfolkBoard(options.board),
        hand: [FOX_CARD],
      }),
      player(THIRD, 'eyrie'),
    ],
    phase: options.phase ?? 'daylight',
    turnScratch: createTurnScratch(options.scratch),
  })
}

function warriorOf(seat: Seat, id: string): Piece {
  return { id, kind: 'warrior', owner: seat }
}

function startedGame(): Game {
  const game = Game.create({ seed: 9, factions: ['marquise', 'riverfolk'] })
  game.join('first')
  game.join('second')
  game.start()
  finishSetup(game, { serviceCost: 2 })
  return game
}

describe('buying Riverfolk services', () => {
  it('Rule: 11.2.6 — offered at the start of another player Birdsong, before anything else', () => {
    const game = startedGame()
    expect(game.state.pending[0]).toEqual({
      type: 'buyServices',
      buyer: 0,
      bought: 0,
    })
    expect(game.state.turnScratch.birdsongWoodDone).toBe(false)
    expect(() => game.apply({ type: 'endPhase' })).toThrow(
      expect.objectContaining({ code: 'PENDING_EVENT' }),
    )
  })

  it('Rule: 11.2.6.I Cost — buyer warriors go to the Payments box', () => {
    const game = startedGame()
    const supplyBefore = warriorSupplyOf(game.state.players[0]!.board)!.warriors
    game.apply({ type: 'resolveEvent', service: 'riverboats' })
    const sellerBoard = riverfolkBoardOf(game.state, 1)
    expect(sellerBoard.payments.filter((owner) => owner === 0)).toHaveLength(2)
    expect(warriorSupplyOf(game.state.players[0]!.board)!.warriors).toBe(
      supplyBefore - 2,
    )
    expect(game.state.turnScratch.riverboats).toBe(true)
    // Rule: 11.2.6.II — one service per turn without trade posts.
    expect(game.state.pending).toHaveLength(0)
  })

  it('Rule: 11.2.7.II Riverboats — still active in Marquise Daylight actions', () => {
    const game = startedGame()
    game.apply({ type: 'resolveEvent', service: 'riverboats' })
    game.apply({ type: 'endPhase' })
    game.apply({ type: 'endPhase' })
    expect(game.state.step).toBe('actions')
    expect(game.state.turnScratch.riverboats).toBe(true)
  })

  it('Rule: 11.2.7.I Hand Card — the buyer takes the chosen card', () => {
    const game = startedGame()
    const taken = game.state.players[1]!.hand[0]!
    game.apply({ type: 'resolveEvent', service: 'handCard', cardId: taken.id })
    expect(game.state.players[0]!.hand).toContainEqual(taken)
    expect(game.state.players[1]!.hand).not.toContainEqual(taken)
  })

  it('declining closes the offer; the Riverfolk are never offered their own services', () => {
    const game = startedGame()
    game.apply({ type: 'resolveEvent', decline: true })
    expect(game.state.pending).toHaveLength(0)
    expect(game.state.turnScratch.birdsongWoodDone).toBe(true)

    const state = serviceState()
    state.currentSeat = COMPANY
    offerRiverfolkServices(state)
    expect(state.pending).toHaveLength(0)
  })

  it('Rule: 11.2.6.I — a service the buyer cannot pay for is not offered', () => {
    const state = serviceState({
      board: {
        serviceCosts: { handCard: 1, riverboats: 4, mercenaries: 4 },
      },
    })
    state.players[BUYER]!.board = {
      ...createFactionBoard('marquise'),
      kind: 'marquise',
      supply: { warriors: 1, wood: 8 },
      tracks: {
        sawmill: { placed: 5 },
        workshop: { placed: 5 },
        recruiter: { placed: 5 },
      },
    }
    expect(purchasableServices(state, BUYER)).toEqual([
      { service: 'handCard', cardId: FOX_CARD.id },
    ])
  })

  it('Rule: 11.2.6.II — one more service per trade post clearing with buyer pieces', () => {
    const state = withPieces(serviceState(), RIVER_CLEARING, [
      { id: 't1', kind: 'token', owner: COMPANY, type: 'tradePost' },
      warriorOf(BUYER, 'b1'),
    ])
    expect(servicesPerTurn(state, BUYER)).toBe(2)
    expect(servicesPerTurn(state, THIRD)).toBe(1)
  })

  it('Rule: 11.2.7.IIIb — the Vagabond cannot buy mercenaries', () => {
    const state = serviceState()
    state.players[THIRD] = player(THIRD, 'vagabond', {
      board: {
        ...createFactionBoard('vagabond'),
        kind: 'vagabond',
        character: 'thief',
        satchel: [
          { type: 'boot', exhausted: false },
          { type: 'torch', exhausted: false },
        ],
        tracks: { tea: [], coin: [], bag: [] },
        damaged: [],
        completedQuests: [],
        relationships: {
          marquise: 0,
          eyrie: 0,
          alliance: 0,
          vagabond: 0,
          lizard: 0,
          riverfolk: 0,
          mechanicalMarquise: 0,
          electricEyrie: 0,
          automatedAlliance: 0,
          vagabot: 0,
        },
        forest: null,
      },
    })
    const services = purchasableServices(state, THIRD).map((option) =>
      Reflect.get(option, 'service'),
    )
    expect(services).toContain('riverboats')
    expect(services).not.toContain('mercenaries')
  })
})

describe('Riverboats', () => {
  it('Rule: 11.2.7.II — the buyer treats rivers as paths (rule still needed)', () => {
    const base = withPieces(serviceState(), RIVER_CLEARING, [
      warriorOf(BUYER, 'b1'),
    ])
    const path = { seat: BUYER, from: RIVER_CLEARING, to: DOWNRIVER_CLEARING }
    expect(canMove(base, path, hooks)).toBe(false)

    const withBoats = withPieces(
      serviceState({ scratch: { riverboats: true } }),
      RIVER_CLEARING,
      [warriorOf(BUYER, 'b1')],
    )
    expect(canMove(withBoats, path, hooks)).toBe(true)
  })
})

describe('Mercenaries', () => {
  const mercenaryPieces: Piece[] = [
    warriorOf(BUYER, 'b1'),
    warriorOf(COMPANY, 'c1'),
    warriorOf(COMPANY, 'c2'),
    warriorOf(THIRD, 'e1'),
    warriorOf(THIRD, 'e2'),
  ]

  it('Rule: 11.2.7.III — Riverfolk warriors count toward the buyer rule in Daylight', () => {
    const hired = withPieces(
      serviceState({ scratch: { mercenaries: true } }),
      RIVER_CLEARING,
      mercenaryPieces,
    )
    expect(ruler(hired, RIVER_CLEARING, hooks)).toBe(BUYER)

    const birdsong = withPieces(
      serviceState({ phase: 'birdsong', scratch: { mercenaries: true } }),
      RIVER_CLEARING,
      mercenaryPieces,
    )
    expect(ruler(birdsong, RIVER_CLEARING, hooks)).toBe(THIRD)
  })

  it('Rule: 11.2.7.III — the buyer may battle with only mercenaries, but not the Riverfolk', () => {
    const state = withPieces(
      serviceState({ scratch: { mercenaries: true } }),
      RIVER_CLEARING,
      [warriorOf(COMPANY, 'c1'), warriorOf(THIRD, 'e1')],
    )
    expect(canBattle(state, BUYER, RIVER_CLEARING, THIRD)).toBe(true)
    expect(canBattle(state, BUYER, RIVER_CLEARING, COMPANY)).toBe(false)
  })

  it('Rule: 11.2.7.IIIa — odd hits remove owned warriors, even hits Riverfolk warriors', () => {
    expect(
      splitMercenaryHits({ ownWarriors: 2, mercenaries: 2, otherPieces: 1 }, 3),
    ).toEqual({ ownWarriors: 2, mercenaries: 1, otherPieces: 0 })
    expect(
      splitMercenaryHits({ ownWarriors: 0, mercenaries: 1, otherPieces: 2 }, 3),
    ).toEqual({ ownWarriors: 0, mercenaries: 1, otherPieces: 2 })
  })

  it('Rule: 11.2.7.IIIa — battle removal names own and hired warriors together', () => {
    const state = withPieces(
      serviceState({ scratch: { mercenaries: true } }),
      RIVER_CLEARING,
      mercenaryPieces,
    )
    const event: BattleEvent = {
      type: 'battle',
      clearing: RIVER_CLEARING,
      attacker: BUYER,
      defender: THIRD,
      stage: 'removeAttacker',
      hits: { attacker: 0, defender: 2 },
    }
    const specs = legalRemovalSpecs(state, event, BUYER, 2)
    expect(specs).toHaveLength(1)
    expect(specs[0]?.params?.pieceIds).toEqual(['b1', 'c1'])
  })
})
