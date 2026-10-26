import { beforeEach, describe, expect, it } from 'vitest'
import { QUEST_DECK, type QuestCard } from '#cards/quests.js'
import { vagabotBoardOf } from '#factions/bots/botBoards.js'
import { adventurerQuests, aid } from '#factions/bots/vagabot/actions.js'
import { battle } from '#factions/bots/vagabot/battleAction.js'
import { aidSettings, questVictoryPoints, refreshBonus } from '#factions/bots/vagabot/cards.js'
import { battleTrackSlots, damageItems, maximumRolledHits } from '#factions/bots/vagabot/items.js'
import { placePawnInClearing, vagabotClearing } from '#factions/bots/vagabot/pawn.js'
import { daylightTasks, refresh } from '#factions/bots/vagabot/turn.js'
import type { ClearingId } from '#map/types.js'
import type { Piece, Seat } from '#pieces/types.js'
import type { BotDifficulty, VagabotTrait } from '#public/botSettings.js'
import { warriors } from '#queries/pieces.js'
import { resetPlaceIds } from '#rules/place.js'
import { createVagabotBoard, type VagabotItem } from '#state/botBoards.js'
import type { GameState } from '#state/types.js'
import { card, minimalState, player, testContext } from '#test/fixtures.js'

const VAGABOT: Seat = 0
const MARQUISE: Seat = 1
const EYRIE: Seat = 2
/** Fall: 0 (fox) borders 4 (rabbit), 8 and 9 (rabbit). */
const START: ClearingId = 0
const RABBIT_NEXT_TO_START: ClearingId = 4
const OTHER_NEIGHBOUR: ClearingId = 8
const FAR_CLEARING: ClearingId = 2
const FOX_ORDER = 'ROOT-204'
const RABBIT_QUEST: QuestCard = QUEST_DECK.find(
  (entry: QuestCard): boolean => entry.defId === 'QUEST-R-ERRAND',
)!

function items(count: number, overrides: Partial<VagabotItem> = {}): VagabotItem[] {
  return Array.from({ length: count }, (): VagabotItem => ({
    type: 'boot',
    exhausted: false,
    damaged: false,
    onBattleTrack: false,
    ...overrides,
  }))
}

function warriorsOf(owner: Seat, count: number, prefix: string): Piece[] {
  return Array.from({ length: count }, (_: unknown, index: number): Piece => ({
    id: `${prefix}-${index}`,
    kind: 'warrior',
    owner,
  }))
}

function vagabotState(settings: {
  items: VagabotItem[]
  traits?: VagabotTrait[]
  difficulty?: BotDifficulty
}): GameState {
  const traits = settings.traits ?? []
  const state = minimalState({
    currentSeat: VAGABOT,
    phase: 'daylight',
    step: 'actions',
    factions: ['vagabot', 'marquise', 'eyrie'],
    players: [
      player(VAGABOT, 'vagabot', {
        board: {
          ...createVagabotBoard(),
          items: settings.items,
          quest: RABBIT_QUEST,
          orderCard: card(FOX_ORDER),
          questingBattleTrack: traits.includes('questing'),
        },
      }),
      player(MARQUISE, 'marquise'),
      player(EYRIE, 'eyrie'),
    ],
    questDeck: [...QUEST_DECK],
    botSettings: { vagabot: { difficulty: settings.difficulty ?? 'default', traits } },
  })
  placePawnInClearing(state, VAGABOT, START)
  return state
}

beforeEach(() => {
  resetPlaceIds()
})

describe('Vagabot difficulty', () => {
  it('Easy refreshes one less, Challenging and Nightmare one more', () => {
    const exhausted = items(8, { exhausted: true })
    const easy = vagabotState({ items: exhausted.map((item) => ({ ...item })), difficulty: 'easy' })
    refresh(easy, { seat: VAGABOT, difficultyBonus: refreshBonus(easy, VAGABOT) })
    expect(vagabotBoardOf(easy, VAGABOT).items.filter((item) => !item.exhausted)).toHaveLength(5)

    const nightmare = vagabotState({ items: exhausted.map((item) => ({ ...item })), difficulty: 'nightmare' })
    refresh(nightmare, { seat: VAGABOT, difficultyBonus: refreshBonus(nightmare, VAGABOT) })
    expect(vagabotBoardOf(nightmare, VAGABOT).items.filter((item) => !item.exhausted)).toHaveLength(7)
  })
})

describe('Vagabot traits', () => {
  it('Questing: damaged items count, the track never empties, quests score two, new actions', () => {
    const state = vagabotState({ items: items(6), traits: ['questing'] })
    const board = vagabotBoardOf(state, VAGABOT)
    damageItems(board, 6)
    expect(battleTrackSlots(board)).toBe(1)
    expect(maximumRolledHits(board)).toBe(2)
    expect(questVictoryPoints(state, VAGABOT)).toBe(2)
    expect(daylightTasks(state, VAGABOT)).toEqual([
      { kind: 'explore' },
      { kind: 'special' },
      { kind: 'battleTarget' },
    ])
  })

  it('Questing: Aid moves to the nearest player with crafted items', () => {
    const state = vagabotState({ items: items(4), traits: ['questing'] })
    state.clearings[RABBIT_NEXT_TO_START]!.pieces.push(...warriorsOf(MARQUISE, 1, 'cat'))
    state.players[MARQUISE]!.craftedItems = [{ type: 'sword', exhausted: false }]
    state.deck.draw = [card('ROOT-206')]
    aid(state, { seat: VAGABOT, ...aidSettings(state, VAGABOT) }, testContext({ state }))

    expect(vagabotClearing(state, VAGABOT)).toBe(RABBIT_NEXT_TO_START)
    expect(state.players[MARQUISE]!.craftedItems).toEqual([])
  })

  it('Helper: one more point and two cards per item', () => {
    const state = vagabotState({ items: items(4), traits: ['helper'] })
    state.clearings[START]!.pieces.push(...warriorsOf(MARQUISE, 1, 'cat'))
    state.players[MARQUISE]!.craftedItems = [{ type: 'sword', exhausted: false }]
    state.deck.draw = [card('ROOT-206'), card('ROOT-207')]
    aid(state, { seat: VAGABOT, ...aidSettings(state, VAGABOT) }, testContext({ state }))

    expect(state.players[VAGABOT]!.vp).toBe(2)
    expect(state.players[MARQUISE]!.hand).toHaveLength(2)
  })

  it('Adventurer: battles once; quests again while it can', () => {
    const state = vagabotState({ items: items(5), traits: ['adventurer'] })
    state.clearings[START]!.pieces.push({ id: 'sawmill', kind: 'building', type: 'sawmill', owner: MARQUISE })
    const result = battle(state, VAGABOT, testContext({ state, dice: [0, 0] }))
    expect(result.followUps).toEqual([])
    expect(daylightTasks(state, VAGABOT).at(-1)).toEqual({ kind: 'adventurerQuests' })

    const questing = adventurerQuests(state, { seat: VAGABOT, points: 1 }, testContext({ state }))
    expect(questing.followUps).toEqual([{ kind: 'adventurerQuests' }])
  })

  it('Berserker: the clearing with the most enemy pieces, the player with the most there', () => {
    const state = vagabotState({ items: items(5), traits: ['berserker'] })
    state.players[EYRIE]!.vp = 9
    state.clearings[OTHER_NEIGHBOUR]!.pieces.push(...warriorsOf(EYRIE, 1, 'bird'))
    state.clearings[RABBIT_NEXT_TO_START]!.pieces.push(
      ...warriorsOf(MARQUISE, 2, 'cat'),
      ...warriorsOf(EYRIE, 1, 'other-bird'),
    )
    const result = battle(state, VAGABOT, testContext({ state, dice: [0, 0] }))

    expect(vagabotClearing(state, VAGABOT)).toBe(RABBIT_NEXT_TO_START)
    expect(result.logs).toContainEqual({
      t: 'action',
      actor: VAGABOT,
      action: { type: 'botBattle', clearing: RABBIT_NEXT_TO_START, defender: MARQUISE },
    })
  })

  it('Marksman: an immediate hit removes a defender warrior for a point', () => {
    const state = vagabotState({ items: items(5), traits: ['marksman'] })
    state.players[MARQUISE]!.vp = 3
    state.clearings[START]!.pieces.push(...warriorsOf(MARQUISE, 2, 'cat'))
    battle(state, VAGABOT, testContext({ state, dice: [0, 0] }))

    expect(warriors(state, START, MARQUISE)).toBe(1)
    expect(state.players[VAGABOT]!.vp).toBe(1)
  })

  it('a far clearing still counts for Berserker', () => {
    const state = vagabotState({ items: items(6), traits: ['berserker'] })
    state.clearings[FAR_CLEARING]!.pieces.push(...warriorsOf(MARQUISE, 3, 'cat'))
    state.clearings[OTHER_NEIGHBOUR]!.pieces.push(...warriorsOf(MARQUISE, 1, 'near-cat'))
    battle(state, VAGABOT, testContext({ state, dice: [0, 0] }))

    expect(vagabotClearing(state, VAGABOT)).toBe(FAR_CLEARING)
  })
})
