import type { AiPlayerSessionActivity } from '#aiPlayer/AiPlayerActivityFeed.js'
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
  /** False once what the session is for (its turn, its decision) is over. */
  isInScope: () => boolean
  /** Told of every message, reply and tool call, as it happens. */
  onActivity: (activity: AiPlayerSessionActivity) => void
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
  private readonly isInScope: () => boolean
  private readonly onActivity: (activity: AiPlayerSessionActivity) => void
  /** Results the model has not read yet: they open the next message. */
  private unreadToolResults: readonly ModelToolResult[] = []
  private toolCallCount = 0

  constructor(sessionArguments: AiPlayerSessionArguments) {
    this.conversation = sessionArguments.conversation
    this.toolContext = sessionArguments.toolContext
    this.abortSignal = sessionArguments.abortSignal
    this.wait = sessionArguments.wait
    this.isInScope = sessionArguments.isInScope
    this.onActivity = sessionArguments.onActivity
  }

  /**
   * Resolves when the seat has no legal action left or the session's scope is
   * over. Rejects when aborted.
   */
  async play(message: string): Promise<void> {
    let input: ModelInput = { toolResults: this.unreadToolResults, text: message }
    this.unreadToolResults = []
    let unfinishedReplyCount = 0
    for (;;) {
      if (input.text !== null) {
        this.report('message', input.text)
      }
      const reply = await this.conversation.send(input, this.abortSignal)
      this.abortSignal.throwIfAborted()
      if (reply.text !== '') {
        this.report('reply', reply.text)
      }
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

  private report(kind: 'message' | 'reply', text: string): void {
    this.onActivity({ kind, toolName: null, text, isError: false })
  }

  private seatMayAct(): boolean {
    return (
      this.isInScope() &&
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
      this.onActivity({
        kind: 'toolCall',
        toolName: toolCall.name,
        text: JSON.stringify(toolCall.input),
        isError: false,
      })
      const result = runAiPlayerTool(this.toolContext, toolCall)
      this.onActivity({
        kind: 'toolResult',
        toolName: toolCall.name,
        text: result.content,
        isError: result.isError,
      })
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
