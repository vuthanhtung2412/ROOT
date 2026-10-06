import { describe, expect, it } from 'vitest'
import { cardFlightsFromLog } from '#game/cardFlights.ts'

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
