import { buildUnfinishedMessage } from '#aiPlayer/aiPlayerPrompt.js'
import {
  runAiPlayerTool,
  type AiPlayerToolContext,
} from '#aiPlayer/aiPlayerTools.js'
import type {
  ModelConversation,
  ModelInput,
  ModelToolCall,
  ModelToolResult,
} from '#aiPlayer/ModelProvider.js'
import { listPlayerLegalActions } from '#view/playerView.js'

/** Humans need time to follow what an AI player just did. */
export const AI_PLAYER_ACTION_DELAY_MILLISECONDS = 2000
/** A long turn is about 30 actions plus lookups; beyond this the model loops. */
export const MAX_TOOL_CALLS_PER_SESSION = 200
/** Times a model may end its reply while its seat still has to act. */
export const MAX_UNFINISHED_REPLIES = 3

export type AiPlayerSessionFailure =
  | 'refused'
  | 'truncated'
  | 'toolCallLimit'
  | 'stoppedWithoutActing'

/** The session cannot go on. The seat is stuck until the session restarts. */
export class AiPlayerSessionError extends Error {
  readonly failure: AiPlayerSessionFailure

  constructor(failure: AiPlayerSessionFailure) {
    super(failure)
    this.name = 'AiPlayerSessionError'
    this.failure = failure
  }
}

export type AiPlayerSessionArguments = {
  conversation: ModelConversation
  toolContext: AiPlayerToolContext
  abortSignal: AbortSignal
  wait: (milliseconds: number) => Promise<void>
}

/**
 * One context window of one AI seat: a whole turn, or one off-turn decision.
 * `play` runs until the seat has nothing left to do; calling it again later
 * continues in the same context.
 */
export class AiPlayerSession {
  private readonly conversation: ModelConversation
  private readonly toolContext: AiPlayerToolContext
  private readonly abortSignal: AbortSignal
  private readonly wait: (milliseconds: number) => Promise<void>
  /** Results the model has not read yet: they open the next message. */
  private unreadToolResults: readonly ModelToolResult[] = []
  private toolCallCount = 0

  constructor(sessionArguments: AiPlayerSessionArguments) {
    this.conversation = sessionArguments.conversation
    this.toolContext = sessionArguments.toolContext
    this.abortSignal = sessionArguments.abortSignal
    this.wait = sessionArguments.wait
  }

  /** Resolves when the seat has no legal action left. Rejects when aborted. */
  async play(message: string): Promise<void> {
    let input: ModelInput = { toolResults: this.unreadToolResults, text: message }
    this.unreadToolResults = []
    let unfinishedReplyCount = 0
    for (;;) {
      const reply = await this.conversation.send(input, this.abortSignal)
      this.abortSignal.throwIfAborted()
      if (reply.stopReason === 'refused' || reply.stopReason === 'truncated') {
        throw new AiPlayerSessionError(reply.stopReason)
      }
      if (reply.toolCalls.length === 0) {
        if (!this.seatMayAct()) {
          return
        }
        unfinishedReplyCount += 1
        if (unfinishedReplyCount > MAX_UNFINISHED_REPLIES) {
          throw new AiPlayerSessionError('stoppedWithoutActing')
        }
        input = { toolResults: [], text: buildUnfinishedMessage() }
        continue
      }
      const toolResults = await this.runToolCalls(reply.toolCalls)
      if (!this.seatMayAct()) {
        this.unreadToolResults = toolResults
        return
      }
      input = { toolResults, text: null }
    }
  }

  private seatMayAct(): boolean {
    return (
      listPlayerLegalActions(this.toolContext.game, this.toolContext.playerId)
        .length > 0
    )
  }

  private async runToolCalls(
    toolCalls: readonly ModelToolCall[],
  ): Promise<ModelToolResult[]> {
    const toolResults: ModelToolResult[] = []
    for (const toolCall of toolCalls) {
      this.toolCallCount += 1
      if (this.toolCallCount > MAX_TOOL_CALLS_PER_SESSION) {
        throw new AiPlayerSessionError('toolCallLimit')
      }
      const result = runAiPlayerTool(this.toolContext, toolCall)
      toolResults.push({
        callId: toolCall.callId,
        content: result.content,
        isError: result.isError,
      })
      if (result.appliedAction) {
        await this.wait(AI_PLAYER_ACTION_DELAY_MILLISECONDS)
        this.abortSignal.throwIfAborted()
      }
    }
    return toolResults
  }
}
