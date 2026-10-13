import { describe, expect, it } from 'vitest'
import type { GameState } from '#api/client.ts'
import type { AddToDecreeDraft } from '#game/eyrieActionComposerModels.ts'
import { makeGameState } from '#test/factories.ts'
import {
  decreePanelView,
  isDecreeColumnOfferedFor,
  type DecreePanelView,
} from '#ui/decreePanel.ts'

const EYRIE_SEAT = 1
const MARQUISE_SEAT = 0
const MOUSE_CARD_ID = 'ROOT-218#1'
const MOUSE_CARD_DEF_ID = 'ROOT-218'
const SECOND_MOUSE_CARD_ID = 'ROOT-218#2'
const DECREE_COLUMNS: readonly string[] = ['recruit', 'move', 'battle', 'build']

/** Eyrie Birdsong: two Loyal Viziers and a mouse card in the Decree, two mouse cards in hand. */
function makeAddToDecreeState(): GameState {
  return makeGameState({
    phase: 'birdsong',
    step: 'decreeAdd',
    currentSeat: EYRIE_SEAT,
    players: [
      { playerId: 'marquise', seat: MARQUISE_SEAT, faction: 'marquise', vp: 0, hand: [] },
      {
        playerId: 'eyrie',
        seat: EYRIE_SEAT,
        faction: 'eyrie',
        vp: 0,
        hand: [
          { id: MOUSE_CARD_ID, defId: MOUSE_CARD_DEF_ID },
          { id: SECOND_MOUSE_CARD_ID, defId: MOUSE_CARD_DEF_ID },
        ],
        board: {
          kind: 'eyrie',
          decree: {
            recruit: [],
            move: [
              { id: 'VIZIER#1', defId: 'VIZIER' },
              { id: 'VIZIER#2', defId: 'VIZIER' },
              { id: 'ROOT-218#9', defId: MOUSE_CARD_DEF_ID },
            ],
            battle: [],
            build: [],
          },
        },
      },
    ],
  })
}

function makeAddToDecreeDraft(
  overrides: Partial<AddToDecreeDraft> = {},
): AddToDecreeDraft {
  return {
    type: 'addToDecree',
    options: [MOUSE_CARD_ID, SECOND_MOUSE_CARD_ID].flatMap((cardId) =>
      DECREE_COLUMNS.map((column) => ({ cardId, column })),
    ),
    birdCardIds: new Set(),
    selected: [],
    pendingCardId: null,
    ...overrides,
  }
}

function makePanelView(overrides: Partial<AddToDecreeDraft> = {}): DecreePanelView {
  const view: DecreePanelView | null = decreePanelView(
    makeAddToDecreeState(),
    EYRIE_SEAT,
    makeAddToDecreeDraft(overrides),
  )
  if (view === null) {
    throw new Error('expected a Decree panel for the Eyrie')
  }
  return view
}

describe('decreePanelView', () => {
  it('is null for a seat that is not the Eyrie', () => {
    expect(
      decreePanelView(
        makeAddToDecreeState(),
        MARQUISE_SEAT,
        makeAddToDecreeDraft(),
      ),
    ).toBeNull()
  })

  it('lists the four columns in Decree order', () => {
    expect(makePanelView().columns.map((column) => column.column)).toEqual(
      DECREE_COLUMNS,
    )
  })

  it('counts the cards already in a column by suit, Loyal Viziers as birds', () => {
    const moveColumn = makePanelView().columns.find(
      (column) => column.column === 'move',
    )

    expect(moveColumn?.marks).toEqual([
      { suit: 'bird', count: 2 },
      { suit: 'mouse', count: 1 },
    ])
  })

  it('shows a staged card in its column', () => {
    const view = makePanelView({
      selected: [{ cardId: MOUSE_CARD_ID, column: 'battle' }],
    })

    expect(
      view.columns.find((column) => column.column === 'battle')?.staged,
    ).toEqual([{ cardId: MOUSE_CARD_ID, defId: MOUSE_CARD_DEF_ID }])
    expect(view.stagedCardIds).toEqual([MOUSE_CARD_ID])
  })

  it('cannot be confirmed or taken back while nothing is staged or picked', () => {
    const view = makePanelView()

    expect(view.canConfirm).toBe(false)
    expect(view.canTakeBack).toBe(false)
  })

  it('can be taken back, not confirmed, with only a card picked', () => {
    const view = makePanelView({ pendingCardId: MOUSE_CARD_ID })

    expect(view.pickedCardId).toBe(MOUSE_CARD_ID)
    expect(view.canConfirm).toBe(false)
    expect(view.canTakeBack).toBe(true)
  })

  it('can be confirmed once a card is staged', () => {
    const view = makePanelView({
      selected: [{ cardId: MOUSE_CARD_ID, column: 'battle' }],
    })

    expect(view.canConfirm).toBe(true)
  })
})

describe('isDecreeColumnOfferedFor', () => {
  it('offers a column the server lists for a hand card', () => {
    expect(
      isDecreeColumnOfferedFor(makePanelView(), {
        cardId: MOUSE_CARD_ID,
        column: 'build',
      }),
    ).toBe(true)
  })

  it('does not offer a column the server does not list', () => {
    const view = makePanelView({
      options: [{ cardId: MOUSE_CARD_ID, column: 'recruit' }],
    })

    expect(
      isDecreeColumnOfferedFor(view, { cardId: MOUSE_CARD_ID, column: 'build' }),
    ).toBe(false)
  })

  it('lets a staged card move to another column', () => {
    const view = makePanelView({
      selected: [{ cardId: MOUSE_CARD_ID, column: 'recruit' }],
    })

    expect(
      isDecreeColumnOfferedFor(view, { cardId: MOUSE_CARD_ID, column: 'build' }),
    ).toBe(true)
  })
})
