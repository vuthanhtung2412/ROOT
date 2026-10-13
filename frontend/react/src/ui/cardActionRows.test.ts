import { describe, expect, it } from 'vitest'
import type { GameState } from '#api/client.ts'
import { makeActionSpec, makeGameState } from '#test/factories.ts'
import { cardActionRows, cardActionTally } from '#ui/cardActionRows.ts'

const ACTOR_SEAT = 0
const LEAGUE_DEF_ID = 'ROOT-81'
const PROPAGANDA_BUREAU_DEF_ID = 'ROOT-86'
const CHARM_OFFENSIVE_DEF_ID = 'ROOT-59'

/** Daylight state whose seat 0 crafted the given cards. */
function makeStateWithCrafted(
  craftedDefIds: readonly string[],
  overrides: Partial<GameState> = {},
): GameState {
  return makeGameState({
    phase: 'daylight',
    players: [
      {
        playerId: 'marquise',
        seat: ACTOR_SEAT,
        faction: 'marquise',
        vp: 0,
        hand: [],
        playArea: craftedDefIds.map((defId) => ({ id: `${defId}#1`, defId })),
      },
    ],
    ...overrides,
  })
}

describe('cardActionRows', () => {
  it('has no line without a crafted card that grants an action', () => {
    expect(cardActionRows(makeStateWithCrafted([]), ACTOR_SEAT, [])).toEqual([])
  })

  it('makes a legal card action a ready line holding its action', () => {
    const propaganda = makeActionSpec({ type: 'propagandaBureau' })

    const rows = cardActionRows(
      makeStateWithCrafted([PROPAGANDA_BUREAU_DEF_ID]),
      ACTOR_SEAT,
      [propaganda],
    )

    expect(rows).toEqual([
      {
        actionType: 'propagandaBureau',
        label: 'propaganda bureau',
        defId: PROPAGANDA_BUREAU_DEF_ID,
        phase: 'daylight',
        state: 'ready',
        spec: propaganda,
      },
    ])
  })

  it('turns a card of another phase off', () => {
    const rows = cardActionRows(
      makeStateWithCrafted([CHARM_OFFENSIVE_DEF_ID]),
      ACTOR_SEAT,
      [],
    )

    expect(rows.map((row) => row.state)).toEqual(['off'])
  })

  it('marks both League lines played once the card was used this turn', () => {
    const rows = cardActionRows(
      makeStateWithCrafted([LEAGUE_DEF_ID], {
        turnScratch: { leagueUsed: true },
      }),
      ACTOR_SEAT,
      [],
    )

    expect(rows.map((row) => [row.actionType, row.state])).toEqual([
      ['leagueMove', 'played'],
      ['leagueBattle', 'played'],
    ])
  })

  it('ignores a card action offered to another seat', () => {
    const otherSeat = 1
    const rows = cardActionRows(
      makeStateWithCrafted([PROPAGANDA_BUREAU_DEF_ID]),
      ACTOR_SEAT,
      [makeActionSpec({ type: 'propagandaBureau', actor: otherSeat })],
    )

    expect(rows.map((row) => row.state)).toEqual(['off'])
  })
})

describe('cardActionTally', () => {
  it('counts the played card actions over those of the current phase only', () => {
    const rows = cardActionRows(
      makeStateWithCrafted(
        [LEAGUE_DEF_ID, PROPAGANDA_BUREAU_DEF_ID, CHARM_OFFENSIVE_DEF_ID],
        { turnScratch: { propagandaUsed: true } },
      ),
      ACTOR_SEAT,
      [makeActionSpec({ type: 'leagueMove' })],
    )

    expect(cardActionTally(rows, 'daylight')).toBe('1/3 played')
  })
})
