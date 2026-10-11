import { describe, expect, it } from 'vitest'
import type { Game } from '#game/Game.js'
import type { ClearingId } from '#map/types.js'
import type { Seat } from '#pieces/types.js'
import { RuleError } from '#rules/RuleError.js'
import { createPlayingGame } from '#test/fixtures.js'

const MARQUISE_SEAT: Seat = 0
const EYRIE_SEAT: Seat = 1
const BATTLE_CLEARING: ClearingId = 9
const MAX_PHASES_PER_TURN = 12

/** Marquise turn 1, Daylight actions: two phase ends that can be taken back. */
function gameInDaylightActions(): Game {
  const game: Game = createPlayingGame({ seed: 11 })
  game.apply({ type: 'endPhase' }) // birdsong → daylight craft
  game.apply({ type: 'endPhase' }) // craft → actions
  return game
}

function putBothSidesOn(game: Game, clearing: ClearingId): void {
  game.state.clearings[clearing]!.pieces.push(
    { id: 'undo-cat', kind: 'warrior', owner: MARQUISE_SEAT },
    { id: 'undo-bird', kind: 'warrior', owner: EYRIE_SEAT },
  )
}

describe('undo of turn actions', () => {
  it('nothing can be taken back when the game starts', () => {
    const game: Game = createPlayingGame({ seed: 11 })

    expect(game.canUndoTurnAction()).toBe(false)
    expect(() => game.undoTurnAction()).toThrow(RuleError)
  })

  it('each action of the turn can be taken back, latest first', () => {
    const game: Game = createPlayingGame({ seed: 11 })
    game.apply({ type: 'endPhase' })
    const afterFirstAction = structuredClone(game.state)
    game.apply({ type: 'endPhase' })
    expect(game.state.undoableActions).toBe(2)

    game.undoTurnAction()

    expect(game.state).toEqual(afterFirstAction)
    expect(game.state.undoableActions).toBe(1)
    game.undoTurnAction()
    expect(game.canUndoTurnAction()).toBe(false)
  })

  it('a battle clears the undo history', () => {
    const game: Game = gameInDaylightActions()
    putBothSidesOn(game, BATTLE_CLEARING)
    expect(game.canUndoTurnAction()).toBe(true)

    game.apply({ type: 'battle', clearing: BATTLE_CLEARING, defender: EYRIE_SEAT })

    expect(game.canUndoTurnAction()).toBe(false)
  })

  it('the answers given during a battle cannot be taken back either', () => {
    const game: Game = gameInDaylightActions()
    putBothSidesOn(game, BATTLE_CLEARING)
    game.apply({ type: 'battle', clearing: BATTLE_CLEARING, defender: EYRIE_SEAT })

    game.apply({ type: 'resolveEvent', decline: true }) // defender skips ambush

    expect(game.canUndoTurnAction()).toBe(false)
  })

  it('ending the turn clears the undo history', () => {
    const game: Game = gameInDaylightActions()
    let phases = 0
    while (game.state.currentSeat === MARQUISE_SEAT && phases++ < MAX_PHASES_PER_TURN) {
      game.apply({ type: 'endPhase' })
    }

    expect(game.state.currentSeat).toBe(EYRIE_SEAT)
    expect(game.canUndoTurnAction()).toBe(false)
  })
})
