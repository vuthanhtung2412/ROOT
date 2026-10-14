import { describe, expect, it } from 'vitest'
import type { GameState } from '#api/client.ts'
import { makeActionSpec, makeGameState } from '#test/factories.ts'
import {
  decreeColumnViews,
  decreeTally,
  isDecreeStep,
  nextResolvableDecreeSpec,
  type DecreeCardMark,
} from '#ui/decreeColumns.ts'

const EYRIE_SEAT = 1
const RECRUIT_CARD_ID = 'VIZIER#1'
const FIRST_MOVE_CARD_ID = 'ROOT-205#1'
const SECOND_MOVE_CARD_ID = 'VIZIER#2'
const BATTLE_CARD_ID = 'ROOT-218#1'

/** Eyrie Daylight: recruit resolved, one of two move cards resolved. */
function makeEyrieDecreeState(overrides: Partial<GameState> = {}): GameState {
  return makeGameState({
    phase: 'daylight',
    step: 'decree',
    currentSeat: EYRIE_SEAT,
    players: [
      { playerId: 'marquise', seat: 0, faction: 'marquise', vp: 0, hand: [] },
      {
        playerId: 'eyrie',
        seat: EYRIE_SEAT,
        faction: 'eyrie',
        vp: 0,
        hand: [],
        board: {
          kind: 'eyrie',
          decree: {
            recruit: [{ id: RECRUIT_CARD_ID, defId: 'VIZIER' }],
            move: [
              { id: FIRST_MOVE_CARD_ID, defId: 'ROOT-205' },
              { id: SECOND_MOVE_CARD_ID, defId: 'VIZIER' },
            ],
            battle: [{ id: BATTLE_CARD_ID, defId: 'ROOT-218' }],
            build: [],
          },
        },
      },
    ],
    turnScratch: {
      decree: { column: 'move', remaining: [SECOND_MOVE_CARD_ID] },
      decreeDone: false,
    },
    ...overrides,
  })
}

describe('decreeColumnViews', () => {
  it('is null for a seat that is not the Eyrie', () => {
    expect(decreeColumnViews(makeEyrieDecreeState(), 0, [])).toBeNull()
  })

  it('is null outside Daylight', () => {
    const birdsong = makeEyrieDecreeState({ phase: 'birdsong' })

    expect(decreeColumnViews(birdsong, EYRIE_SEAT, [])).toBeNull()
  })

  it('orders the columns and tells resolved, current and later apart', () => {
    const columns = decreeColumnViews(makeEyrieDecreeState(), EYRIE_SEAT, [])

    expect(columns?.map((view) => [view.column, view.state])).toEqual([
      ['recruit', 'done'],
      ['move', 'now'],
      ['battle', 'later'],
      ['build', 'later'],
    ])
  })

  it('marks resolved the cards the current column no longer waits for', () => {
    const columns = decreeColumnViews(makeEyrieDecreeState(), EYRIE_SEAT, [])
    const moveCards = columns?.[1]?.cards ?? []

    expect(moveCards.map((card) => [card.cardId, card.isResolved])).toEqual([
      [FIRST_MOVE_CARD_ID, true],
      [SECOND_MOVE_CARD_ID, false],
    ])
  })

  it('gives a card the legal action that resolves it', () => {
    const moveWithVizier = makeActionSpec({
      type: 'decree',
      actor: EYRIE_SEAT,
      params: { column: ['move'], cardIds: [SECOND_MOVE_CARD_ID] },
    })

    const columns = decreeColumnViews(makeEyrieDecreeState(), EYRIE_SEAT, [
      moveWithVizier,
    ])

    expect(columns?.[1]?.cards[1]?.spec).toBe(moveWithVizier)
    expect(columns?.[2]?.cards[0]?.spec).toBeNull()
  })

  it('reads every column as done once the Decree is resolved', () => {
    const resolved = makeEyrieDecreeState({
      turnScratch: { decree: null, decreeDone: true },
    })

    const columns = decreeColumnViews(resolved, EYRIE_SEAT, [])

    expect(columns?.every((view) => view.state === 'done')).toBe(true)
  })
})

describe('isDecreeStep', () => {
  it('is true in the Daylight step that resolves the Decree', () => {
    expect(isDecreeStep(makeEyrieDecreeState())).toBe(true)
  })

  it('is false in the Daylight craft step: the columns show, disabled', () => {
    const craftStep = makeEyrieDecreeState({ step: 'craft' })

    expect(isDecreeStep(craftStep)).toBe(false)
    expect(decreeColumnViews(craftStep, EYRIE_SEAT, [])).not.toBeNull()
  })
})

describe('decreeTally', () => {
  it('counts the resolved cards over the whole Decree', () => {
    const columns = decreeColumnViews(makeEyrieDecreeState(), EYRIE_SEAT, [])

    expect(decreeTally(columns ?? [])).toBe('2/4')
  })
})

describe('nextResolvableDecreeSpec', () => {
  const birdSpec = makeActionSpec({
    type: 'decree',
    params: { column: ['recruit'], cardIds: ['bird'] },
  })
  const foxSpec = makeActionSpec({
    type: 'decree',
    params: { column: ['recruit'], cardIds: ['fox'] },
  })

  it('prefers a non-bird card over a bird', () => {
    const cards: readonly DecreeCardMark[] = [
      {
        cardId: 'bird',
        suit: 'bird',
        isResolved: false,
        spec: birdSpec,
      },
      {
        cardId: 'fox',
        suit: 'fox',
        isResolved: false,
        spec: foxSpec,
      },
    ]

    expect(nextResolvableDecreeSpec(cards)).toBe(foxSpec)
  })

  it('falls back to a bird when no non-bird remains', () => {
    const cards: readonly DecreeCardMark[] = [
      {
        cardId: 'bird',
        suit: 'bird',
        isResolved: false,
        spec: birdSpec,
      },
      {
        cardId: 'fox',
        suit: 'fox',
        isResolved: true,
        spec: null,
      },
    ]

    expect(nextResolvableDecreeSpec(cards)).toBe(birdSpec)
  })
})
