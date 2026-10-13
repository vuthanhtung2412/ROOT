import type Anthropic from '@anthropic-ai/sdk'
import {
  isJsonValue,
  type AiPlayerToolDefinition,
} from '#aiPlayer/aiPlayerTools.js'
import type {
  ModelConversation,
  ModelConversationRequest,
  ModelInput,
  ModelProvider,
  ModelReply,
  ModelStopReason,
  ModelToolCall,
  ModelToolResult,
} from '#aiPlayer/ModelProvider.js'

/** The one SDK call the provider needs; tests pass a mock. */
export type AnthropicMessageCreator = (
  body: Anthropic.MessageCreateParamsNonStreaming,
  options: { signal: AbortSignal },
) => Promise<Pick<Anthropic.Message, 'content' | 'stop_reason'>>

/** Room for thinking plus a few tool calls; stays under SDK HTTP timeouts. */
const MAX_OUTPUT_TOKENS = 16000
const OBJECT_SCHEMA_TYPE = 'object'
const TEXT_SEPARATOR = '\n'

function toAnthropicTool(definition: AiPlayerToolDefinition): Anthropic.Tool {
  return {
    name: definition.name,
    description: definition.description,
    input_schema: { ...definition.inputJsonSchema, type: OBJECT_SCHEMA_TYPE },
  }
}

function toUserContent(input: ModelInput): Anthropic.ContentBlockParam[] {
  // Tool results must come first in the message that answers the tool calls.
  const content: Anthropic.ContentBlockParam[] = input.toolResults.map(
    (result: ModelToolResult): Anthropic.ToolResultBlockParam => ({
      type: 'tool_result',
      tool_use_id: result.callId,
      content: result.content,
      is_error: result.isError,
    }),
  )
  if (input.text !== null) {
    content.push({ type: 'text', text: input.text })
  }
  return content
}

function toStopReason(stopReason: Anthropic.StopReason | null): ModelStopReason {
  switch (stopReason) {
    case 'tool_use':
      return 'toolCalls'
    case 'refusal':
      return 'refused'
    case 'max_tokens':
    case 'model_context_window_exceeded':
      return 'truncated'
    default:
      return 'finished'
  }
}

function toModelReply(
  message: Pick<Anthropic.Message, 'content' | 'stop_reason'>,
): ModelReply {
  const stopReason = toStopReason(message.stop_reason)
  const toolCalls: ModelToolCall[] = []
  const texts: string[] = []
  for (const block of message.content) {
    if (block.type === 'text') {
      texts.push(block.text)
    }
    if (block.type === 'tool_use' && isJsonValue(block.input)) {
      toolCalls.push({ callId: block.id, name: block.name, input: block.input })
    }
  }
  return {
    stopReason,
    // A cut-off or refused reply may hold half a tool call: run none of it.
    toolCalls: stopReason === 'toolCalls' ? toolCalls : [],
    text: texts.join(TEXT_SEPARATOR),
  }
}

class AnthropicConversation implements ModelConversation {
  private readonly createMessage: AnthropicMessageCreator
  private readonly request: ModelConversationRequest
  private readonly tools: Anthropic.Tool[]
  private messages: Anthropic.MessageParam[] = []

  constructor(
    createMessage: AnthropicMessageCreator,
    request: ModelConversationRequest,
  ) {
    this.createMessage = createMessage
    this.request = request
    this.tools = request.tools.map(toAnthropicTool)
  }

  async send(input: ModelInput, abortSignal: AbortSignal): Promise<ModelReply> {
    const messages: Anthropic.MessageParam[] = [
      ...this.messages,
      { role: 'user', content: toUserContent(input) },
    ]
    const message = await this.createMessage(
      {
        model: this.request.modelId,
        max_tokens: MAX_OUTPUT_TOKENS,
        // Caches the growing prefix: system prompt, tools and earlier messages.
        cache_control: { type: 'ephemeral' },
        system: this.request.systemPrompt,
        tools: this.tools,
        messages,
      },
      { signal: abortSignal },
    )
    // The whole reply goes back unchanged: thinking blocks must stay intact.
    this.messages = [
      ...messages,
      { role: 'assistant', content: message.content },
    ]
    return toModelReply(message)
  }
}

export function createAnthropicProvider(
  createMessage: AnthropicMessageCreator,
): ModelProvider {
  return {
    startConversation: (request: ModelConversationRequest): ModelConversation =>
      new AnthropicConversation(createMessage, request),
  }
}
