import { describe, expect, it } from 'vitest'
import './register.js'
import { FALL } from '../map/fall.js'
import { warriors } from '../queries/pieces.js'
import { Game } from '../game/Game.js'
import { card } from '../test/fixtures.js'

describe('League of Adventurous Mice', () => {
  it('Rule: League — exhaust crafted item to take a move', () => {
    const game = Game.create({ seed: 19 })
    game.join('a')
    game.join('b')
    game.start()
    game.apply({ type: 'resolveEvent', clearing: 0 })
    while (game.state.pending[0]?.type === 'placeStartingBuilding') {
      const clearings = game.legalActions()[0]?.params?.clearing
      if (clearings === undefined || clearings.length === 0) {
        throw new Error('no legal starting building clearings')
      }
      game.apply({ type: 'resolveEvent', clearing: clearings[0]! })
    }
    game.apply({ type: 'resolveEvent', leader: 'builder' })

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
