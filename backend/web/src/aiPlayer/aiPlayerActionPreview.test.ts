import { describe, expect, it } from 'vitest'
import { RuleError, type Action, type Game } from '@root/lib'
import {
  previewAction,
  type ActionPreview,
} from '#aiPlayer/aiPlayerActionPreview.js'
import {
  createPlayingTwoPlayerGame,
  FIRST_TEST_PLAYER_ID,
} from '#test/gameStateFixtures.js'

const BATTLE_CLEARING = 1
const MARQUISE_SEAT = 0
const EYRIE_SEAT = 1

function firstLegalMarch(game: Game): Action {
  const move = game
    .legalActions()
    .find((spec) => spec.type === 'march')?.params?.moves?.[0]
  if (move === undefined) {
    throw new Error('fixture: the Marquise should have a legal march')
  }
  return { type: 'march', moves: [move] }
}

/** One Eyrie warrior next to the lone Marquise warrior of the clearing. */
function placeEyrieWarrior(game: Game): void {
  game.state.clearings[BATTLE_CLEARING]?.pieces.push({
    id: 'test-eyrie-warrior',
    kind: 'warrior',
    owner: EYRIE_SEAT,
  })
}

describe('previewAction', () => {
  it('reports what a legal action would cause and leaves the game untouched', () => {
    const game = createPlayingTwoPlayerGame()
    const action = firstLegalMarch(game)
    const snapshotBefore = JSON.stringify(game.toJSON())

    const preview = previewAction({
      game,
      playerId: FIRST_TEST_PLAYER_ID,
      action,
    })

    expect(JSON.stringify(game.toJSON())).toBe(snapshotBefore)
    expect(preview).toMatchObject({
      legal: true,
      phaseAfter: 'daylight/actions',
      yourTurnAfter: true,
    })
    expect(preview.wouldApply).toContain('MOVE')
    expect(preview.wouldLog?.length).toBeGreaterThan(0)
    expect(preview.nextLegalActionTypes).toContain('endPhase')
    expect(preview.outcomeNotShown).toBeUndefined()
  })

  it('throws the rule error of an illegal action, as the game would', () => {
    const game = createPlayingTwoPlayerGame()

    expect(() =>
      previewAction({
        game,
        playerId: FIRST_TEST_PLAYER_ID,
        action: { type: 'march', moves: [{ from: 2, to: 3, count: 1 }] },
      }),
    ).toThrow(RuleError)
  })

  it('never rolls a battle: only the warriors both sides bring', () => {
    const game = createPlayingTwoPlayerGame()
    placeEyrieWarrior(game)

    const preview = previewAction({
      game,
      playerId: FIRST_TEST_PLAYER_ID,
      action: {
        type: 'battle',
        clearing: BATTLE_CLEARING,
        defender: EYRIE_SEAT,
      },
    })

    expect(preview.battle).toMatchObject({
      clearing: BATTLE_CLEARING,
      yourWarriors: 1,
      defenderWarriors: 1,
      maxRolledHitsYouDeal: 1,
      maxRolledHitsYouTake: 1,
    })
    expect(preview.wouldLog).toBeUndefined()
    expect(preview.nextLegalActionTypes).toBeUndefined()
    expect(game.state.clearings[BATTLE_CLEARING]?.pieces).toHaveLength(2)
  })

  it('answers a battle the same way whether or not the defender holds an ambush', () => {
    const withoutAmbush = createPlayingTwoPlayerGame()
    const withAmbush = createPlayingTwoPlayerGame()
    placeEyrieWarrior(withoutAmbush)
    placeEyrieWarrior(withAmbush)
    const withoutAmbushHand = withoutAmbush.state.players[EYRIE_SEAT]
    const withAmbushHand = withAmbush.state.players[EYRIE_SEAT]
    if (withoutAmbushHand === undefined || withAmbushHand === undefined) {
      throw new Error('fixture: the Eyrie seat is missing')
    }
    withoutAmbushHand.hand = []
    withAmbushHand.hand = [{ id: 'ROOT-200#1', defId: 'ROOT-200' }]
    const action: Action = {
      type: 'battle',
      clearing: BATTLE_CLEARING,
      defender: EYRIE_SEAT,
    }

    expect(
      previewAction({ game: withAmbush, playerId: FIRST_TEST_PLAYER_ID, action }),
    ).toEqual(
      previewAction({
        game: withoutAmbush,
        playerId: FIRST_TEST_PLAYER_ID,
        action,
      }),
    )
  })

  it('withholds an outcome that draws face-down cards', () => {
    const game = createPlayingTwoPlayerGame()
    const endPhase: Action = { type: 'endPhase' }
    const previewEndPhase = (): ActionPreview =>
      previewAction({ game, playerId: FIRST_TEST_PLAYER_ID, action: endPhase })
    // Walk to the phase end that triggers the Evening draw.
    while (
      game.state.currentSeat === MARQUISE_SEAT &&
      previewEndPhase().outcomeNotShown === undefined
    ) {
      game.apply(endPhase)
    }
    const drawPileSize = game.state.deck.draw.length

    const preview = previewEndPhase()

    expect(game.state.currentSeat).toBe(MARQUISE_SEAT)
    expect(game.state.deck.draw).toHaveLength(drawPileSize)
    expect(preview.legal).toBe(true)
    expect(preview.outcomeNotShown).toContain('face down')
    expect(preview.wouldLog).toBeUndefined()
  })
})
