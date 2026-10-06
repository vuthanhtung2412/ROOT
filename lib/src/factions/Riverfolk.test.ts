import { beforeEach, describe, expect, it } from 'vitest'
import type { Action, ActionSpec } from '#actions/types.js'
import { RIVERFOLK } from '#factions/Riverfolk.js'
import { riverfolkBoardOf } from '#factions/riverfolk/rules.js'
import { Game } from '#game/Game.js'
import { FALL } from '#map/fall.js'
import type { Piece, Seat } from '#pieces/types.js'
import { canMove } from '#queries/move.js'
import { warriors } from '#queries/pieces.js'
import { resetPlaceIds } from '#rules/place.js'
import { removePieces } from '#rules/remove.js'
import {
  RIVERFOLK_STARTING_PAYMENTS,
  RIVERFOLK_STARTING_WARRIORS,
  RIVERFOLK_WARRIOR_COUNT,
  type RiverfolkBoard,
} from '#state/riverfolkBoard.js'
import { createTurnScratch } from '#state/turnScratch.js'
import type { GameState, Phase, Step } from '#state/types.js'
import {
  card,
  finishSetup,
  minimalState,
  player,
  riverfolkBoard,
  testContext,
  withPieces,
} from '#test/fixtures.js'
import { defaultRuleHooks } from '#triggers/hooks.js'

const COMPANY: Seat = 0
const BUYER: Seat = 1
/** Clearings 4 and 9 are joined by the river only; 0 and 4 by a path. */
const RIVER_CLEARING = 4
const DOWNRIVER_CLEARING = 9
const PATH_CLEARING = 0
/** One past the last space of a Services track. */
const ILLEGAL_SERVICE_COST = 5
const MOUSE_RIVER_CLEARING = 6
const RABBIT_CARD = card('ROOT-206')
const MARQUISE_STARTING_SUPPLY = 25

type CompanyStateOptions = {
  board?: Partial<RiverfolkBoard>
  phase?: Phase
  step?: Step
  hand?: GameState['players'][number]['hand']
}

function companyState(options: CompanyStateOptions = {}): GameState {
  return minimalState({
    factions: ['riverfolk', 'marquise'],
    players: [
      player(COMPANY, 'riverfolk', {
        board: riverfolkBoard(options.board),
        hand: options.hand ?? [],
      }),
      player(BUYER, 'marquise'),
    ],
    phase: options.phase ?? 'daylight',
    step: options.step ?? 'commerce',
    turnScratch: createTurnScratch({ fundsGathered: true }),
  })
}

function companyWarrior(id: string): Piece {
  return { id, kind: 'warrior', owner: COMPANY }
}

function buyerWarrior(id: string): Piece {
  return { id, kind: 'warrior', owner: BUYER }
}

function tradePost(id: string): Piece {
  return { id, kind: 'token', owner: COMPANY, type: 'tradePost' }
}

function specOf(state: GameState, type: string): ActionSpec | undefined {
  return RIVERFOLK.legalActions(state, testContext({ state })).find(
    (spec: ActionSpec): boolean => spec.type === type,
  )
}

function applyCompany(state: GameState, action: Action): void {
  const context = testContext({ state, dice: [0, 0] })
  RIVERFOLK.validate(state, action, context)
  RIVERFOLK.apply(state, action, context)
}

describe('Riverfolk Company setup', () => {
  beforeEach(() => resetPlaceIds())

  it('Rule: 11.3 — 4 river warriors, 3 payments, a cost on each service', () => {
    const game = Game.create({ seed: 7, factions: ['marquise', 'riverfolk'] })
    game.join('first')
    game.join('second')
    game.start()
    finishSetup(game, { serviceCost: 3 })

    const board = riverfolkBoardOf(game.state, 1)
    const onMap = FALL.riverClearings().reduce(
      (total, clearing) => total + warriors(game.state, clearing, 1),
      0,
    )
    expect(onMap).toBe(RIVERFOLK_STARTING_WARRIORS)
    expect(board.payments).toEqual([1, 1, 1])
    expect(board.supply.warriors).toBe(
      RIVERFOLK_WARRIOR_COUNT -
        RIVERFOLK_STARTING_WARRIORS -
        RIVERFOLK_STARTING_PAYMENTS,
    )
    expect(board.serviceCosts).toEqual({
      handCard: 3,
      riverboats: 3,
      mercenaries: 3,
    })
    expect(game.state.status).toBe('playing')
  })

  it('Rule: 11.3.2 — starting warriors only go in clearings touching the river', () => {
    const game = Game.create({ seed: 7, factions: ['eyrie', 'riverfolk'] })
    game.join('first')
    game.join('second')
    game.start()
    game.apply({ type: 'resolveEvent', leader: 'builder' })
    expect(game.legalActions()[0]?.params?.clearing).toEqual(
      FALL.riverClearings(),
    )
    expect(() =>
      game.apply({ type: 'resolveEvent', clearing: PATH_CLEARING }),
    ).toThrow(expect.objectContaining({ code: 'ILLEGAL_ACTION' }))
  })

  it('Rule: 11.3.5 — one setup choice sets a different cost on each service', () => {
    const game = Game.create({ seed: 7, factions: ['eyrie', 'riverfolk'] })
    game.join('first')
    game.join('second')
    game.start()
    game.apply({ type: 'resolveEvent', leader: 'builder' })
    while (game.state.pending[0]?.type === 'placeRiverfolkWarrior') {
      const clearings = game.legalActions()[0]?.params?.clearing ?? []
      game.apply({ type: 'resolveEvent', clearing: clearings[0]! })
    }

    expect(game.state.pending).toEqual([{ type: 'setStartingCosts', seat: 1 }])
    expect(() =>
      game.apply({
        type: 'resolveEvent',
        handCard: 2,
        riverboats: 1,
        mercenaries: ILLEGAL_SERVICE_COST,
      }),
    ).toThrow(expect.objectContaining({ code: 'ILLEGAL_ACTION' }))

    game.apply({
      type: 'resolveEvent',
      handCard: 2,
      riverboats: 1,
      mercenaries: 4,
    })
    expect(riverfolkBoardOf(game.state, 1).serviceCosts).toEqual({
      handCard: 2,
      riverboats: 1,
      mercenaries: 4,
    })
    expect(game.state.status).toBe('playing')
  })
})

describe('Riverfolk Company Birdsong', () => {
  function birdsongState(board: Partial<RiverfolkBoard>): GameState {
    const state = companyState({ phase: 'birdsong', step: 'funds', board })
    state.turnScratch = createTurnScratch()
    return state
  }

  it('Rule: 11.4.1 Protectionism — an empty Payments box gets two warriors', () => {
    const state = birdsongState({})
    expect(RIVERFOLK.autoActions(state, 'birdsong', 'funds')).toEqual([
      { type: 'gatherFunds' },
    ])
    applyCompany(state, { type: 'gatherFunds' })
    const board = riverfolkBoardOf(state, COMPANY)
    expect(board.funds).toEqual([COMPANY, COMPANY])
    expect(board.supply.warriors).toBe(RIVERFOLK_WARRIOR_COUNT - 2)
    expect(RIVERFOLK.autoActions(state, 'birdsong', 'funds')).toEqual([])
  })

  it('Rule: 11.4.2 Score Dividends — one point per two funds, only with a trade post', () => {
    const funds: Seat[] = [COMPANY, BUYER, BUYER, BUYER, BUYER]
    const withoutPost = birdsongState({ funds: [...funds], payments: [BUYER] })
    applyCompany(withoutPost, { type: 'gatherFunds' })
    expect(withoutPost.players[COMPANY]!.vp).toBe(0)

    const withPost = withPieces(
      birdsongState({ funds: [...funds], payments: [BUYER] }),
      RIVER_CLEARING,
      [tradePost('t1')],
    )
    applyCompany(withPost, { type: 'gatherFunds' })
    expect(withPost.players[COMPANY]!.vp).toBe(2)
  })

  it('Rule: 11.4.3 Gather Funds — every warrior on the board moves to Funds', () => {
    const state = birdsongState({
      payments: [BUYER],
      committed: [COMPANY],
      craftCommitted: { fox: [], rabbit: [BUYER], mouse: [] },
    })
    applyCompany(state, { type: 'gatherFunds' })
    const board = riverfolkBoardOf(state, COMPANY)
    expect(board.funds).toEqual([BUYER, COMPANY, BUYER])
    expect(board.payments).toEqual([])
    expect(board.committed).toEqual([])
    expect(board.craftCommitted.rabbit).toEqual([])
  })
})

describe('Riverfolk Company Daylight', () => {
  it('Rule: 11.2.2 Swimmers — moves along a river whoever rules', () => {
    const state = withPieces(
      withPieces(companyState(), RIVER_CLEARING, [
        companyWarrior('c1'),
        buyerWarrior('b1'),
        buyerWarrior('b2'),
      ]),
      DOWNRIVER_CLEARING,
      [buyerWarrior('b3')],
    )
    const hooks = defaultRuleHooks(FALL)
    expect(
      canMove(
        state,
        { seat: COMPANY, from: RIVER_CLEARING, to: DOWNRIVER_CLEARING },
        hooks,
      ),
    ).toBe(true)
    expect(
      canMove(
        state,
        { seat: COMPANY, from: RIVER_CLEARING, to: PATH_CLEARING },
        hooks,
      ),
    ).toBe(false)
    expect(
      canMove(
        state,
        { seat: BUYER, from: RIVER_CLEARING, to: DOWNRIVER_CLEARING },
        hooks,
      ),
    ).toBe(false)
  })

  it('Rule: 11.5.1 Move — commits the chosen fund', () => {
    const state = withPieces(
      companyState({ board: { funds: [COMPANY, BUYER] } }),
      RIVER_CLEARING,
      [companyWarrior('c1')],
    )
    applyCompany(state, {
      type: 'riverfolkMove',
      from: RIVER_CLEARING,
      to: DOWNRIVER_CLEARING,
      count: 1,
      fundOwner: BUYER,
    })
    const board = riverfolkBoardOf(state, COMPANY)
    expect(warriors(state, DOWNRIVER_CLEARING, COMPANY)).toBe(1)
    expect(board.funds).toEqual([COMPANY])
    expect(board.committed).toEqual([BUYER])
  })

  it('Rule: 11.5 — no funds, no actions', () => {
    const state = withPieces(companyState(), RIVER_CLEARING, [
      companyWarrior('c1'),
    ])
    expect(specOf(state, 'riverfolkMove')).toBeUndefined()
    expect(specOf(state, 'riverfolkDraw')).toBeUndefined()
    expect(specOf(state, 'riverfolkRecruit')).toBeUndefined()
  })

  it('Rule: 11.5.4 Draw — commit one fund to draw a card', () => {
    const state = companyState({ board: { funds: [COMPANY] } })
    state.deck.draw = [RABBIT_CARD]
    applyCompany(state, { type: 'riverfolkDraw', fundOwner: COMPANY })
    expect(state.players[COMPANY]!.hand).toEqual([RABBIT_CARD])
    expect(riverfolkBoardOf(state, COMPANY).committed).toEqual([COMPANY])
  })

  it('Rule: 11.5.5 Recruit — spend a fund (back to its owner) for a river warrior', () => {
    const state = companyState({ board: { funds: [BUYER] } })
    expect(
      specOf(state, 'riverfolkRecruit')?.params?.options?.map((option) =>
        Reflect.get(option, 'clearing'),
      ),
    ).toEqual(FALL.riverClearings())
    applyCompany(state, {
      type: 'riverfolkRecruit',
      clearing: RIVER_CLEARING,
      fundOwner: BUYER,
    })
    expect(warriors(state, RIVER_CLEARING, COMPANY)).toBe(1)
    expect(riverfolkBoardOf(state, COMPANY).funds).toEqual([])
    const buyerBoard = state.players[BUYER]!.board
    expect(buyerBoard.kind === 'marquise' && buyerBoard.supply.warriors).toBe(
      MARQUISE_STARTING_SUPPLY + 1,
    )
  })

  it('Rule: 11.5.6 — trade post costs two funds of the ruler, places post + warrior, scores', () => {
    const base = companyState({ board: { funds: [BUYER, COMPANY, BUYER] } })
    const state = withPieces(base, RIVER_CLEARING, [buyerWarrior('b1')])
    expect(specOf(state, 'establishTradePost')?.params?.options).toEqual([
      { clearing: RIVER_CLEARING },
    ])
    applyCompany(state, { type: 'establishTradePost', clearing: RIVER_CLEARING })
    const board = riverfolkBoardOf(state, COMPANY)
    expect(board.funds).toEqual([COMPANY])
    expect(board.tradePosts.rabbit).toBe(2)
    expect(warriors(state, RIVER_CLEARING, COMPANY)).toBe(1)
    expect(
      state.clearings[RIVER_CLEARING]!.pieces.some(
        (piece) => piece.kind === 'token' && piece.type === 'tradePost',
      ),
    ).toBe(true)
    expect(state.players[COMPANY]!.vp).toBe(2)
    expect(specOf(state, 'establishTradePost')).toBeUndefined()
  })

  it('Rule: 11.5.6.II — the funds must belong to the player who rules the clearing', () => {
    const base = companyState({ board: { funds: [COMPANY, COMPANY] } })
    const state = withPieces(base, RIVER_CLEARING, [buyerWarrior('b1')])
    expect(specOf(state, 'establishTradePost')).toBeUndefined()
  })

  it('Rule: 11.5.3 Craft — needs an empty matching Trade Posts space', () => {
    const noSpace = companyState({
      hand: [RABBIT_CARD],
      board: { funds: [COMPANY] },
    })
    expect(specOf(noSpace, 'riverfolkCraft')).toBeUndefined()

    const state = companyState({
      hand: [RABBIT_CARD],
      board: { funds: [COMPANY], tradePosts: { fox: 3, rabbit: 2, mouse: 3 } },
    })
    applyCompany(state, {
      type: 'riverfolkCraft',
      cardId: RABBIT_CARD.id,
      exportCard: false,
    })
    const board = riverfolkBoardOf(state, COMPANY)
    expect(board.craftCommitted.rabbit).toEqual([COMPANY])
    expect(board.funds).toEqual([])
    expect(state.players[COMPANY]!.craftedItems).toHaveLength(1)
    expect(specOf(state, 'riverfolkCraft')).toBeUndefined()
  })

  it('Rule: 11.5.3.I Export — discard the card for a warrior in Payments', () => {
    const state = companyState({
      hand: [RABBIT_CARD],
      board: { funds: [COMPANY], tradePosts: { fox: 3, rabbit: 2, mouse: 3 } },
    })
    applyCompany(state, {
      type: 'riverfolkCraft',
      cardId: RABBIT_CARD.id,
      exportCard: true,
    })
    const board = riverfolkBoardOf(state, COMPANY)
    expect(board.payments).toEqual([COMPANY])
    expect(state.deck.discard).toEqual([RABBIT_CARD])
    expect(state.players[COMPANY]!.craftedItems).toHaveLength(0)
  })

  it('Rule: 11.2.5.I Trade Disruption — lose half the funds, post leaves the game', () => {
    const base = companyState({
      board: {
        funds: [BUYER, COMPANY, COMPANY],
        tradePosts: { fox: 3, rabbit: 3, mouse: 2 },
      },
    })
    const state = withPieces(base, MOUSE_RIVER_CLEARING, [tradePost('t1')])
    removePieces(state, {
      clearing: MOUSE_RIVER_CLEARING,
      pieceIds: ['t1'],
      scorer: BUYER,
    })
    const board = riverfolkBoardOf(state, COMPANY)
    expect(board.funds).toEqual([COMPANY])
    expect(board.tradePosts.mouse).toBe(2)
    expect(board.supply.warriors).toBe(RIVERFOLK_WARRIOR_COUNT + 1)
    expect(state.players[BUYER]!.vp).toBe(1)
  })
})

describe('Riverfolk Company Evening', () => {
  it('Rule: 11.6.2 Set Costs — one action moves every service marker to any space', () => {
    const state = companyState({ phase: 'evening', step: 'costs' })
    applyCompany(state, {
      type: 'setServiceCosts',
      handCard: 2,
      riverboats: 1,
      mercenaries: 4,
    })
    expect(riverfolkBoardOf(state, COMPANY).serviceCosts).toEqual({
      handCard: 2,
      riverboats: 1,
      mercenaries: 4,
    })
    expect(() =>
      applyCompany(state, {
        type: 'setServiceCosts',
        handCard: 2,
        riverboats: 1,
        mercenaries: 5,
      }),
    ).toThrow(expect.objectContaining({ code: 'ILLEGAL_ACTION' }))
  })
})
