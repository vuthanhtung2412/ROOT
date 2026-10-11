import { describe, expect, it } from 'vitest'
import { canUndoTurnAction } from '#game/gameSceneHudPaint.ts'
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
