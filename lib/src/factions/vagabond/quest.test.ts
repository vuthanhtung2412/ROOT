import { describe, expect, it, beforeEach } from 'vitest'
import { questDefOf } from '#cards/quests.js'
import { VAGABOND } from '#factions/Vagabond.js'
import { boardOf, placeItemInSatchelOrTrack } from '#factions/vagabond/items.js'
import { FALL } from '#map/fall.js'
import { resetPlaceIds } from '#rules/place.js'
import { SeededRng } from '#rules/Rng.js'
import {
  minimalState,
  player,
  testContext,
  withPieces,
} from '#test/fixtures.js'

function foxClearing(): number {
  const clearing = FALL.clearings.find((entry) => entry.suit === 'fox')
  if (clearing === undefined) throw new Error('no fox clearing')
  return clearing.id
}

describe('Vagabond quest action', () => {
  beforeEach(() => resetPlaceIds())

  it('Rule: Vagabond > Quest 9.5.5 — exhaust items, score VP by suit, replace', () => {
    const clearing = foxClearing()
    let state = minimalState({
      factions: ['marquise', 'vagabond'],
      players: [player(0, 'marquise'), player(1, 'vagabond')],
      currentSeat: 1,
      phase: 'daylight',
      step: 'actions',
    })
    const context = testContext({
      state,
      rng: new SeededRng({ seed: 2, cursor: 0 }),
    })
    VAGABOND.setup(state, 1, context)
    const board = boardOf(state, 1)
    board.forest = null
    // Fundraising = coin + tea (fox).
    placeItemInSatchelOrTrack(board, 'coin')
    // Tea already from Thief start on track.
    const fundraising = state.questsAvailable.find(
      (quest) => questDefOf(quest).name === 'Fundraising',
    )
    // Ensure Fundraising is face-up for the test.
    if (fundraising === undefined) {
      const fromDeck = state.questDeck.find(
        (quest) => questDefOf(quest).name === 'Fundraising',
      )
      expect(fromDeck).toBeDefined()
      state.questsAvailable = [fromDeck!, ...state.questsAvailable.slice(0, 2)]
      state.questDeck = state.questDeck.filter((quest) => quest.id !== fromDeck!.id)
    }
    const questId =
      state.questsAvailable.find((quest) => questDefOf(quest).name === 'Fundraising')
        ?.id ?? ''
    expect(questId).not.toBe('')

    state = withPieces(state, clearing, [
      { id: 'pawn-1', kind: 'pawn', owner: 1 },
    ])
    const deckBefore = state.questDeck.length
    const vpBefore = state.players[1]!.vp

    VAGABOND.apply(
      state,
      { type: 'quest', questId, reward: 'vp' },
      testContext({ state }),
    )

    expect(board.completedQuests).toHaveLength(1)
    expect(questDefOf(board.completedQuests[0]!).name).toBe('Fundraising')
    expect(state.players[1]!.vp).toBe(vpBefore + 1)
    expect(state.questsAvailable).toHaveLength(3)
    expect(state.questDeck).toHaveLength(deckBefore - 1)
    expect(
      [...board.satchel, ...board.tracks.tea, ...board.tracks.coin].filter(
        (item) =>
          (item.type === 'coin' || item.type === 'tea') && item.exhausted,
      ).length,
    ).toBeGreaterThanOrEqual(2)
  })

  it('Rule: Vagabond > Quest — draw-2 reward instead of VP', () => {
    const clearing = foxClearing()
    let state = minimalState({
      factions: ['marquise', 'vagabond'],
      players: [player(0, 'marquise'), player(1, 'vagabond')],
      currentSeat: 1,
      phase: 'daylight',
      step: 'actions',
      deck: {
        draw: [
          { id: 'ROOT-1#1', defId: 'ROOT-1' },
          { id: 'ROOT-2#1', defId: 'ROOT-2' },
          { id: 'ROOT-3#1', defId: 'ROOT-3' },
        ],
        discard: [],
      },
    })
    VAGABOND.setup(
      state,
      1,
      testContext({ state, rng: new SeededRng({ seed: 3, cursor: 0 }) }),
    )
    const board = boardOf(state, 1)
    board.forest = null
    placeItemInSatchelOrTrack(board, 'coin')
    const fromDeck = state.questDeck.find(
      (quest) => questDefOf(quest).name === 'Fundraising',
    )
    const faceUp = state.questsAvailable.find(
      (quest) => questDefOf(quest).name === 'Fundraising',
    )
    const quest = faceUp ?? fromDeck
    expect(quest).toBeDefined()
    if (quest === undefined) return
    if (faceUp === undefined) {
      state.questsAvailable = [quest, ...state.questsAvailable.slice(0, 2)]
      state.questDeck = state.questDeck.filter((entry) => entry.id !== quest.id)
    }
    state = withPieces(state, clearing, [
      { id: 'pawn-1', kind: 'pawn', owner: 1 },
    ])
    const handBefore = state.players[1]!.hand.length
    const vpBefore = state.players[1]!.vp

    VAGABOND.apply(
      state,
      { type: 'quest', questId: quest.id, reward: 'draw' },
      testContext({ state }),
    )

    expect(state.players[1]!.hand.length).toBe(handBefore + 2)
    expect(state.players[1]!.vp).toBe(vpBefore)
  })
})
