import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ActionComposer,
  type ComposerOutcome,
} from '#game/resolution/ActionComposer.ts'
import { AutoPromptController } from '#game/resolution/autoPromptController.ts'
import { createEventComposerHooks } from '#game/resolution/eventActionComposer.ts'
import type { GameSessionSnapshot } from '#game/GameSession.ts'
import { makeActionSpec, makeGameState } from '#test/factories.ts'

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

// The controller reads a QA flag on `window`; these tests run without a browser.
beforeEach((): void => {
  vi.stubGlobal('window', {})
})

afterEach((): void => {
  vi.unstubAllGlobals()
})

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

const DEFENDER_SEAT = 1
const UNRELATED_CLEARING = 3

function ambushSnapshot(): GameSessionSnapshot {
  return {
    state: makeGameState({
      pending: [
        {
          type: 'battle',
          clearing: 6,
          attacker: 0,
          defender: DEFENDER_SEAT,
          stage: 'ambush',
        },
      ],
    }),
    legalActions: [
      makeActionSpec({
        type: 'resolveEvent',
        actor: DEFENDER_SEAT,
        params: { decline: [true] },
      }),
    ],
    historyLength: 0,
    log: [],
    error: null,
    loading: false,
  }
}

describe('AutoPromptController ambush', () => {
  it('keeps the Skip ambush prompt when the defender clicks the map', () => {
    const events = createEventComposerHooks()
    const composer = new ActionComposer()
    composer.setHooks(events.hooks)
    const controller = new AutoPromptController({
      applyComposerOutcome: () => undefined,
      composer,
      eventComposer: events,
      submitEndPhase: () => undefined,
      isBattleResultFlashActive: () => false,
      isBoardReady: () => true,
    })

    controller.runAfterHudPaint(ambushSnapshot(), DEFENDER_SEAT, true)
    const afterMapClick: ComposerOutcome =
      composer.chooseClearing(UNRELATED_CLEARING)

    expect(afterMapClick.kind).toBe('incomplete')
    expect(events.getPromptOptions()).toEqual([
      { label: 'Skip ambush', value: 'decline' },
    ])
  })
})

const EYRIE_SEAT = 1

function soleEndPhaseSnapshot(): GameSessionSnapshot {
  return {
    state: makeGameState({
      turn: 26,
      currentSeat: EYRIE_SEAT,
      phase: 'birdsong',
      step: 'newRoost',
      pending: [],
    }),
    legalActions: [
      makeActionSpec({ type: 'endPhase', actor: EYRIE_SEAT }),
    ],
    historyLength: 0,
    log: [],
    error: null,
    loading: false,
  }
}

describe('AutoPromptController sole endPhase', () => {
  it('does not send a second endPhase after legalActions are cleared in flight', () => {
    const submitEndPhaseCalls = vi.fn()
    const composer = new ActionComposer()
    const controller = new AutoPromptController({
      applyComposerOutcome: () => undefined,
      composer,
      eventComposer: {
        beginFieldHospital: () => ({ kind: 'idle' }),
        beginAmbush: () => ({ kind: 'idle' }),
        beginBattleRemoval: () => ({ kind: 'idle' }),
      },
      submitEndPhase: () => {
        submitEndPhaseCalls()
        // GameSession.submitAction clears legal actions before the POST returns.
        controller.runAfterHudPaint(
          {
            ...soleEndPhaseSnapshot(),
            legalActions: [],
            loading: true,
          },
          EYRIE_SEAT,
          true,
        )
      },
      isBattleResultFlashActive: () => false,
      isBoardReady: () => true,
    })

    const soleEnd = soleEndPhaseSnapshot()
    controller.runAfterHudPaint(soleEnd, EYRIE_SEAT, true)
    // Re-paint of the same sole-endPhase step (2nd listener / reentrancy).
    controller.runAfterHudPaint(soleEnd, EYRIE_SEAT, true)

    expect(submitEndPhaseCalls).toHaveBeenCalledTimes(1)
  })

  it('clears the endPhase lock when the actor has a real choice', () => {
    const submitEndPhaseCalls = vi.fn()
    const composer = new ActionComposer()
    const controller = new AutoPromptController({
      applyComposerOutcome: () => undefined,
      composer,
      eventComposer: {
        beginFieldHospital: () => ({ kind: 'idle' }),
        beginAmbush: () => ({ kind: 'idle' }),
        beginBattleRemoval: () => ({ kind: 'idle' }),
      },
      submitEndPhase: submitEndPhaseCalls,
      isBattleResultFlashActive: () => false,
      isBoardReady: () => true,
    })

    controller.runAfterHudPaint(soleEndPhaseSnapshot(), EYRIE_SEAT, true)
    expect(submitEndPhaseCalls).toHaveBeenCalledTimes(1)

    // Craft step with a craftable card: not a sole endPhase.
    controller.runAfterHudPaint(
      {
        state: makeGameState({
          turn: 26,
          currentSeat: EYRIE_SEAT,
          phase: 'daylight',
          step: 'craft',
          pending: [],
        }),
        legalActions: [
          makeActionSpec({ type: 'craft', actor: EYRIE_SEAT }),
          makeActionSpec({ type: 'endPhase', actor: EYRIE_SEAT }),
        ],
        historyLength: 1,
        log: [],
        error: null,
        loading: false,
      },
      EYRIE_SEAT,
      true,
    )
    expect(submitEndPhaseCalls).toHaveBeenCalledTimes(1)

    // Later sole endPhase on a new step may auto-send again.
    controller.runAfterHudPaint(
      {
        state: makeGameState({
          turn: 26,
          currentSeat: EYRIE_SEAT,
          phase: 'evening',
          step: 'discard',
          pending: [],
        }),
        legalActions: [
          makeActionSpec({ type: 'endPhase', actor: EYRIE_SEAT }),
        ],
        historyLength: 2,
        log: [],
        error: null,
        loading: false,
      },
      EYRIE_SEAT,
      true,
    )
    expect(submitEndPhaseCalls).toHaveBeenCalledTimes(2)
  })
})
