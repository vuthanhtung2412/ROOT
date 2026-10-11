import { describe, expect, it } from 'vitest'
import { actionOptionsOf, type ActionOption } from '#actions/options.js'
import type { ActionSpec } from '#actions/types.js'
import type { Card } from '#cards/types.js'
import '#effects/register.js'
import type { Game } from '#game/Game.js'
import type { ClearingId } from '#map/types.js'
import type { Piece, Seat } from '#pieces/types.js'
import { warriors } from '#queries/pieces.js'
import { RuleError } from '#rules/RuleError.js'
import { card, createPlayingGame, emptyClearings } from '#test/fixtures.js'

const OWNER_SEAT: Seat = 0
const ENEMY_SEAT: Seat = 1
const OWNER_CLEARING: ClearingId = 9
/** Path neighbours of clearing 9 on the Autumn map: 0, 1, 11. */
const ENEMY_CLEARING: ClearingId = 1
const EMPTY_CLEARING: ClearingId = 0
const EMIGRE: Card = card('ROOT-71')

function ownerWarrior(id: string): Piece {
  return { id, kind: 'warrior', owner: OWNER_SEAT }
}

/**
 * Marquise Birdsong with Eyrie Émigré. Map: her warriors on 9 only (`ownerWarriors`
 * of them), one Eyrie warrior on 1.
 */
function emigreGame(ownerWarriors = 2): Game {
  const game: Game = createPlayingGame({ seed: 37 })
  game.state.players[OWNER_SEAT]!.playArea.push(EMIGRE)
  game.state.clearings = emptyClearings()
  game.state.clearings[OWNER_CLEARING]!.pieces = Array.from(
    { length: ownerWarriors },
    (_warrior: unknown, index: number): Piece => ownerWarrior(`cat-${String(index)}`),
  )
  game.state.clearings[ENEMY_CLEARING]!.pieces = [
    { id: 'bird', kind: 'warrior', owner: ENEMY_SEAT },
  ]
  return game
}

function ownsEmigre(game: Game): boolean {
  return game.state.players[OWNER_SEAT]!.playArea.some(
    (playCard: Card): boolean => playCard.id === EMIGRE.id,
  )
}

function specTypes(game: Game): string[] {
  return game.legalActions().map((spec: ActionSpec): string => spec.type)
}

function forcedMoveOptions(game: Game): ActionOption[] {
  return actionOptionsOf(game.legalActions()[0]?.params?.options)
}

describe('Eyrie Émigré — "At end of Birdsong, you must take a move, then you must battle in the destination clearing"', () => {
  it('is not offered during Birdsong, only when Birdsong ends', () => {
    const game: Game = emigreGame()

    expect(specTypes(game)).not.toContain('eyrieEmigre')
    expect(() =>
      game.apply({
        type: 'eyrieEmigre',
        from: OWNER_CLEARING,
        to: ENEMY_CLEARING,
        count: 1,
        defender: ENEMY_SEAT,
      }),
    ).toThrow(RuleError)
  })

  it('ending Birdsong forces the move: nothing else can be done', () => {
    const game: Game = emigreGame()

    game.apply({ type: 'endPhase' })

    expect(game.state.phase).toBe('birdsong')
    expect(specTypes(game)).toEqual(['eyrieEmigre'])
    expect(ownsEmigre(game)).toBe(true)
  })

  it('offers every legal move; a destination with an enemy comes with its battle', () => {
    const game: Game = emigreGame()
    game.apply({ type: 'endPhase' })

    const options: ActionOption[] = forcedMoveOptions(game)

    expect(options).toContainEqual({
      from: OWNER_CLEARING,
      to: ENEMY_CLEARING,
      count: 2,
      defender: ENEMY_SEAT,
    })
    expect(options).toContainEqual({
      from: OWNER_CLEARING,
      to: EMPTY_CLEARING,
      count: 1,
    })
    expect(options).not.toContainEqual({
      from: OWNER_CLEARING,
      to: ENEMY_CLEARING,
      count: 2,
    })
  })

  it('move into an enemy clearing starts the battle and keeps the card', () => {
    const game: Game = emigreGame()
    game.apply({ type: 'endPhase' })

    game.apply({
      type: 'eyrieEmigre',
      from: OWNER_CLEARING,
      to: ENEMY_CLEARING,
      count: 2,
      defender: ENEMY_SEAT,
    })

    expect(warriors(game.state, ENEMY_CLEARING, OWNER_SEAT)).toBe(2)
    expect(game.state.pending[0]).toMatchObject({
      type: 'battle',
      clearing: ENEMY_CLEARING,
      attacker: OWNER_SEAT,
      defender: ENEMY_SEAT,
    })
    expect(ownsEmigre(game)).toBe(true)
  })

  it('"Discard this if you did not take both actions": a move with no battle discards it', () => {
    const game: Game = emigreGame()
    game.apply({ type: 'endPhase' })

    game.apply({
      type: 'eyrieEmigre',
      from: OWNER_CLEARING,
      to: EMPTY_CLEARING,
      count: 1,
    })

    expect(warriors(game.state, EMPTY_CLEARING, OWNER_SEAT)).toBe(1)
    expect(ownsEmigre(game)).toBe(false)
    expect(game.state.deck.discard).toContainEqual(EMIGRE)
  })

  it('cannot skip the battle when the destination holds an enemy', () => {
    const game: Game = emigreGame()
    game.apply({ type: 'endPhase' })
    const before = structuredClone(game.state)

    expect(() =>
      game.apply({
        type: 'eyrieEmigre',
        from: OWNER_CLEARING,
        to: ENEMY_CLEARING,
        count: 1,
      }),
    ).toThrow(RuleError)
    expect(game.state).toEqual(before)
  })

  it('once the forced move is taken, only Daylight is left', () => {
    const game: Game = emigreGame()
    game.apply({ type: 'endPhase' })
    game.apply({
      type: 'eyrieEmigre',
      from: OWNER_CLEARING,
      to: EMPTY_CLEARING,
      count: 1,
    })

    expect(specTypes(game)).toEqual(['endPhase'])
    game.apply({ type: 'endPhase' })

    expect(game.state.phase).toBe('daylight')
    expect(game.state.turnScratch.endOfBirdsong).toBe(false)
  })

  it('with no possible move, Birdsong ends and the card is discarded', () => {
    const game: Game = emigreGame(0)

    game.apply({ type: 'endPhase' })

    expect(game.state.phase).toBe('daylight')
    expect(ownsEmigre(game)).toBe(false)
    expect(game.state.deck.discard).toContainEqual(EMIGRE)
  })
})
