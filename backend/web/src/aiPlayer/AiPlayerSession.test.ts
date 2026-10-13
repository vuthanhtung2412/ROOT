import { describe, expect, it, vi } from 'vitest'
import type { Game } from '@root/lib'
import { ACTIONS_TOOL_NAME, SHOW_TOOL_NAME } from '#aiPlayer/aiPlayerTools.js'
import {
  AI_PLAYER_ACTION_DELAY_MILLISECONDS,
  AiPlayerSession,
  MAX_TOOL_CALLS_PER_SESSION,
  MAX_UNFINISHED_REPLIES,
} from '#aiPlayer/AiPlayerSession.js'
import type { ModelConversation } from '#aiPlayer/ModelProvider.js'
import {
  answerSetupChoiceReply,
  createScriptedConversation,
  createToolContext,
  stoppedReply,
  toolCallReply,
  type ScriptedReply,
} from '#test/aiPlayerFixtures.js'
import {
  createStartedTwoPlayerGame,
  FIRST_TEST_PLAYER_ID,
} from '#test/gameStateFixtures.js'

type WaitMock = ReturnType<
  typeof vi.fn<(milliseconds: number) => Promise<void>>
>

type SessionFixture = {
  session: AiPlayerSession
  wait: WaitMock
  abortController: AbortController
}

function createSession(
  game: Game,
  conversation: ModelConversation,
): SessionFixture {
  const wait: WaitMock = vi.fn<(milliseconds: number) => Promise<void>>(
    (): Promise<void> => Promise.resolve(),
  )
  const abortController = new AbortController()
  const session = new AiPlayerSession({
    conversation,
    toolContext: createToolContext(game, FIRST_TEST_PLAYER_ID),
    abortSignal: abortController.signal,
    wait,
  })
  return { session, wait, abortController }
}

/** Seat 0 setup: keep corner, then three starting buildings. */
const FIRST_SEAT_SETUP_CHOICE_COUNT = 4

describe('AiPlayerSession', () => {
  it('plays until its seat has nothing left to do, pausing after each action', async () => {
    const game = createStartedTwoPlayerGame()
    const answerSetup: ScriptedReply = () =>
      answerSetupChoiceReply(game, FIRST_TEST_PLAYER_ID)
    const scripted = createScriptedConversation([
      () => toolCallReply(ACTIONS_TOOL_NAME, {}),
      answerSetup,
    ])
    const { session, wait } = createSession(game, scripted.conversation)

    await session.play('your turn')

    expect(game.state.pending[0]).toMatchObject({ seat: 1 })
    expect(wait).toHaveBeenCalledTimes(FIRST_SEAT_SETUP_CHOICE_COUNT)
    expect(wait).toHaveBeenCalledWith(AI_PLAYER_ACTION_DELAY_MILLISECONDS)
    expect(scripted.inputs[0]).toEqual({ toolResults: [], text: 'your turn' })
    // The model reads the legal actions it asked for before it acts.
    expect(scripted.inputs[1]?.toolResults[0]?.content).toContain('resolveEvent')
    expect(scripted.inputs[1]?.text).toBeNull()
  })

  it('continues in the same context: unread results open the next message', async () => {
    const game = createStartedTwoPlayerGame()
    const scripted = createScriptedConversation([
      () => answerSetupChoiceReply(game, FIRST_TEST_PLAYER_ID),
    ])
    const { session } = createSession(game, scripted.conversation)
    await session.play('your turn')
    const messageCountAfterFirstPlay = scripted.inputs.length

    // The game moves on; here the seat again has nothing to decide.
    const legalActions = vi.spyOn(game, 'legalActions').mockReturnValue([])
    await session.play('game moved on')
    legalActions.mockRestore()

    const resumeInput = scripted.inputs[messageCountAfterFirstPlay]
    expect(resumeInput?.text).toBe('game moved on')
    expect(resumeInput?.toolResults).toHaveLength(1)
    expect(resumeInput?.toolResults[0]?.content).toContain('Applied')
  })

  it('reminds a model that stops early, then gives up', async () => {
    const game = createStartedTwoPlayerGame()
    const scripted = createScriptedConversation([() => stoppedReply('finished')])
    const { session } = createSession(game, scripted.conversation)

    await expect(session.play('your turn')).rejects.toMatchObject({
      failure: 'stoppedWithoutActing',
    })
    expect(scripted.inputs).toHaveLength(MAX_UNFINISHED_REPLIES + 1)
    expect(scripted.inputs[1]?.text).toContain('still has legal actions')
  })

  it('lets the model correct an action the engine rejected', async () => {
    const game = createStartedTwoPlayerGame()
    const scripted = createScriptedConversation([
      () =>
        toolCallReply('act', { action: { type: 'resolveEvent', clearing: 5 } }),
      () => answerSetupChoiceReply(game, FIRST_TEST_PLAYER_ID),
    ])
    const { session } = createSession(game, scripted.conversation)

    await session.play('your turn')

    expect(scripted.inputs[1]?.toolResults[0]).toMatchObject({ isError: true })
    expect(game.state.pending[0]).toMatchObject({ seat: 1 })
  })

  it('fails on a refusal and on a truncated reply', async () => {
    for (const stopReason of ['refused', 'truncated'] as const) {
      const scripted = createScriptedConversation([
        () => stoppedReply(stopReason),
      ])
      const { session } = createSession(
        createStartedTwoPlayerGame(),
        scripted.conversation,
      )

      await expect(session.play('your turn')).rejects.toMatchObject({
        failure: stopReason,
      })
    }
  })

  it('fails when the model keeps calling tools without finishing', async () => {
    const scripted = createScriptedConversation([
      () => toolCallReply(SHOW_TOOL_NAME, {}),
    ])
    const { session } = createSession(
      createStartedTwoPlayerGame(),
      scripted.conversation,
    )

    await expect(session.play('your turn')).rejects.toMatchObject({
      failure: 'toolCallLimit',
    })
    expect(scripted.inputs).toHaveLength(MAX_TOOL_CALLS_PER_SESSION + 1)
  })

  it('stops without touching the game once aborted', async () => {
    const game = createStartedTwoPlayerGame()
    const scripted = createScriptedConversation([
      () => answerSetupChoiceReply(game, FIRST_TEST_PLAYER_ID),
    ])
    const { session, wait, abortController } = createSession(
      game,
      scripted.conversation,
    )
    const historyLengthBefore = game.history.length
    wait.mockImplementationOnce((): Promise<void> => {
      abortController.abort()
      return Promise.resolve()
    })

    await expect(session.play('your turn')).rejects.toThrow()

    expect(game.history.length).toBe(historyLengthBefore + 1)
    expect(game.state.pending[0]).toMatchObject({ seat: 0 })
  })
})
