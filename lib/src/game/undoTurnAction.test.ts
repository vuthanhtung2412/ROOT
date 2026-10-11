import { describe, expect, it } from 'vitest'
import type { ActionSpec, AddToDecreeCard } from '#actions/types.js'
import { Game } from '#game/Game.js'
import type { ClearingId } from '#map/types.js'
import type { Seat } from '#pieces/types.js'
import { RuleError } from '#rules/RuleError.js'
import { isFieldHospitalEvent } from '#typeGuards.js'
import { card, createPlayingGame } from '#test/fixtures.js'

const SWAP_MEET_DEF_ID = 'ROOT-103'
const TAKEN_CARD_DEF_ID = 'ROOT-211'
const PROPAGANDA_BUREAU_DEF_ID = 'ROOT-86'
const MOUSE_CARD_DEF_ID = 'ROOT-218'
const MARQUISE_SEAT: Seat = 0
const EYRIE_SEAT: Seat = 1
const BATTLE_CLEARING: ClearingId = 9
/** Mouse clearing away from the Keep so Eyrie can replace there. */
const MOUSE_CLEARING: ClearingId = 6
const MAX_PHASES_PER_TURN = 12
const SEED = 11

function legalTypes(game: Game): string[] {
  return [...new Set(game.legalActions().map((spec: ActionSpec): string => spec.type))]
}

function isEndPhaseTheOnlyAction(game: Game): boolean {
  return legalTypes(game).join() === 'endPhase'
}

/** Marquise turn 1 at the Daylight actions step: recruit, march, … are offered. */
function gameInDaylightActions(): Game {
  const game: Game = createPlayingGame({ seed: SEED })
  game.apply({ type: 'endPhase' }) // birdsong → daylight craft
  game.apply({ type: 'endPhase' }) // craft → actions
  expect(game.state.step).toBe('actions')
  return game
}

function endTurnOf(game: Game, seat: Seat): void {
  let phases = 0
  while (game.state.currentSeat === seat && phases++ < MAX_PHASES_PER_TURN) {
    game.apply({ type: 'endPhase' })
  }
}

function putBothSidesOn(game: Game, clearing: ClearingId): void {
  game.state.clearings[clearing]!.pieces.push(
    { id: 'undo-cat', kind: 'warrior', owner: MARQUISE_SEAT },
    { id: 'undo-bird', kind: 'warrior', owner: EYRIE_SEAT },
  )
}

function isAddToDecreeCard(value: object): value is AddToDecreeCard {
  return 'cardId' in value && 'column' in value
}

/** First card × column the Eyrie may add to the Decree. */
function firstDecreeCard(game: Game): AddToDecreeCard {
  const spec: ActionSpec | undefined = game
    .legalActions()
    .find((candidate: ActionSpec): boolean => candidate.type === 'addToDecree')
  const option: object | undefined = (spec?.params?.options ?? []).find(isAddToDecreeCard)
  if (option === undefined || !isAddToDecreeCard(option)) {
    throw new Error('no card to add to the Decree')
  }
  return option
}

describe('undo of turn actions', () => {
  it('nothing can be taken back when the game starts', () => {
    const game: Game = createPlayingGame({ seed: SEED })

    expect(game.canUndoTurnAction()).toBe(false)
    expect(() => game.undoTurnAction()).toThrow(RuleError)
  })

  it('a phase end with nothing else to do is no decision to take back', () => {
    const game: Game = createPlayingGame({ seed: SEED })
    expect(isEndPhaseTheOnlyAction(game)).toBe(true)

    game.apply({ type: 'endPhase' })

    expect(game.canUndoTurnAction()).toBe(false)
  })

  it('each decision of the turn can be taken back, latest first', () => {
    const game: Game = gameInDaylightActions()
    const undoableBefore: number = game.state.undoableActions ?? 0
    const beforeRecruit = structuredClone(game.state)
    game.apply({ type: 'recruit' })
    expect(game.state.undoableActions).toBe(undoableBefore + 1)

    game.undoTurnAction()

    expect(game.state).toEqual(beforeRecruit)
    game.undoTurnAction()
    expect(game.state.step).not.toBe('actions')
    expect(game.state.undoableActions).toBe(undoableBefore - 1)
  })

  it('a draw from the deck clears the undo history', () => {
    const game: Game = gameInDaylightActions()
    game.apply({ type: 'recruit' })
    const drawPileSize: number = game.state.deck.draw.length
    expect(game.canUndoTurnAction()).toBe(true)

    game.apply({ type: 'endPhase' }) // daylight → evening draw

    expect(game.state.currentSeat).toBe(MARQUISE_SEAT)
    expect(game.state.deck.draw.length).toBeLessThan(drawPileSize)
    expect(game.canUndoTurnAction()).toBe(false)
  })

  it('a card taken from another player clears the undo history', () => {
    const game: Game = createPlayingGame({ seed: SEED })
    game.state.players[MARQUISE_SEAT]!.playArea.push(card(SWAP_MEET_DEF_ID))
    game.state.players[EYRIE_SEAT]!.hand = [card(TAKEN_CARD_DEF_ID)]

    game.apply({ type: 'swapMeet', target: EYRIE_SEAT })

    expect(game.state.players[EYRIE_SEAT]!.hand).toEqual([])
    expect(game.canUndoTurnAction()).toBe(false)
  })

  it('taking back a decision also rewinds the forced phase ends after it', () => {
    const game: Game = createPlayingGame({ seed: SEED })
    endTurnOf(game, MARQUISE_SEAT)
    game.apply({ type: 'endPhase' }) // emergency orders step: nothing to do
    expect(game.state.step).toBe('decreeAdd')
    game.apply({ type: 'addToDecree', cards: [firstDecreeCard(game)] })
    // Nothing to craft on turn 1: this phase end is forced.
    expect(isEndPhaseTheOnlyAction(game)).toBe(true)
    game.apply({ type: 'endPhase' })
    expect(game.state.undoableActions).toBe(1)

    game.undoTurnAction()

    expect(game.state.currentSeat).toBe(EYRIE_SEAT)
    expect(game.state.step).toBe('decreeAdd')
    expect(game.canUndoTurnAction()).toBe(false)
  })

  it('forced phase ends still peel after a snapshot load', () => {
    const game: Game = createPlayingGame({ seed: SEED })
    endTurnOf(game, MARQUISE_SEAT)
    game.apply({ type: 'endPhase' })
    game.apply({ type: 'addToDecree', cards: [firstDecreeCard(game)] })
    expect(isEndPhaseTheOnlyAction(game)).toBe(true)
    game.apply({ type: 'endPhase' })
    expect(game.state.undoableActions).toBe(1)

    const restored: Game = Game.fromJSON(game.toJSON())
    restored.undoTurnAction()

    expect(restored.state.step).toBe('decreeAdd')
    expect(restored.canUndoTurnAction()).toBe(false)
  })

  it('a Field Hospitals prompt for another seat clears undo', () => {
    const game: Game = createPlayingGame({ seed: SEED })
    endTurnOf(game, MARQUISE_SEAT)
    game.apply({ type: 'endPhase' })
    game.apply({ type: 'addToDecree', cards: [firstDecreeCard(game)] })
    expect(game.state.undoableActions).toBe(1)
    while (game.state.phase !== 'daylight' && game.state.currentSeat === EYRIE_SEAT) {
      game.apply({ type: 'endPhase' })
    }
    expect(game.state.phase).toBe('daylight')
    expect(game.canUndoTurnAction()).toBe(true)

    game.state.players[EYRIE_SEAT]!.playArea.push(card(PROPAGANDA_BUREAU_DEF_ID))
    const mouseCard = card(MOUSE_CARD_DEF_ID)
    game.state.players[EYRIE_SEAT]!.hand.push(mouseCard)
    game.state.clearings[MOUSE_CLEARING]!.pieces.push({
      id: 'undo-fh-cat',
      kind: 'warrior',
      owner: MARQUISE_SEAT,
    })
    // Matching suit so Field Hospitals can answer the replace.
    game.state.players[MARQUISE_SEAT]!.hand.push(card(MOUSE_CARD_DEF_ID, 2))

    game.apply({
      type: 'propagandaBureau',
      cardId: mouseCard.id,
      clearing: MOUSE_CLEARING,
      pieceId: 'undo-fh-cat',
    })

    expect(game.state.pending.some(isFieldHospitalEvent)).toBe(true)
    expect(game.canUndoTurnAction()).toBe(false)
  })

  it('a battle clears the undo history', () => {
    const game: Game = gameInDaylightActions()
    game.apply({ type: 'recruit' })
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
    game.apply({ type: 'recruit' })
    expect(game.canUndoTurnAction()).toBe(true)

    endTurnOf(game, MARQUISE_SEAT)

    expect(game.state.currentSeat).toBe(EYRIE_SEAT)
    expect(game.canUndoTurnAction()).toBe(false)
  })
})
