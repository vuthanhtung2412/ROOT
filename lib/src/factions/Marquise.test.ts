import { describe, expect, it, beforeEach } from 'vitest'
import { defOf } from '../cards/Deck.js'
import { Game } from '../game/Game.js'
import { FALL } from '../map/fall.js'
import { warriors } from '../queries/pieces.js'
import { keepOwner } from '../queries/place.js'
import { resetPlaceIds } from '../rules/place.js'
import { HAND_LIMIT } from '../state/constants.js'
import { card, player, minimalState, testContext, withPieces } from '../test/fixtures.js'
import {
  buildColumn,
  keepCornerFor,
  MARQUISE,
  recruiterDrawBonus,
} from './Marquise.js'

function setupContext() {
  return testContext()
}

describe('Marquise setup', () => {
  beforeEach(() => resetPlaceIds())

  it('Rule: Marquise > Setup 1–2 — keep at corners[0]', () => {
    const state = minimalState({
      status: 'playing',
      players: [player(0, 'marquise')],
    })
    MARQUISE.setup(state, 0, setupContext())
    expect(keepOwner(state, FALL.corners[0])).toBe(0)
  })

  it('Rule: Marquise > Setup 3 — garrisons all except opposite corner', () => {
    const state = minimalState({
      players: [player(0, 'marquise')],
    })
    MARQUISE.setup(state, 0, setupContext())
    const keep = FALL.corners[0]!
    const opposite = FALL.opposite(keep)

    for (let c = 0; c < 12; c++) {
      if (c === opposite) {
        expect(warriors(state, c, 0)).toBe(0)
      } else {
        expect(warriors(state, c, 0)).toBe(1)
      }
    }
  })

  it('Rule: Marquise > Setup 4–5 — direct setup auto-places buildings; tracks leftmost empty', () => {
    const state = minimalState({
      players: [player(0, 'marquise')],
    })
    MARQUISE.setup(state, 0, setupContext())
    const keep = FALL.corners[0]!
    const zone = [keep, ...FALL.adjacent(keep)]

    const buildings = zone.flatMap((id) =>
      state.clearings[id]!.pieces.filter((p) => p.kind === 'building'),
    )
    expect(buildings).toHaveLength(3)
    expect(buildings.map((b) => b.kind === 'building' && b.type).sort()).toEqual([
      'recruiter',
      'sawmill',
      'workshop',
    ])
    expect(state.clearings[keep]!.pieces.some((p) => p.kind === 'building')).toBe(true)

    const board = state.players[0]!.board
    expect(board.kind).toBe('marquise')
    if (board.kind === 'marquise') {
      expect(board.tracks.sawmill.placed).toBe(5)
      expect(board.tracks.workshop.placed).toBe(5)
      expect(board.tracks.recruiter.placed).toBe(5)
      expect(board.supply.warriors).toBe(25 - 11)
    }
  })

  it('House rule: buildings overflow to adjacent when keep slots full', () => {
    const state = minimalState({
      players: [player(0, 'marquise')],
    })
    // Corner 0 has 1 slot — only one building fits on keep.
    MARQUISE.setup(state, 0, setupContext())
    const keep = FALL.corners[0]!
    const onKeep = state.clearings[keep]!.pieces.filter((p) => p.kind === 'building').length
    expect(onKeep).toBe(1)

    const adjacentIds = FALL.adjacent(keep)
    const onAdjacent = adjacentIds.reduce(
      (n, id) => n + state.clearings[id]!.pieces.filter((p) => p.kind === 'building').length,
      0,
    )
    expect(onAdjacent).toBe(2)
  })
})

function lobbyTwo(seed = 42): Game {
  const game = Game.create({ seed })
  game.join('a')
  game.join('b')
  game.start()
  game.apply({ type: 'resolveEvent', clearing: 0 })
  while (game.state.pending[0]?.type === 'placeStartingBuilding') {
    const clearings = game.legalActions()[0]?.params?.clearing
    if (clearings === undefined || clearings.length === 0) {
      throw new Error('no legal starting building clearings')
    }
    game.apply({ type: 'resolveEvent', clearing: clearings[0]! })
  }
  game.apply({ type: 'resolveEvent', leader: 'builder' })
  return game
}

function advanceToActions(game: Game): void {
  if (game.state.phase === 'birdsong') game.apply({ type: 'endPhase' })
  if (game.state.step === 'craft') game.apply({ type: 'endPhase' })
}

describe('Marquise turn', () => {
  beforeEach(() => resetPlaceIds())

  it('Rule: Marquise > Birdsong — place 1 wood per sawmill capped by supply', () => {
    const game = lobbyTwo(5)
    const seat = game.state.currentSeat
    const sawmills = game.state.clearings.flatMap((c, id) =>
      c.pieces.some((p) => p.kind === 'building' && p.type === 'sawmill' && p.owner === seat)
        ? [id]
        : [],
    )
    expect(sawmills.length).toBeGreaterThan(0)
    const board = game.state.players[seat]!.board
    expect(board.kind).toBe('marquise')
    if (board.kind !== 'marquise') return

    expect(board.supply.wood).toBe(8 - sawmills.length)
    for (const id of sawmills) {
      expect(
        game.state.clearings[id]!.pieces.some(
          (p) => p.kind === 'token' && p.type === 'wood' && p.owner === seat,
        ),
      ).toBe(true)
    }
  })

  it('Rule: Marquise > Daylight — craft step then actions step', () => {
    const game = lobbyTwo(3)
    expect(game.state.phase).toBe('birdsong')
    game.apply({ type: 'endPhase' })
    expect(game.state.phase).toBe('daylight')
    expect(game.state.step).toBe('craft')
    game.apply({ type: 'endPhase' })
    expect(game.state.step).toBe('actions')
  })

  it('Rule: Marquise > Daylight — action budget is 3', () => {
    const game = lobbyTwo(3)
    advanceToActions(game)
    expect(game.state.turnScratch.actionsLeft).toBe(3)
    expect(game.state.turnScratch.extraActions).toBe(0)
  })

  it('Rule: Marquise > Daylight — spendBird grants extra action', () => {
    const game = lobbyTwo(3)
    advanceToActions(game)
    const seat = game.state.currentSeat
    const bird = card('ROOT-205')
    game.state.players[seat]!.hand.push(bird)
    game.apply({ type: 'spendBird', cardId: bird.id })
    expect(game.state.turnScratch.extraActions).toBe(1)
    expect(game.state.turnScratch.actionsLeft).toBe(3)
  })

  it('Rule: Marquise > Recruit — once per turn places 1 warrior per recruiter', () => {
    const game = lobbyTwo(3)
    advanceToActions(game)
    const seat = game.state.currentSeat
    const recruiters = game.state.clearings.flatMap((c, id) =>
      c.pieces.some((p) => p.kind === 'building' && p.type === 'recruiter' && p.owner === seat)
        ? [id]
        : [],
    )
    const before = recruiters.reduce((n, id) => n + warriors(game.state, id, seat), 0)
    game.apply({ type: 'recruit' })
    const after = recruiters.reduce((n, id) => n + warriors(game.state, id, seat), 0)
    expect(after - before).toBe(recruiters.length)
    expect(() => game.apply({ type: 'recruit' })).toThrow()
  })

  it('Rule: Marquise > March — up to 2 moves', () => {
    const game = lobbyTwo(3)
    advanceToActions(game)
    const seat = game.state.currentSeat
    const keep = keepCornerFor(game.state, seat)
    const adj = FALL.adjacent(keep)[0]!
    game.apply({
      type: 'march',
      moves: [
        { from: keep, to: adj, count: 1 },
        { from: adj, to: keep, count: 1 },
      ],
    })
    expect(game.state.turnScratch.actionsLeft + game.state.turnScratch.extraActions).toBe(2)
  })

  it('Rule: 6.5.2 March — second move uses warriors from first', () => {
    // C1:1w, C5:1w → march C1→C5 (1), C5→C10 (2) → C10:2w
    const game = lobbyTwo(3)
    advanceToActions(game)
    const seat = game.state.currentSeat
    for (const clearing of game.state.clearings) {
      clearing.pieces = clearing.pieces.filter(
        (piece) => !(piece.kind === 'warrior' && piece.owner === seat),
      )
    }
    game.state.clearings[1]!.pieces.push({
      id: 'w-c1',
      kind: 'warrior',
      owner: seat,
    })
    game.state.clearings[5]!.pieces.push({
      id: 'w-c5',
      kind: 'warrior',
      owner: seat,
    })
    // Clear enemies so Marquise rules origins/destinations for canMove
    for (const clearingId of [1, 5, 10]) {
      game.state.clearings[clearingId]!.pieces = game.state.clearings[
        clearingId
      ]!.pieces.filter((piece) => piece.owner === seat)
    }

    game.apply({
      type: 'march',
      moves: [
        { from: 1, to: 5, count: 1 },
        { from: 5, to: 10, count: 2 },
      ],
    })
    expect(warriors(game.state, 1, seat)).toBe(0)
    expect(warriors(game.state, 5, seat)).toBe(0)
    expect(warriors(game.state, 10, seat)).toBe(2)
  })

  it('Rule: Marquise > Build 1–4 — pay wood, place building, score track VP', () => {
    const game = lobbyTwo(3)
    advanceToActions(game)
    const seat = game.state.currentSeat
    const keep = keepCornerFor(game.state, seat)
    const buildAt = FALL.adjacent(keep).find((id) =>
      game.state.clearings[id]!.pieces.filter((p) => p.kind === 'building').length === 0,
    )!
    // Law garrison puts both cats on most clearings → strip enemies so seat rules.
    game.state.clearings[buildAt]!.pieces = game.state.clearings[buildAt]!.pieces.filter(
      (p) => p.owner === seat,
    )
    game.state.clearings[buildAt]!.pieces.push({
      id: 'wood-k',
      kind: 'token',
      owner: seat,
      type: 'wood',
    })
    const vpBefore = game.state.players[seat]!.vp
    const column = buildColumn(5)
    game.apply({ type: 'build', clearing: buildAt, building: 'sawmill' })
    expect(
      game.state.clearings[buildAt]!.pieces.some(
        (p) => p.kind === 'building' && p.type === 'sawmill' && p.owner === seat,
      ),
    ).toBe(true)
    expect(game.state.players[seat]!.vp).toBeGreaterThan(vpBefore)
    expect(game.state.players[seat]!.board.kind).toBe('marquise')
    if (game.state.players[seat]!.board.kind === 'marquise') {
      expect(game.state.players[seat]!.board.tracks.sawmill.placed).toBe(4)
      expect(column).toBe(1)
    }
  })

  it('Rule: Marquise > Overwork — card matching sawmill clearing adds wood', () => {
    const game = lobbyTwo(3)
    advanceToActions(game)
    const seat = game.state.currentSeat
    let sawmillClearing = 0
    for (let id = 0; id < 12; id++) {
      if (
        game.state.clearings[id]!.pieces.some(
          (p) => p.kind === 'building' && p.type === 'sawmill' && p.owner === seat,
        )
      ) {
        sawmillClearing = id
        break
      }
    }
    const spend = card('ROOT-205')
    expect(defOf(spend).suit).toBe('bird')
    game.state.players[seat]!.hand.push(spend)
    const woodBefore = game.state.clearings[sawmillClearing]!.pieces.filter(
      (p) => p.kind === 'token' && p.type === 'wood',
    ).length
    game.apply({ type: 'overwork', clearing: sawmillClearing, cardId: spend.id })
    const woodAfter = game.state.clearings[sawmillClearing]!.pieces.filter(
      (p) => p.kind === 'token' && p.type === 'wood',
    ).length
    expect(woodAfter).toBe(woodBefore + 1)
  })

  it('Rule: Marquise > Craft — workshops craft item during craft step', () => {
    const game = lobbyTwo(3)
    game.apply({ type: 'endPhase' })
    const seat = game.state.currentSeat
    let workshopClearing = 0
    for (let id = 0; id < 12; id++) {
      if (
        game.state.clearings[id]!.pieces.some(
          (p) => p.kind === 'building' && p.type === 'workshop' && p.owner === seat,
        )
      ) {
        workshopClearing = id
        break
      }
    }
    const suit = FALL.clearings[workshopClearing]!.suit
    const craftCardBySuit =
      suit === 'fox' ? card('ROOT-204') : suit === 'rabbit' ? card('ROOT-206') : card('ROOT-208')
    game.state.players[seat]!.hand.push(craftCardBySuit)
    game.apply({ type: 'craft', cardId: craftCardBySuit.id })
    expect(game.state.players[seat]!.craftedItems.length).toBe(1)
  })

  it('Rule: Marquise > Evening — draw 1 plus recruiter draw bonus', () => {
    const state = minimalState({
      phase: 'evening',
      step: 'draw',
      deck: { draw: [card('ROOT-206'), card('ROOT-207'), card('ROOT-208')], discard: [] },
    })
    const board = state.players[0]!.board
    expect(board.kind).toBe('marquise')
    if (board.kind === 'marquise') {
      board.tracks.recruiter.placed = 1
      expect(recruiterDrawBonus(board)).toBe(2)
    }
    MARQUISE.apply(state, { type: 'eveningDraw' }, setupContext())
    expect(state.players[0]!.hand.length).toBe(3)
  })

  it('Rule: Cards — evening discard to hand limit 5', () => {
    const state = minimalState({ phase: 'evening', step: 'discard' })
    state.players[0]!.hand = [
      card('ROOT-206', 1),
      card('ROOT-207', 2),
      card('ROOT-208', 3),
      card('ROOT-209', 4),
      card('ROOT-210', 5),
      card('ROOT-211', 6),
      card('ROOT-212', 7),
    ]
    MARQUISE.apply(
      state,
      { type: 'discard', cardIds: ['ROOT-206#1', 'ROOT-207#2'] },
      setupContext(),
    )
    expect(state.players[0]!.hand.length).toBe(HAND_LIMIT)
  })

  it('Rule: Marquise > Battle — action opens pending battle event', () => {
    const state = withPieces(
      minimalState({ phase: 'daylight', step: 'actions' }),
      4,
      [
        { id: 'a1', kind: 'warrior', owner: 0 },
        { id: 'd1', kind: 'warrior', owner: 1 },
      ],
    )
    MARQUISE.apply(
      state,
      { type: 'battle', clearing: 4, defender: 1 },
      setupContext(),
    )
    expect(state.pending).toHaveLength(1)
    expect(state.pending[0]!.type).toBe('battle')
    expect(state.turnScratch.actionsLeft).toBe(2)
  })

  it('Rule: Marquise > endTurn — resets building used flags and turn scratch', () => {
    const state = withPieces(minimalState(), 0, [
      { id: 'ws', kind: 'building', owner: 0, type: 'workshop', used: true },
    ])
    state.turnScratch = {
      actionsLeft: 0,
      extraActions: 1,
      recruited: true,
      birdsongWoodDone: true,
      eveningDrawDone: true,
      swapMeetUsed: true,
      charmOffensiveUsed: false,
      leagueUsed: false,
      propagandaUsed: false,
      saboteursUsed: false,
      falseOrdersUsed: false,
      emergencyOrdersDone: true,
      eveningScoreDone: true,
      decree: null,
      decreeDone: true,
    }
    MARQUISE.endTurn(state)
    expect(state.clearings[0]!.pieces[0]!.kind).toBe('building')
    if (state.clearings[0]!.pieces[0]!.kind === 'building') {
      expect(state.clearings[0]!.pieces[0]!.used).toBe(false)
    }
    expect(state.turnScratch).toEqual({
      actionsLeft: 3,
      extraActions: 0,
      recruited: false,
      birdsongWoodDone: false,
      eveningDrawDone: false,
      swapMeetUsed: false,
      charmOffensiveUsed: false,
      leagueUsed: false,
      propagandaUsed: false,
      saboteursUsed: false,
      falseOrdersUsed: false,
      emergencyOrdersDone: false,
      eveningScoreDone: false,
      decree: null,
      decreeDone: false,
    })
  })
})

describe('Marquise legalActions card choices', () => {
  beforeEach(() => resetPlaceIds())

  it('exposes craftable cardIds during craft step', () => {
    const game = lobbyTwo(3)
    game.apply({ type: 'endPhase' })
    expect(game.state.step).toBe('craft')
    const seat = game.state.currentSeat
    let workshopClearing = 0
    for (let id = 0; id < 12; id++) {
      if (
        game.state.clearings[id]!.pieces.some(
          (p) => p.kind === 'building' && p.type === 'workshop' && p.owner === seat,
        )
      ) {
        workshopClearing = id
        break
      }
    }
    const suit = FALL.clearings[workshopClearing]!.suit
    const craftable =
      suit === 'fox' ? card('ROOT-204') : suit === 'rabbit' ? card('ROOT-206') : card('ROOT-208')
    game.state.players[seat]!.hand = [craftable]
    const craftSpec = game.legalActions().find((spec) => spec.type === 'craft')
    expect(craftSpec?.params?.cardIds).toEqual([craftable.id])
  })

  it('exposes bird cardIds for spendBird', () => {
    const game = lobbyTwo(3)
    advanceToActions(game)
    const seat = game.state.currentSeat
    const bird = card('ROOT-205')
    expect(defOf(bird).suit).toBe('bird')
    game.state.players[seat]!.hand = [bird]
    const spendSpec = game.legalActions().find((spec) => spec.type === 'spendBird')
    expect(spendSpec?.params?.cardIds).toEqual([bird.id])
  })

  it('exposes paired overwork options (cardId × sawmill clearing)', () => {
    const game = lobbyTwo(3)
    advanceToActions(game)
    const seat = game.state.currentSeat
    let sawmillClearing = 0
    for (let id = 0; id < 12; id++) {
      if (
        game.state.clearings[id]!.pieces.some(
          (p) => p.kind === 'building' && p.type === 'sawmill' && p.owner === seat,
        )
      ) {
        sawmillClearing = id
        break
      }
    }
    const bird = card('ROOT-205')
    expect(defOf(bird).suit).toBe('bird')
    game.state.players[seat]!.hand = [bird]
    const overworkSpec = game.legalActions().find((spec) => spec.type === 'overwork')
    expect(overworkSpec?.params?.options).toEqual([{ cardId: bird.id, clearing: sawmillClearing }])
  })

  it('exposes hand cardIds when discard required', () => {
    const state = minimalState({ phase: 'evening', step: 'discard' })
    state.players[0]!.hand = [
      card('ROOT-206', 1),
      card('ROOT-207', 2),
      card('ROOT-208', 3),
      card('ROOT-209', 4),
      card('ROOT-210', 5),
      card('ROOT-211', 6),
    ]
    const discardSpec = MARQUISE.legalActions(state, setupContext()).find(
      (spec) => spec.type === 'discard',
    )
    expect(discardSpec?.params?.cardIds).toEqual(state.players[0]!.hand.map((c) => c.id))
  })
})

describe('Marquise legalActions board choices', () => {
  beforeEach(() => resetPlaceIds())

  it('exposes march move routes with counts', () => {
    const game = lobbyTwo(3)
    advanceToActions(game)
    const marchSpec = game.legalActions().find((spec) => spec.type === 'march')
    expect(marchSpec?.params?.moves?.length).toBeGreaterThan(0)
    const sample = marchSpec!.params!.moves![0]!
    expect(sample.count).toBeGreaterThanOrEqual(1)
    expect(sample.from).not.toBe(sample.to)
  })

  it('exposes paired build options (clearing × building)', () => {
    const game = lobbyTwo(3)
    advanceToActions(game)
    const seat = game.state.currentSeat
    const keep = keepCornerFor(game.state, seat)
    const buildAt = FALL.adjacent(keep).find((id) =>
      game.state.clearings[id]!.pieces.filter((p) => p.kind === 'building').length === 0,
    )!
    game.state.clearings[buildAt]!.pieces = game.state.clearings[buildAt]!.pieces.filter(
      (p) => p.owner === seat,
    )
    game.state.clearings[buildAt]!.pieces.push({
      id: 'wood-k',
      kind: 'token',
      owner: seat,
      type: 'wood',
    })
    const buildSpec = game.legalActions().find((spec) => spec.type === 'build')
    expect(buildSpec?.params?.options).toEqual(
      expect.arrayContaining([{ clearing: buildAt, building: 'sawmill' }]),
    )
  })

  it('exposes paired battle targets (clearing × defender)', () => {
    const state = withPieces(
      minimalState({ phase: 'daylight', step: 'actions' }),
      4,
      [
        { id: 'a1', kind: 'warrior', owner: 0 },
        { id: 'd1', kind: 'warrior', owner: 1 },
      ],
    )
    const battleSpec = MARQUISE.legalActions(state, setupContext()).find(
      (spec) => spec.type === 'battle',
    )
    expect(battleSpec?.params?.targets).toEqual([{ clearing: 4, defender: 1 }])
  })

  it('exposes recruit as flag-only (no params)', () => {
    const game = lobbyTwo(3)
    advanceToActions(game)
    const recruitSpec = game.legalActions().find((spec) => spec.type === 'recruit')
    expect(recruitSpec).toBeDefined()
    expect(recruitSpec?.params).toBeUndefined()
  })
})
