import { beforeEach, describe, expect, it } from 'vitest'
import { defOf } from '#cards/Deck.js'
import { electricEyrieBoardOf, mechanicalMarquiseBoardOf } from '#factions/bots/botBoards.js'
import { placeElectricEyrieSetup } from '#factions/bots/electricEyrie/setup.js'
import { placeMechanicalMarquiseSetup } from '#factions/bots/mechanicalMarquise/setup.js'
import { isVizier } from '#factions/eyrie/viziers.js'
import { Game } from '#game/Game.js'
import { FALL } from '#map/fall.js'
import type { ClearingId } from '#map/types.js'
import type { Piece, Seat } from '#pieces/types.js'
import { keepClearingFor } from '#queries/place.js'
import { warriors } from '#queries/pieces.js'
import { resetPlaceIds } from '#rules/place.js'
import type { Rng } from '#rules/Rng.js'
import type { GameState } from '#state/types.js'
import { createTestRng, minimalState, player, finishSetup } from '#test/fixtures.js'

const NORTH_EAST_CORNER: ClearingId = 1
const SOUTH_WEST_CORNER: ClearingId = 3
/** Die faces 0–3: enough rolls for one corner pick and one shuffle. */
function pickNorthEastThenShuffle(): Rng {
  return createTestRng([1, 0, 0, 0, 0, 0, 0, 0])
}

function botMarquiseState(): GameState {
  return minimalState({
    status: 'setup',
    factions: ['mechanicalMarquise', 'electricEyrie'],
    players: [player(0, 'mechanicalMarquise'), player(1, 'electricEyrie')],
  })
}

function buildingsOf(state: GameState, seat: Seat): Array<{ clearing: ClearingId; piece: Piece }> {
  return state.clearings.flatMap((clearing, id) =>
    clearing.pieces
      .filter((piece: Piece): boolean => piece.owner === seat && piece.kind === 'building')
      .map((piece: Piece) => ({ clearing: id, piece })),
  )
}

beforeEach(() => {
  resetPlaceIds()
})

describe('Mechanical Marquise setup (Rootbotics 4.3)', () => {
  it('4.3.2–4.3.3 keep in a random corner, garrison all but the opposite corner, extra warrior at the keep', () => {
    const state = botMarquiseState()
    placeMechanicalMarquiseSetup(state, 0, pickNorthEastThenShuffle())

    expect(keepClearingFor(state, 0)).toBe(NORTH_EAST_CORNER)
    expect(warriors(state, NORTH_EAST_CORNER, 0)).toBe(2)
    expect(warriors(state, SOUTH_WEST_CORNER, 0)).toBe(0)
    const garrisoned = FALL.clearings.filter(
      (clearing): boolean => warriors(state, clearing.id, 0) > 0,
    )
    expect(garrisoned).toHaveLength(11)
  })

  it('4.3.4–4.3.5 one of each building in keep or adjacent clearings, one per clearing; tracks full', () => {
    const state = botMarquiseState()
    placeMechanicalMarquiseSetup(state, 0, createTestRng([1, 2, 1, 1, 0, 0, 0, 0]))

    const placed = buildingsOf(state, 0)
    const zone: ClearingId[] = [NORTH_EAST_CORNER, ...FALL.adjacent(NORTH_EAST_CORNER)]
    expect(placed.map(({ piece }) => piece.kind === 'building' && piece.type).sort()).toEqual([
      'recruiter',
      'sawmill',
      'workshop',
    ])
    expect(new Set(placed.map(({ clearing }) => clearing)).size).toBe(3)
    expect(placed.every(({ clearing }) => zone.includes(clearing))).toBe(true)
    expect(mechanicalMarquiseBoardOf(state, 0).tracks).toEqual({
      sawmill: { placed: 5 },
      workshop: { placed: 5 },
      recruiter: { placed: 5 },
    })
  })
})

describe('Electric Eyrie setup (Rootbotics 5.3)', () => {
  it('5.3.2 roost and 6 warriors in the corner opposite the keep; 5.3.3 viziers in bird column; 5.3.4 track', () => {
    const state = botMarquiseState()
    placeMechanicalMarquiseSetup(state, 0, pickNorthEastThenShuffle())
    placeElectricEyrieSetup(state, 1, createTestRng([0, 0, 0, 0]))

    expect(warriors(state, SOUTH_WEST_CORNER, 1)).toBe(6)
    expect(buildingsOf(state, 1)).toEqual([
      { clearing: SOUTH_WEST_CORNER, piece: expect.objectContaining({ type: 'roost' }) },
    ])
    const board = electricEyrieBoardOf(state, 1)
    expect(board.decree.bird.filter(isVizier)).toHaveLength(2)
    expect(board.decree.fox).toEqual([])
    expect(board.roostTrack.placed).toBe(6)
  })
})

describe('game with bots (Rootbotics 2.6, 3.4)', () => {
  it('seats bot factions by themselves; bots draw no hand and dominance leaves the deck', () => {
    const game = Game.create({ seed: 7, factions: ['marquise', 'electricEyrie'] })
    expect(game.state.players).toHaveLength(0)
    game.join('human')
    expect(game.state.players.map((seated) => seated.playerId)).toEqual([
      'human',
      'bot-electricEyrie',
    ])

    game.start()
    finishSetup(game)

    const [human, bot] = game.state.players
    expect(human!.hand).toHaveLength(3)
    expect(bot!.hand).toHaveLength(0)
    const everyCard = [...game.state.deck.draw, ...game.state.deck.discard, ...human!.hand]
    expect(everyCard.some((card) => defOf(card).type === 'dominance')).toBe(false)
    expect(warriors(game.state, FALL.opposite(FALL.corners[0]), 1)).toBe(6)
  })

  it('seats a bot in the first seat at create and sets up the Mechanical Marquise first', () => {
    const game = Game.create({ seed: 3, factions: ['mechanicalMarquise', 'eyrie'] })
    expect(game.state.players.map((seated) => seated.faction)).toEqual(['mechanicalMarquise'])
    game.join('human')
    game.start()
    finishSetup(game)

    const keep = keepClearingFor(game.state, 0)
    expect(keep).not.toBeNull()
    expect(warriors(game.state, FALL.opposite(keep!), 1)).toBe(6)
  })
})
