import { describe, expect, it } from 'vitest'
import { forecastDecree } from '#factions/eyrie/decreeForecast.js'
import { makeViziers } from '#factions/eyrie/viziers.js'
import { FALL } from '#map/fall.js'
import type { Piece } from '#pieces/types.js'
import { RuleError } from '#rules/RuleError.js'
import type { GameState } from '#state/types.js'
import {
  card,
  eyrieBoard,
  minimalState,
  player,
  testContext,
  withPieces,
} from '#test/fixtures.js'

const EYRIE_SEAT = 1
const MARQUISE_SEAT = 0
const ROOST_CLEARING = 0
/** Sword: a mouse card. */
const MOUSE_CARD = card('ROOT-224')
const [VIZIER] = makeViziers()

const ROOST: Piece = {
  id: 'roost',
  kind: 'building',
  owner: EYRIE_SEAT,
  type: 'roost',
  used: false,
}
const EYRIE_WARRIOR: Piece = { id: 'eyrie-w', kind: 'warrior', owner: EYRIE_SEAT }
const MARQUISE_WARRIOR: Piece = {
  id: 'marquise-w',
  kind: 'warrior',
  owner: MARQUISE_SEAT,
}

/** Eyrie with a roost and one warrior in `ROOST_CLEARING`, and `decree`. */
function eyrieState(
  decree: Partial<ReturnType<typeof eyrieBoard>['decree']>,
  hand: ReturnType<typeof card>[] = [],
): GameState {
  const board = eyrieBoard({
    decree: { recruit: [], move: [], battle: [], build: [], ...decree },
  })
  return withPieces(
    minimalState({
      currentSeat: EYRIE_SEAT,
      players: [
        player(MARQUISE_SEAT, 'marquise'),
        player(EYRIE_SEAT, 'eyrie', { board, hand }),
      ],
    }),
    ROOST_CLEARING,
    [ROOST, EYRIE_WARRIOR],
  )
}

function forecast(
  state: GameState,
  adding: Parameters<typeof forecastDecree>[1]['adding'] = [],
): ReturnType<typeof forecastDecree> {
  return forecastDecree(
    state,
    { seat: EYRIE_SEAT, adding },
    testContext({ state }),
  )
}

describe('forecastDecree', () => {
  it('Rule: 7.5.2.I — a bird recruit card resolves at any roost', () => {
    const result = forecast(eyrieState({ recruit: [VIZIER!] }))

    expect(result.columns.recruit).toEqual([
      {
        cardId: VIZIER!.id,
        name: 'Loyal Vizier',
        suit: 'bird',
        resolvable: true,
        where: [ROOST_CLEARING],
        adding: false,
      },
    ])
    expect(result.recruitWarriorsNeeded).toBe(1)
  })

  it('Rule: 7.5.2.III — a battle card with no enemy in a matching clearing cannot resolve', () => {
    const result = forecast(eyrieState({ battle: [VIZIER!] }))

    expect(result.columns.battle[0]).toMatchObject({
      resolvable: false,
      where: [],
    })
  })

  it('Rule: 7.5.2.III — a battle card resolves where an enemy stands with Eyrie warriors', () => {
    const state = eyrieState({ battle: [VIZIER!] })
    const withEnemy = withPieces(state, ROOST_CLEARING, [
      ROOST,
      EYRIE_WARRIOR,
      MARQUISE_WARRIOR,
    ])

    expect(forecast(withEnemy).columns.battle[0]).toMatchObject({
      resolvable: true,
      where: [ROOST_CLEARING],
    })
  })

  it('Rule: 7.5.2.II — a move card needs Eyrie warriors in a clearing of its suit', () => {
    const suited: boolean = FALL.clearings[ROOST_CLEARING]?.suit === 'mouse'

    const result = forecast(eyrieState({ move: [MOUSE_CARD, VIZIER!] }))

    expect(result.columns.move[0]?.resolvable).toBe(suited)
    expect(result.columns.move[1]).toMatchObject({
      resolvable: true,
      where: [ROOST_CLEARING],
    })
  })

  it('Rule: 7.5.2 — a recruit resolved first can open a later column', () => {
    // No Eyrie warrior on the map: only the recruit puts one at the roost.
    const state = withPieces(
      eyrieState({ recruit: [VIZIER!], move: [VIZIER!] }),
      ROOST_CLEARING,
      [ROOST],
    )

    const result = forecast(state)

    expect(result.columns.move[0]).toMatchObject({
      resolvable: false,
      where: [],
      whereAfterRecruit: [ROOST_CLEARING],
    })
    expect(result.columns.recruit[0]).not.toHaveProperty('whereAfterRecruit')
    expect(state.clearings[ROOST_CLEARING]?.pieces).toEqual([ROOST])
  })

  it('Rule: 7.5.2 — with no recruit to resolve, nothing opens later', () => {
    const state = withPieces(eyrieState({ move: [VIZIER!] }), ROOST_CLEARING, [
      ROOST,
    ])

    expect(forecast(state).columns.move[0]).not.toHaveProperty(
      'whereAfterRecruit',
    )
  })

  it('Rule: 7.7.1 Humiliate — counts every bird card, viziers included', () => {
    const result = forecast(
      eyrieState({ recruit: [VIZIER!], move: [MOUSE_CARD] }),
    )

    expect(result.birdCards).toBe(1)
  })

  it('tries a hand card in a column without adding it to the Decree', () => {
    const state = eyrieState({}, [MOUSE_CARD])

    const result = forecast(state, [{ cardId: MOUSE_CARD.id, column: 'build' }])

    expect(result.columns.build).toEqual([
      expect.objectContaining({ cardId: MOUSE_CARD.id, adding: true }),
    ])
    expect(state.players[EYRIE_SEAT]?.hand).toEqual([MOUSE_CARD])
    expect(
      state.players[EYRIE_SEAT]?.board.kind === 'eyrie' &&
        state.players[EYRIE_SEAT].board.decree.build,
    ).toEqual([])
  })

  it('refuses to try a card that is not in hand', () => {
    expect(() =>
      forecast(eyrieState({}), [{ cardId: 'ROOT-224#9', column: 'move' }]),
    ).toThrow(RuleError)
  })
})
