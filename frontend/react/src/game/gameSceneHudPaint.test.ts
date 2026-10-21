import { describe, expect, it } from 'vitest'
import { canUndoTurnAction, hudStatusMessage } from '#game/gameSceneHudPaint.ts'
import { makeGameState } from '#test/factories.ts'

describe('canUndoTurnAction', () => {
  it('shows Undo to the player of the turn while an action can be taken back', () => {
    expect(canUndoTurnAction(makeGameState({ undoableActions: 2 }), true)).toBe(true)
  })

  it('hides it once the server counts nothing undoable (battle, new turn)', () => {
    expect(canUndoTurnAction(makeGameState({ undoableActions: 0 }), true)).toBe(false)
    expect(canUndoTurnAction(makeGameState(), true)).toBe(false)
  })

  it('hides it from every player whose turn it is not', () => {
    expect(canUndoTurnAction(makeGameState({ undoableActions: 2 }), false)).toBe(false)
  })

  it('hides it when the game is over', () => {
    expect(
      canUndoTurnAction(
        makeGameState({ undoableActions: 2, status: 'finished' }),
        true,
      ),
    ).toBe(false)
  })
})

describe('hudStatusMessage', () => {
  it('waits for the other seat while the game goes on', () => {
    expect(hudStatusMessage(null, makeGameState(), false)).toBe(
      'Waiting for other player…',
    )
  })

  it('says nothing to the seat that acts', () => {
    expect(hudStatusMessage(null, makeGameState(), true)).toBeNull()
  })

  it('waits for nobody once the game is over', () => {
    expect(
      hudStatusMessage(null, makeGameState({ status: 'finished' }), false),
    ).toBeNull()
  })

  it('shows an error first', () => {
    expect(hudStatusMessage('Not your seat', makeGameState(), true)).toBe(
      'Not your seat',
    )
  })
})
