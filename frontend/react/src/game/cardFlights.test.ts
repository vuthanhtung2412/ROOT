import { describe, expect, it } from 'vitest'
import {
  boughtCardFlights,
  cardFlightsFromLog,
  type CardFlightState,
} from '#game/cardFlights.ts'

const CAT_SEAT = 0
const CULT_SEAT = 2
const CRAFTED_CARD_ID = 'ROOT-59'
const REVEALED_CARD_ID = 'ROOT-103'

function actionEntry(
  actor: number,
  action: Record<string, string | number>,
): Record<string, unknown> {
  return { t: 'action', actor, action }
}

describe('boughtCardFlights', () => {
  const RIVERFOLK_SEAT = 3
  const SOLD_CARD_ID = 'ROOT-72'
  const KEPT_CARD_ID = 'ROOT-80'

  function stateWithRiverfolkHand(cardIds: readonly string[]): CardFlightState {
    return {
      players: [
        { seat: CAT_SEAT, faction: 'marquise', hand: [] },
        {
          seat: RIVERFOLK_SEAT,
          faction: 'riverfolk',
          hand: cardIds.map((id: string): { id: string } => ({ id })),
        },
      ],
    }
  }

  const purchaseEntry: Record<string, unknown> = {
    t: 'event',
    event: { type: 'buyServices', buyer: CAT_SEAT, bought: 1 },
  }

  it('sends the card that left the Riverfolk hand to the buyer', () => {
    expect(
      boughtCardFlights(
        stateWithRiverfolkHand([SOLD_CARD_ID, KEPT_CARD_ID]),
        stateWithRiverfolkHand([KEPT_CARD_ID]),
        [purchaseEntry],
      ),
    ).toEqual([
      {
        seat: RIVERFOLK_SEAT,
        cardId: SOLD_CARD_ID,
        reason: 'buy',
        toSeat: CAT_SEAT,
      },
    ])
  })

  it('is empty for another service and for a card lost without a purchase', () => {
    const hand: readonly string[] = [SOLD_CARD_ID, KEPT_CARD_ID]
    expect(
      boughtCardFlights(
        stateWithRiverfolkHand(hand),
        stateWithRiverfolkHand(hand),
        [purchaseEntry],
      ),
    ).toEqual([])
    expect(
      boughtCardFlights(
        stateWithRiverfolkHand(hand),
        stateWithRiverfolkHand([KEPT_CARD_ID]),
        [actionEntry(RIVERFOLK_SEAT, { type: 'discard' })],
      ),
    ).toEqual([])
  })
})

describe('cardFlightsFromLog', () => {
  it('reads a crafted card and a ritual reveal, in log order', () => {
    expect(
      cardFlightsFromLog([
        actionEntry(CAT_SEAT, { type: 'craft', cardId: CRAFTED_CARD_ID }),
        { t: 'vp', actor: CAT_SEAT, delta: 1, reason: 'craft' },
        actionEntry(CULT_SEAT, {
          type: 'ritualRecruit',
          cardId: REVEALED_CARD_ID,
          clearing: 4,
        }),
      ]),
    ).toEqual([
      { seat: CAT_SEAT, cardId: CRAFTED_CARD_ID, reason: 'craft' },
      { seat: CULT_SEAT, cardId: REVEALED_CARD_ID, reason: 'reveal' },
    ])
  })

  it('ignores actions that show no card to the table', () => {
    expect(
      cardFlightsFromLog([
        actionEntry(CAT_SEAT, { type: 'recruit' }),
        actionEntry(CAT_SEAT, { type: 'overwork', cardId: CRAFTED_CARD_ID }),
        { t: 'start' },
      ]),
    ).toEqual([])
  })
})
