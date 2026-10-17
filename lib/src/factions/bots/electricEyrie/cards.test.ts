import { beforeEach, describe, expect, it } from 'vitest'
import type { Card } from '#cards/types.js'
import { electricEyrieBoardOf } from '#factions/bots/botBoards.js'
import { relentless, swoop } from '#factions/bots/electricEyrie/cards.js'
import { decreeBattle, decreeRecruit } from '#factions/bots/electricEyrie/decree.js'
import { turmoil } from '#factions/bots/electricEyrie/roosts.js'
import { placeElectricEyrieSetup } from '#factions/bots/electricEyrie/setup.js'
import { ELECTRIC_EYRIE } from '#factions/bots/ElectricEyrie.js'
import { isVizier, makeViziers } from '#factions/eyrie/viziers.js'
import type { ClearingId } from '#map/types.js'
import type { Piece, Seat } from '#pieces/types.js'
import type { BotSettings } from '#public/botSettings.js'
import { warriors } from '#queries/pieces.js'
import { resetPlaceIds } from '#rules/place.js'
import { removePieces } from '#rules/remove.js'
import { createElectricEyrieBoard } from '#state/botBoards.js'
import type { GameState } from '#state/types.js'
import { card, createTestRng, minimalState, player, testContext } from '#test/fixtures.js'

const BOT: Seat = 0
const MARQUISE: Seat = 1
const BIRD_AMBUSH = 'ROOT-200'
const FOX_ITEM = 'ROOT-204'
const ROOST_CLEARING: ClearingId = 0
const FOX_CLEARING: ClearingId = 5
const OTHER_CLEARING: ClearingId = 6
/** Clearing 1 has the highest priority after the roost clearing 0. */
const SECOND_PRIORITY_CLEARING: ClearingId = 1

let nextPieceNumber = 0

function birds(count: number): Piece[] {
  return Array.from({ length: count }, (): Piece => {
    nextPieceNumber += 1
    return { id: `bird-${nextPieceNumber}`, kind: 'warrior', owner: BOT }
  })
}

function catWarrior(): Piece {
  nextPieceNumber += 1
  return { id: `cat-${nextPieceNumber}`, kind: 'warrior', owner: MARQUISE }
}

function sawmill(): Piece {
  nextPieceNumber += 1
  return { id: `sawmill-${nextPieceNumber}`, kind: 'building', type: 'sawmill', owner: MARQUISE }
}

const ROOST: Piece = { id: 'roost', kind: 'building', type: 'roost', owner: BOT, used: false }

type BotGame = {
  settings: BotSettings
  decree?: Partial<Record<'fox' | 'mouse' | 'rabbit' | 'bird', Card[]>>
  clearings?: Partial<Record<ClearingId, Piece[]>>
}

function botState(game: BotGame): GameState {
  const state = minimalState({
    currentSeat: BOT,
    phase: 'daylight',
    step: 'decree',
    factions: ['electricEyrie', 'marquise'],
    botSettings: { electricEyrie: game.settings },
    players: [
      player(BOT, 'electricEyrie', {
        board: {
          ...createElectricEyrieBoard(),
          roostTrack: { placed: 5 },
          decree: { fox: [], mouse: [], rabbit: [], bird: makeViziers(), ...game.decree },
        },
      }),
      player(MARQUISE, 'marquise'),
    ],
  })
  for (const [clearing, pieces] of Object.entries(game.clearings ?? {})) {
    state.clearings[Number(clearing)]!.pieces = [...(pieces ?? [])]
  }
  return state
}

function setUp(settings: BotSettings): Card[] {
  const state = botState({ settings })
  state.status = 'setup'
  state.deck.draw = [card(FOX_ITEM), card(BIRD_AMBUSH)]
  placeElectricEyrieSetup(state, BOT, createTestRng([0]))
  return electricEyrieBoardOf(state, BOT).decree.bird
}

beforeEach(() => {
  resetPlaceIds()
  nextPieceNumber = 0
})

describe('Electric Eyrie difficulty (Rootbotics 3.3.1)', () => {
  it('Easy — places only one Loyal Vizier in the bird column', () => {
    expect(setUp({ difficulty: 'easy', traits: [] }).filter(isVizier)).toHaveLength(1)
  })

  it('Challenging — a bird ambush from the deck joins the bird column', () => {
    const bird = setUp({ difficulty: 'challenging', traits: [] })
    expect(bird.filter(isVizier)).toHaveLength(2)
    expect(bird.map((decreeCard: Card): string => decreeCard.defId)).toContain(BIRD_AMBUSH)
  })

  it('Nightmare — scores 1 VP at the end of Evening', () => {
    const state = botState({ settings: { difficulty: 'nightmare', traits: [] } })
    state.phase = 'evening'
    state.step = 'score'
    const ctx = testContext({ state })
    ELECTRIC_EYRIE.apply(state, { type: 'botStep' }, ctx)
    ELECTRIC_EYRIE.apply(state, { type: 'botStep' }, ctx)
    expect(state.players[BOT]!.vp).toBe(1)
  })
})

describe('Electric Eyrie traits (Rootbotics 3.3.2)', () => {
  it('Focused — deals the extra hit when its column ties for the most cards', () => {
    const state = botState({
      settings: { difficulty: 'default', traits: ['focused'] },
      decree: { fox: [card(FOX_ITEM), card(FOX_ITEM, 2)] },
      clearings: { [FOX_CLEARING]: [...birds(3), catWarrior()] },
    })
    // Both dice roll 0: only the extra hit lands.
    decreeBattle(state, 'fox', testContext({ state, dice: [0, 0] }))
    expect(warriors(state, FOX_CLEARING, MARQUISE)).toBe(0)
  })

  it('Nobility — a Decree recruit short of warriors brings turmoil, which scores a point per bird card', () => {
    const state = botState({
      settings: { difficulty: 'default', traits: ['nobility'] },
      clearings: { [ROOST_CLEARING]: [ROOST] },
    })
    electricEyrieBoardOf(state, BOT).supply.warriors = 1
    const recruited = decreeRecruit(state, 'bird')
    expect(recruited.followUps).toEqual([{ kind: 'turmoil' }])
    turmoil(state, BOT, testContext({ state }))
    expect(state.players[BOT]!.vp).toBe(2)
    expect(electricEyrieBoardOf(state, BOT).decree.bird.filter(isVizier)).toHaveLength(2)
  })

  it('Relentless — removes defenseless enemy buildings where it has warriors', () => {
    const defenseless = sawmill()
    const defended = sawmill()
    const state = botState({
      settings: { difficulty: 'default', traits: ['relentless'] },
      clearings: {
        [FOX_CLEARING]: [...birds(1), defenseless],
        [OTHER_CLEARING]: [...birds(1), defended, catWarrior()],
      },
    })
    relentless(state, BOT, testContext({ state }))
    expect(state.clearings[FOX_CLEARING]!.pieces.map((piece: Piece): string => piece.id)).not.toContain(
      defenseless.id,
    )
    expect(state.clearings[OTHER_CLEARING]!.pieces).toContainEqual(defended)
    expect(state.players[BOT]!.vp).toBe(1)
  })

  it('Swoop — two warriors in the highest-priority clearing with no Eyrie piece', () => {
    const state = botState({
      settings: { difficulty: 'default', traits: ['swoop'] },
      clearings: { [ROOST_CLEARING]: [ROOST] },
    })
    swoop(state, BOT)
    expect(warriors(state, SECOND_PRIORITY_CLEARING, BOT)).toBe(2)
  })

  it('War Tax — each building it destroys costs the owner 1 VP', () => {
    const building = sawmill()
    const state = botState({
      settings: { difficulty: 'default', traits: ['warTax'] },
      clearings: { [FOX_CLEARING]: [...birds(1), building] },
    })
    state.players[MARQUISE]!.vp = 3
    removePieces(
      state,
      { clearing: FOX_CLEARING, pieceIds: [building.id], scorer: BOT },
      testContext({ state }),
    )
    expect(state.players[MARQUISE]!.vp).toBe(2)
    expect(state.players[BOT]!.vp).toBe(1)
  })
})
