import { describe, expect, it, vi } from 'vitest'
import { ActionComposer } from '#game/resolution/ActionComposer.ts'
import { AutoPromptController } from '#game/resolution/autoPromptController.ts'
import type { GameSessionSnapshot } from '#game/GameSession.ts'
import { makeGameState } from '#test/factories.ts'

function setupSnapshot(): GameSessionSnapshot {
  return {
    state: makeGameState({
      status: 'setup',
      turn: 0,
      phase: 'birdsong',
      pending: [{ type: 'chooseKeep', seat: 0 }],
    }),
    legalActions: [
      {
        type: 'resolveEvent',
        actor: 0,
        params: { clearing: [0, 1, 2, 3] },
      },
    ],
    historyLength: 0,
    log: [],
    error: null,
    loading: false,
  }
}

describe('AutoPromptController setup keep', () => {
  it('does not lock setup prompt before board ready', () => {
    const applyComposerOutcome = vi.fn()
    const composer = new ActionComposer()
    const beginSpy = vi.spyOn(composer, 'begin')
    let boardReady = false
    const controller = new AutoPromptController({
      applyComposerOutcome,
      composer,
      eventComposer: {
        beginFieldHospital: () => ({ kind: 'idle' }),
        beginAmbush: () => ({ kind: 'idle' }),
        beginBattleRemoval: () => ({ kind: 'idle' }),
      },
      submitEndPhase: () => undefined,
      isBattleResultFlashActive: () => false,
      isBoardReady: () => boardReady,
    })
    const snapshot = setupSnapshot()

    controller.runAfterHudPaint(snapshot, 0, true)
    expect(beginSpy).not.toHaveBeenCalled()
    expect(applyComposerOutcome).not.toHaveBeenCalled()

    boardReady = true
    controller.runAfterHudPaint(snapshot, 0, true)
    expect(beginSpy).toHaveBeenCalledTimes(1)
    expect(applyComposerOutcome).toHaveBeenCalledTimes(1)
  })
})
