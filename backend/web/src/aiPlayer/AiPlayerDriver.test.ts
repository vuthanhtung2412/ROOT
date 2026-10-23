import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ActionSpec, Game, Seat } from '@root/lib'
import type { AiPlayerSeatActivity } from '#aiPlayer/AiPlayerActivityFeed.js'
import {
  AiPlayerDriver,
  type AiPlayerDriverDependencies,
} from '#aiPlayer/AiPlayerDriver.js'
import { ACT_TOOL_NAME, SHOW_TOOL_NAME } from '#aiPlayer/aiPlayerTools.js'
import type { ModelProvider } from '#aiPlayer/ModelProvider.js'
import { DEFAULT_LOBBY_MODE, store } from '#store/GameStore.js'
import {
  answerSetupChoiceReply,
  createHangingProvider,
  createScriptedProvider,
  stoppedReply,
  toolCallReply,
  type ScriptedReply,
} from '#test/aiPlayerFixtures.js'
import {
  createStartedTwoPlayerGame,
  FIRST_TEST_PLAYER_ID,
  KEEP_CORNER_ACTION,
} from '#test/gameStateFixtures.js'

const AI_SEAT: Seat = 0
const HUMAN_SEAT: Seat = 1
const AI_MODEL = 'anthropic:claude-opus-5-5'
const END_PHASE_OF_AI_SEAT: ActionSpec = { type: 'endPhase', actor: AI_SEAT }
const DECISION_OF_AI_SEAT: ActionSpec = { type: 'resolveEvent', actor: AI_SEAT }

type DriverFixture = {
  driver: AiPlayerDriver
  dependencies: AiPlayerDriverDependencies
}

function createDriver(provider: ModelProvider | null): DriverFixture {
  const dependencies: AiPlayerDriverDependencies = {
    room: store,
    createProvider: vi.fn((): ModelProvider | null => provider),
    loadRulebook: () => [],
    wait: (): Promise<void> => Promise.resolve(),
    publishGameChange: vi.fn<() => void>(),
    publishStatusChange: vi.fn<() => void>(),
    publishActivity: vi.fn<(activity: AiPlayerSeatActivity) => void>(),
  }
  return { driver: new AiPlayerDriver(dependencies), dependencies }
}

/** Puts a started game in the store with an AI player at seat 0. */
function seatAiPlayer(): Game {
  const game = createStartedTwoPlayerGame()
  store.game = game
  store.aiPlayers = [
    { playerId: FIRST_TEST_PLAYER_ID, model: AI_MODEL, status: 'idle' },
  ]
  return game
}

type ControlledGame = {
  game: Game
  /** What the engine reports as legal from now on. */
  setLegalActions: (legalActions: ActionSpec[]) => void
  /** Whose turn it is and which turn. */
  setTurn: (currentSeat: Seat, turn: number) => void
}

/** A game in play whose turn and legal actions the test dictates. */
function seatAiPlayerInControlledGame(): ControlledGame {
  const game = seatAiPlayer()
  let legalActions: ActionSpec[] = []
  vi.spyOn(game, 'legalActions').mockImplementation(
    (): ActionSpec[] => legalActions,
  )
  game.state.status = 'playing'
  return {
    game,
    setLegalActions: (next: ActionSpec[]): void => {
      legalActions = next
    },
    setTurn: (currentSeat: Seat, turn: number): void => {
      game.state.currentSeat = currentSeat
      game.state.turn = turn
    },
  }
}

function aiPlayerStatus(): string | undefined {
  return store.aiPlayers[0]?.status
}

describe('AiPlayerDriver', () => {
  beforeEach((): void => {
    vi.spyOn(console, 'error').mockImplementation((): void => {})
  })

  afterEach((): void => {
    store.game = null
    store.mode = DEFAULT_LOBBY_MODE
    store.aiPlayers = []
    vi.restoreAllMocks()
  })

  it('plays what its seat owes on the real engine and reports its status', async () => {
    const game = seatAiPlayer()
    const scripted = createScriptedProvider([
      () => answerSetupChoiceReply(game, FIRST_TEST_PLAYER_ID),
    ])
    const { driver, dependencies } = createDriver(scripted.provider)

    driver.handleGameChanged()

    expect(aiPlayerStatus()).toBe('thinking')
    await vi.waitFor((): void => {
      expect(aiPlayerStatus()).toBe('idle')
    })
    // Keep corner and starting buildings placed: the human seat is next.
    expect(game.state.pending[0]).toMatchObject({ seat: HUMAN_SEAT })
    expect(dependencies.publishGameChange).toHaveBeenCalled()
    expect(dependencies.publishStatusChange).toHaveBeenCalled()
    expect(scripted.requests).toHaveLength(1)
    expect(scripted.requests[0]).toMatchObject({ modelId: 'claude-opus-5-5' })
    expect(scripted.requests[0]?.systemPrompt).toContain('marquise')
    expect(scripted.conversations[0]?.inputs[0]?.text).toContain(
      'not your turn',
    )
  })

  it('keeps one session for a whole turn and opens a new one next turn', async () => {
    const controlled = seatAiPlayerInControlledGame()
    // The model looks at the game; meanwhile another seat has to answer.
    const lookThenWait: ScriptedReply = () => {
      controlled.setLegalActions([])
      return toolCallReply(SHOW_TOOL_NAME, {})
    }
    const scripted = createScriptedProvider([lookThenWait])
    const { driver } = createDriver(scripted.provider)

    controlled.setTurn(AI_SEAT, 2)
    controlled.setLegalActions([END_PHASE_OF_AI_SEAT])
    driver.handleGameChanged()
    await vi.waitFor((): void => {
      expect(aiPlayerStatus()).toBe('idle')
    })
    expect(scripted.conversations[0]?.inputs[0]?.text).toContain('Turn 2')

    // Same turn, the other seat answered: same context, nothing lost.
    controlled.setLegalActions([END_PHASE_OF_AI_SEAT])
    driver.handleGameChanged()
    await vi.waitFor((): void => {
      expect(scripted.conversations[0]?.inputs).toHaveLength(2)
    })
    expect(scripted.requests).toHaveLength(1)
    expect(scripted.conversations[0]?.inputs[1]?.text).toContain(
      'still your turn',
    )
    expect(scripted.conversations[0]?.inputs[1]?.toolResults).toHaveLength(1)
    await vi.waitFor((): void => {
      expect(aiPlayerStatus()).toBe('idle')
    })

    // The turn passes on, then comes back: a fresh context.
    controlled.setTurn(HUMAN_SEAT, 3)
    driver.handleGameChanged()
    controlled.setTurn(AI_SEAT, 4)
    controlled.setLegalActions([END_PHASE_OF_AI_SEAT])
    driver.handleGameChanged()
    await vi.waitFor((): void => {
      expect(scripted.requests).toHaveLength(2)
    })
    expect(scripted.conversations[1]?.inputs[0]).toMatchObject({
      toolResults: [],
    })
    expect(scripted.conversations[1]?.inputs[0]?.text).toContain('Turn 4')
  })

  it('answers a decision outside its turn in a session of its own', async () => {
    const controlled = seatAiPlayerInControlledGame()
    const scripted = createScriptedProvider([
      (): ReturnType<ScriptedReply> => {
        controlled.setLegalActions([])
        return toolCallReply(SHOW_TOOL_NAME, {})
      },
    ])
    const { driver } = createDriver(scripted.provider)
    controlled.setTurn(HUMAN_SEAT, 3)

    for (const expectedSessionCount of [1, 2]) {
      controlled.setLegalActions([DECISION_OF_AI_SEAT])
      driver.handleGameChanged()
      await vi.waitFor((): void => {
        expect(aiPlayerStatus()).toBe('idle')
      })
      expect(scripted.requests).toHaveLength(expectedSessionCount)
    }
    expect(scripted.conversations[1]?.inputs[0]?.text).toContain(
      'not your turn',
    )
  })

  it('aborts the session on undo and starts over from the new state', () => {
    const game = seatAiPlayer()
    game.apply({ ...KEEP_CORNER_ACTION })
    const hanging = createHangingProvider()
    const { driver } = createDriver(hanging.provider)

    driver.handleGameChanged()
    expect(aiPlayerStatus()).toBe('thinking')
    game.undo()
    driver.handleGameChanged()

    expect(hanging.abortSignals).toHaveLength(2)
    expect(hanging.abortSignals[0]?.aborted).toBe(true)
    expect(hanging.abortSignals[1]?.aborted).toBe(false)
    expect(aiPlayerStatus()).toBe('thinking')
  })

  it('aborts the session when the game is replaced', () => {
    seatAiPlayer()
    const hanging = createHangingProvider()
    const { driver } = createDriver(hanging.provider)
    driver.handleGameChanged()

    store.game = null
    store.aiPlayers = []
    driver.handleGameChanged()

    expect(hanging.abortSignals[0]?.aborted).toBe(true)
  })

  it('marks the seat stuck on a failed session until it is restarted', async () => {
    seatAiPlayer()
    const scripted = createScriptedProvider([() => stoppedReply('refused')])
    const { driver } = createDriver(scripted.provider)

    driver.handleGameChanged()
    await vi.waitFor((): void => {
      expect(aiPlayerStatus()).toBe('stuck')
    })
    driver.handleGameChanged()
    expect(scripted.requests).toHaveLength(1)

    expect(driver.restart(HUMAN_SEAT)).toBe(false)
    expect(driver.restart(AI_SEAT)).toBe(true)

    expect(scripted.requests).toHaveLength(2)
    expect(scripted.conversations[1]?.inputs[0]).toMatchObject({
      toolResults: [],
    })
  })

  it('shows observers what its seat does, under its seat and model', async () => {
    const game = seatAiPlayer()
    const scripted = createScriptedProvider([
      () => answerSetupChoiceReply(game, FIRST_TEST_PLAYER_ID),
    ])
    const { driver, dependencies } = createDriver(scripted.provider)

    driver.handleGameChanged()
    await vi.waitFor((): void => {
      expect(aiPlayerStatus()).toBe('idle')
    })

    expect(dependencies.publishActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'toolCall',
        toolName: ACT_TOOL_NAME,
        seat: AI_SEAT,
        model: AI_MODEL,
      }),
    )
  })

  it('shows observers why a session failed', async () => {
    seatAiPlayer()
    const scripted = createScriptedProvider([() => stoppedReply('refused')])
    const { driver, dependencies } = createDriver(scripted.provider)

    driver.handleGameChanged()
    await vi.waitFor((): void => {
      expect(aiPlayerStatus()).toBe('stuck')
    })

    expect(dependencies.publishActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'failure',
        text: 'refused',
        isError: true,
        seat: AI_SEAT,
      }),
    )
  })

  it('restarts a session that is still thinking', () => {
    seatAiPlayer()
    const hanging = createHangingProvider()
    const { driver } = createDriver(hanging.provider)
    driver.handleGameChanged()

    expect(driver.restart(AI_SEAT)).toBe(true)

    expect(hanging.abortSignals[0]?.aborted).toBe(true)
    expect(hanging.abortSignals[1]?.aborted).toBe(false)
  })

  it('marks the seat stuck when its provider has no API key', () => {
    seatAiPlayer()
    const { driver } = createDriver(null)

    driver.handleGameChanged()

    expect(aiPlayerStatus()).toBe('stuck')
  })

  it('leaves human seats and an empty slot alone', () => {
    const scripted = createScriptedProvider([() => stoppedReply('finished')])
    const { driver } = createDriver(scripted.provider)

    driver.handleGameChanged()
    store.game = createStartedTwoPlayerGame()
    driver.handleGameChanged()

    expect(scripted.requests).toHaveLength(0)
  })
})
