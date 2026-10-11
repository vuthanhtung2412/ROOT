import { describe, expect, it } from 'vitest'
import type { ActionSpec } from '#actions/types.js'
import '#effects/register.js'
import type { Game } from '#game/Game.js'
import { RuleError } from '#rules/RuleError.js'
import { card, createPlayingGame } from '#test/fixtures.js'

describe('Charm Offensive', () => {
  it('Rule: Charm Offensive — Evening may draw and give another player one VP', () => {
    const game = createPlayingGame({ seed: 11 })

    // Advance seat 0 to Evening draw.
    game.apply({ type: 'endPhase' }) // birdsong → daylight craft
    game.apply({ type: 'endPhase' }) // craft → actions
    game.apply({ type: 'endPhase' }) // actions → evening (auto draw)

    game.state.players[0]!.playArea.push(card('ROOT-59'))
    game.state.deck.draw.push(card('ROOT-209', 9))
    const handBefore = game.state.players[0]!.hand.length
    const targetVpBefore = game.state.players[1]!.vp

    expect(game.state.phase).toBe('evening')
    expect(game.legalActions().some((spec) => spec.type === 'charmOffensive')).toBe(true)
    game.apply({ type: 'charmOffensive', target: 1 })

    expect(game.state.turnScratch.charmOffensiveUsed).toBe(true)
    expect(game.state.players[0]!.hand.length).toBe(handBefore + 1)
    expect(game.state.players[1]!.vp).toBe(targetVpBefore + 1)
    expect(game.legalActions().some((spec) => spec.type === 'charmOffensive')).toBe(false)
  })
})

const CHARM_OFFENSIVE_DEF_ID = 'ROOT-59'
const OWNER_SEAT = 0
const OTHER_SEAT = 1

/** Marquise enters Evening owning Charm Offensive, with cards left to draw. */
function gameAtEveningStart(): Game {
  const game: Game = createPlayingGame({ seed: 11 })
  game.state.players[OWNER_SEAT]!.playArea.push(card(CHARM_OFFENSIVE_DEF_ID))
  game.apply({ type: 'endPhase' }) // birdsong → daylight craft
  game.apply({ type: 'endPhase' }) // craft → actions
  game.apply({ type: 'endPhase' }) // actions → evening
  return game
}

function specOfType(game: Game, type: ActionSpec['type']): ActionSpec | undefined {
  return game.legalActions().find((spec: ActionSpec): boolean => spec.type === type)
}

describe('Charm Offensive — card text: "At start of Evening"', () => {
  it('holds the Evening draw back and lists every other player', () => {
    const game: Game = gameAtEveningStart()

    expect(game.state.phase).toBe('evening')
    expect(game.state.turnScratch.eveningDrawDone).toBe(false)
    expect(specOfType(game, 'charmOffensive')).toEqual({
      type: 'charmOffensive',
      actor: OWNER_SEAT,
      params: { options: [{ target: OTHER_SEAT }] },
    })
  })

  it('draws a card, scores the other player, then the Evening draw goes on', () => {
    const game: Game = gameAtEveningStart()
    const handBefore: number = game.state.players[OWNER_SEAT]!.hand.length
    const vpBefore: number = game.state.players[OTHER_SEAT]!.vp

    game.apply({ type: 'charmOffensive', target: OTHER_SEAT })

    expect(game.state.players[OTHER_SEAT]!.vp).toBe(vpBefore + 1)
    expect(game.state.turnScratch.eveningDrawDone).toBe(true)
    expect(game.state.players[OWNER_SEAT]!.hand.length).toBeGreaterThan(
      handBefore + 1,
    )
  })

  it('is over once the owner draws for Evening instead', () => {
    const game: Game = gameAtEveningStart()

    game.apply({ type: 'eveningDraw' })

    expect(specOfType(game, 'charmOffensive')).toBeUndefined()
    expect(() =>
      game.apply({ type: 'charmOffensive', target: OTHER_SEAT }),
    ).toThrow(RuleError)
  })
})
