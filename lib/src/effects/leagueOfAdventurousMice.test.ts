import { describe, expect, it } from 'vitest'
import { actionOptionsOf, type ActionOption } from '#actions/options.js'
import type { ActionSpec } from '#actions/types.js'
import {
  leagueOfAdventurousMiceEffect,
  tryApplyLeague,
} from '#effects/leagueOfAdventurousMice.js'
import '#effects/register.js'
import { FALL } from '#map/fall.js'
import type { ClearingId } from '#map/types.js'
import type { Seat } from '#pieces/types.js'
import { warriors } from '#queries/pieces.js'
import { RuleError } from '#rules/RuleError.js'
import type { CraftedItem, GameState } from '#state/types.js'
import {
  buildCraftContext,
  card,
  createPlayingGame,
  minimalState,
  player,
  withPieces,
} from '#test/fixtures.js'

describe('League of Adventurous Mice', () => {
  it('Rule: League — exhaust crafted item to take a move', () => {
    const game = createPlayingGame({ seed: 19 })

    game.apply({ type: 'endPhase' }) // → daylight craft
    game.apply({ type: 'endPhase' }) // → daylight actions

    const seat = game.state.currentSeat
    game.state.players[seat]!.playArea.push(card('ROOT-81'))
    game.state.players[seat]!.craftedItems.push({ type: 'boot', exhausted: false })

    // Pick a legal path-adjacent move from a clearing seat rules.
    let fromClearing = -1
    let toClearing = -1
    for (let from = 0; from < 12; from++) {
      if (warriors(game.state, from, seat) < 1) continue
      for (let to = 0; to < 12; to++) {
        if (FALL.isAdjacent(from, to)) {
          fromClearing = from
          toClearing = to
          break
        }
      }
      if (fromClearing >= 0) break
    }
    expect(fromClearing).toBeGreaterThanOrEqual(0)

    expect(game.legalActions().some((spec) => spec.type === 'leagueMove')).toBe(true)
    const beforeFrom = warriors(game.state, fromClearing, seat)
    game.apply({
      type: 'leagueMove',
      itemIndex: 0,
      from: fromClearing,
      to: toClearing,
      count: 1,
    })

    expect(game.state.turnScratch.leagueUsed).toBe(true)
    expect(game.state.players[seat]!.craftedItems[0]!.exhausted).toBe(true)
    expect(warriors(game.state, fromClearing, seat)).toBe(beforeFrom - 1)
    expect(warriors(game.state, toClearing, seat)).toBeGreaterThanOrEqual(1)
    expect(game.legalActions().some((spec) => spec.type === 'leagueMove')).toBe(false)
  })
})

const LEAGUE_DEF_ID = 'ROOT-81'
const OWNER_SEAT: Seat = 0
const ENEMY_SEAT: Seat = 1
const OWNER_CLEARING: ClearingId = 1
const NEIGHBOUR_CLEARING: ClearingId = 5
const FAR_CLEARING: ClearingId = 3

/** Marquise Daylight with the League; 2 warriors on 1, one Eyrie warrior there too. */
function leagueState(craftedItems: CraftedItem[]): GameState {
  const base: GameState = minimalState({
    players: [
      player(OWNER_SEAT, 'marquise', {
        playArea: [card(LEAGUE_DEF_ID)],
        craftedItems,
      }),
      player(ENEMY_SEAT, 'eyrie'),
    ],
  })
  return withPieces(base, OWNER_CLEARING, [
    { id: 'cat-1', kind: 'warrior', owner: OWNER_SEAT },
    { id: 'cat-2', kind: 'warrior', owner: OWNER_SEAT },
    { id: 'bird-1', kind: 'warrior', owner: ENEMY_SEAT },
  ])
}

function grantedSpec(state: GameState, type: ActionSpec['type']): ActionSpec {
  const spec: ActionSpec | undefined = (
    leagueOfAdventurousMiceEffect.grants?.(state) ?? []
  ).find((candidate: ActionSpec): boolean => candidate.type === type)
  if (spec === undefined) throw new Error(`no ${type} spec`)
  return spec
}

describe('League of Adventurous Mice — legal payloads', () => {
  it('offers one item per type, each with every legal move', () => {
    const state: GameState = leagueState([
      { type: 'boot', exhausted: false },
      { type: 'boot', exhausted: false },
      { type: 'tea', exhausted: true },
      { type: 'sword', exhausted: false },
    ])

    const options: ActionOption[] = actionOptionsOf(
      grantedSpec(state, 'leagueMove').params?.options,
    )

    const itemIndexes: number[] = [
      ...new Set(options.map((option: ActionOption) => Number(option.itemIndex))),
    ]
    expect(itemIndexes).toEqual([0, 3])
    expect(options).toContainEqual({
      itemIndex: 0,
      from: OWNER_CLEARING,
      to: NEIGHBOUR_CLEARING,
      count: 2,
    })
    expect(
      options.some((option: ActionOption): boolean => option.to === FAR_CLEARING),
    ).toBe(false)
  })

  it('offers a battle against each enemy sharing a clearing', () => {
    const state: GameState = leagueState([{ type: 'boot', exhausted: false }])

    expect(grantedSpec(state, 'leagueBattle').params?.options).toEqual([
      { itemIndex: 0, clearing: OWNER_CLEARING, defender: ENEMY_SEAT },
    ])
  })

  it('an illegal move costs neither the item nor the Daylight use', () => {
    const state: GameState = leagueState([{ type: 'boot', exhausted: false }])
    const before: GameState = structuredClone(state)

    expect(() =>
      tryApplyLeague(
        state,
        {
          type: 'leagueMove',
          itemIndex: 0,
          from: OWNER_CLEARING,
          to: FAR_CLEARING,
          count: 1,
        },
        buildCraftContext(state),
      ),
    ).toThrow(RuleError)
    expect(state).toEqual(before)
  })

  it('an illegal battle costs neither the item nor the Daylight use', () => {
    const state: GameState = leagueState([{ type: 'boot', exhausted: false }])
    const before: GameState = structuredClone(state)

    expect(() =>
      tryApplyLeague(
        state,
        {
          type: 'leagueBattle',
          itemIndex: 0,
          clearing: NEIGHBOUR_CLEARING,
          defender: ENEMY_SEAT,
        },
        buildCraftContext(state),
      ),
    ).toThrow(RuleError)
    expect(state).toEqual(before)
  })
})
