import type {
  AiPlayerToolDefinition,
  JsonValue,
} from '#aiPlayer/aiPlayerTools.js'

/** A tool call the model asks for. `callId` pairs it with its result. */
export type ModelToolCall = {
  callId: string
  name: string
  input: JsonValue
}

export type ModelToolResult = {
  callId: string
  content: string
  isError: boolean
}

/** One message to the model: results of its last tool calls and/or new text. */
export type ModelInput = {
  toolResults: readonly ModelToolResult[]
  text: string | null
}

/**
 * `toolCalls`: the model waits for tool results. `finished`: it ended its
 * reply. `refused` / `truncated`: the reply is unusable.
 */
export type ModelStopReason = 'toolCalls' | 'finished' | 'refused' | 'truncated'

export type ModelReply = {
  stopReason: ModelStopReason
  toolCalls: readonly ModelToolCall[]
  text: string
  /** The provider's summary of the thinking behind this reply, when it gives one. */
  reasoning?: string
  /** What the provider says about a `refused` / `truncated` stop, when it says anything. */
  stopDetail?: string
}

export type ModelConversationRequest = {
  /** Provider-side model id, without the provider prefix. */
  modelId: string
  systemPrompt: string
  tools: readonly AiPlayerToolDefinition[]
}

/**
 * One context window. The provider keeps the full native history, so every
 * `send` continues where the last reply ended.
 */
export interface ModelConversation {
  send(input: ModelInput, abortSignal: AbortSignal): Promise<ModelReply>
}

/** One LLM vendor. Add a vendor = implement this + register it. */
export interface ModelProvider {
  startConversation(request: ModelConversationRequest): ModelConversation
}
