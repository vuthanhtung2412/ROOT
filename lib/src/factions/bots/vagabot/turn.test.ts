import { beforeEach, describe, expect, it } from 'vitest'
import { QUEST_DECK, type QuestCard } from '#cards/quests.js'
import { vagabotBoardOf } from '#factions/bots/botBoards.js'
import { aid, explore, quest, repair } from '#factions/bots/vagabot/actions.js'
import { battle, battleAgain } from '#factions/bots/vagabot/battleAction.js'
import { special } from '#factions/bots/vagabot/characters.js'
import {
  placePawnInClearing,
  placePawnInForest,
  vagabotClearing,
} from '#factions/bots/vagabot/pawn.js'
import { daylightTasks, eveningRepair, refresh, slip } from '#factions/bots/vagabot/turn.js'
import type { ClearingId } from '#map/types.js'
import type { Piece, Seat } from '#pieces/types.js'
import type { VagabotCharacter } from '#public/botSettings.js'
import { resetPlaceIds } from '#rules/place.js'
import { createVagabotBoard, type VagabotItem } from '#state/botBoards.js'
import type { GameState } from '#state/types.js'
import { card, minimalState, player, testContext } from '#test/fixtures.js'

const VAGABOT: Seat = 0
const MARQUISE: Seat = 1
const EYRIE: Seat = 2
/** Fall: 0 (fox) borders 4, 8, 9; 9 holds a ruin; 4 and 9 are rabbit. */
const START: ClearingId = 0
const RUIN: ClearingId = 9
const RABBIT_NEXT_TO_START: ClearingId = 4
const OTHER_NEIGHBOUR: ClearingId = 8
/** Forest F1 borders 0, 8, 9 and 11. */
const FOREST_NEXT_TO_START = 0
const FOX_ORDER = 'ROOT-204'
const MOUSE_ORDER = 'ROOT-210'
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

function cats(count: number): Piece[] {
  return Array.from({ length: count }, (_: unknown, index: number): Piece => ({
    id: `cat-${index}`,
    kind: 'warrior',
    owner: MARQUISE,
  }))
}

function vagabotState(options: {
  items: VagabotItem[]
  order?: string
  character?: VagabotCharacter
}): GameState {
  const state = minimalState({
    currentSeat: VAGABOT,
    phase: 'daylight',
    step: 'actions',
    factions: ['vagabot', 'marquise', 'eyrie'],
    players: [
      player(VAGABOT, 'vagabot', {
        board: {
          ...createVagabotBoard(),
          character: options.character ?? 'thief',
          items: options.items,
          quest: RABBIT_QUEST,
          orderCard: card(options.order ?? FOX_ORDER),
        },
      }),
      player(MARQUISE, 'marquise'),
      player(EYRIE, 'eyrie'),
    ],
    questDeck: [QUEST_DECK[0]!],
  })
  placePawnInClearing(state, VAGABOT, START)
  return state
}

function exhaustedCount(state: GameState): number {
  return vagabotBoardOf(state, VAGABOT).items.filter(
    (item: VagabotItem): boolean => item.exhausted,
  ).length
}

beforeEach(() => {
  resetPlaceIds()
})

describe('Rootbotics 7.5 Daylight Actions', () => {
  it('the order suit sets the actions; none after a slip', () => {
    const state = vagabotState({ items: items(4), order: MOUSE_ORDER })
    expect(daylightTasks(state, VAGABOT)).toEqual([
      { kind: 'quest' },
      { kind: 'aid' },
      { kind: 'battleTarget' },
      { kind: 'repair' },
    ])
    state.turnScratch.botSlipped = true
    expect(daylightTasks(state, VAGABOT)).toEqual([])
  })

  it('7.4.3 two or fewer undamaged items: slip into an adjacent forest', () => {
    const state = vagabotState({ items: [...items(2), ...items(2, { damaged: true })] })
    slip(state, VAGABOT, testContext({ state, dice: [0] }))

    expect(vagabotBoardOf(state, VAGABOT).forest).toBe(FOREST_NEXT_TO_START)
    expect(vagabotClearing(state, VAGABOT)).toBeNull()
    expect(state.turnScratch.botSlipped).toBe(true)
  })

  it('7.5.1 Explore: one item per move, one to explore; the item joins the Satchel', () => {
    const state = vagabotState({ items: items(4) })
    state.clearings[RUIN]!.ruin = { items: ['bag'] }
    explore(state, VAGABOT, testContext({ state, dice: [0] }))

    expect(vagabotClearing(state, VAGABOT)).toBe(RUIN)
    expect(exhaustedCount(state)).toBe(2)
    expect(vagabotBoardOf(state, VAGABOT).items).toHaveLength(5)
    expect(state.clearings[RUIN]!.ruin).toBeUndefined()
    expect(state.players[VAGABOT]!.vp).toBe(0)
  })

  it('does not move when it cannot pay the whole trip', () => {
    const state = vagabotState({ items: [...items(4, { exhausted: true })] })
    state.clearings[RUIN]!.ruin = { items: ['bag'] }
    explore(state, VAGABOT, testContext({ state, dice: [0] }))

    expect(vagabotClearing(state, VAGABOT)).toBe(START)
  })

  it('from a forest the bordering clearings are one move away', () => {
    const state = vagabotState({ items: items(4) })
    placePawnInForest(state, VAGABOT, FOREST_NEXT_TO_START)
    state.clearings[RUIN]!.ruin = { items: ['bag'] }
    explore(state, VAGABOT, testContext({ state, dice: [0] }))

    expect(vagabotClearing(state, VAGABOT)).toBe(RUIN)
    expect(exhaustedCount(state)).toBe(2)
  })

  it('7.5.2 Quest: nearest clearing of the quest suit (priority on a tie), two items, a point, a new quest', () => {
    const state = vagabotState({ items: items(4) })
    quest(state, { seat: VAGABOT, points: 1 }, testContext({ state }))

    expect(vagabotClearing(state, VAGABOT)).toBe(RABBIT_NEXT_TO_START)
    expect(exhaustedCount(state)).toBe(3)
    expect(state.players[VAGABOT]!.vp).toBe(1)
    expect(vagabotBoardOf(state, VAGABOT).quest).toEqual(QUEST_DECK[0])
  })

  it('7.5.3 Aid: the player here with crafted items and the fewest points; it draws that many', () => {
    const state = vagabotState({ items: items(4) })
    state.deck.draw = [card('ROOT-206'), card('ROOT-207')]
    state.clearings[START]!.pieces.push(...cats(1), { id: 'bird', kind: 'warrior', owner: EYRIE })
    state.players[MARQUISE]!.vp = 3
    state.players[MARQUISE]!.craftedItems = [{ type: 'sword', exhausted: false }]
    state.players[EYRIE]!.craftedItems = [
      { type: 'hammer', exhausted: false },
      { type: 'tea', exhausted: false },
    ]
    aid(state, { seat: VAGABOT, bonusVictoryPoints: 0, cardsPerItem: 1 }, testContext({ state }))

    expect(state.players[EYRIE]!.craftedItems).toEqual([])
    expect(state.players[EYRIE]!.hand).toHaveLength(2)
    expect(state.players[VAGABOT]!.vp).toBe(2)
    expect(vagabotBoardOf(state, VAGABOT).items).toHaveLength(6)
  })

  it('7.5.4 Battle: the leader, nearest clearing with its most buildings and tokens; repeats for two items', () => {
    const state = vagabotState({ items: items(5) })
    state.players[MARQUISE]!.vp = 5
    state.clearings[RABBIT_NEXT_TO_START]!.pieces.push(...cats(1))
    state.clearings[OTHER_NEIGHBOUR]!.pieces.push({
      id: 'sawmill',
      kind: 'building',
      type: 'sawmill',
      owner: MARQUISE,
    })
    const context = testContext({ state, dice: [0, 0] })
    const result = battle(state, VAGABOT, context)

    expect(vagabotClearing(state, VAGABOT)).toBe(OTHER_NEIGHBOUR)
    expect(result.followUps).toEqual([
      { kind: 'battleAgain', clearing: OTHER_NEIGHBOUR, defender: MARQUISE },
    ])
    // Defenseless sawmill removed: one point, nothing of the Marquise left there.
    expect(state.players[VAGABOT]!.vp).toBe(1)
    expect(battleAgain(state, { seat: VAGABOT, clearing: OTHER_NEIGHBOUR, defender: MARQUISE }, context))
      .toEqual({ logs: [], followUps: [] })
  })

  it('7.5.5 Repair: one item to repair a face-up damaged item first', () => {
    const state = vagabotState({ items: [...items(2), ...items(1, { damaged: true })] })
    repair(state, VAGABOT)

    expect(vagabotBoardOf(state, VAGABOT).items.every((item: VagabotItem) => !item.damaged)).toBe(true)
    expect(exhaustedCount(state)).toBe(1)
  })
})

describe('Rootbotics 7.7 characters (Special)', () => {
  it('Thief steals a random card from the human here with the most points', () => {
    const state = vagabotState({ items: items(4) })
    state.clearings[START]!.pieces.push(...cats(1))
    state.players[MARQUISE]!.hand = [card('ROOT-206')]
    special(state, VAGABOT, testContext({ state, dice: [0] }))

    expect(state.players[MARQUISE]!.hand).toEqual([])
    expect(state.deck.discard).toEqual([card('ROOT-206')])
  })

  it('Tinker crafts the topmost discarded item card for one point', () => {
    const state = vagabotState({ items: items(3), character: 'tinker' })
    state.deck.discard = [card(FOX_ORDER), card('ROOT-210')]
    special(state, VAGABOT, testContext({ state }))

    expect(state.players[VAGABOT]!.vp).toBe(1)
    expect(vagabotBoardOf(state, VAGABOT).items).toHaveLength(4)
  })

  it('Ranger slips with three damaged items', () => {
    const state = vagabotState({
      items: [...items(2), ...items(3, { damaged: true })],
      character: 'ranger',
    })
    special(state, VAGABOT, testContext({ state, dice: [0] }))

    expect(vagabotBoardOf(state, VAGABOT).forest).toBe(FOREST_NEXT_TO_START)
  })
})

describe('Rootbotics 7.6 Evening', () => {
  it('refreshes four with a damaged item, six without', () => {
    const withDamage = vagabotState({
      items: [...items(6, { exhausted: true }), ...items(1, { damaged: true })],
    })
    refresh(withDamage, { seat: VAGABOT, difficultyBonus: 0 })
    expect(exhaustedCount(withDamage)).toBe(2)

    const undamaged = vagabotState({ items: items(7, { exhausted: true }) })
    refresh(undamaged, { seat: VAGABOT, difficultyBonus: 0 })
    expect(exhaustedCount(undamaged)).toBe(1)
  })

  it('repairs one item in a clearing, every item in a forest', () => {
    const state = vagabotState({ items: items(3, { damaged: true }) })
    eveningRepair(state, VAGABOT)
    expect(vagabotBoardOf(state, VAGABOT).items.filter((item) => item.damaged)).toHaveLength(2)

    placePawnInForest(state, VAGABOT, FOREST_NEXT_TO_START)
    eveningRepair(state, VAGABOT)
    expect(vagabotBoardOf(state, VAGABOT).items.filter((item) => item.damaged)).toHaveLength(0)
  })
})
