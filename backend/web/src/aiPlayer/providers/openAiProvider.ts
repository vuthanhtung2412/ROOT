import type OpenAI from 'openai'
import {
  isJsonValue,
  type AiPlayerToolDefinition,
  type JsonValue,
} from '#aiPlayer/aiPlayerTools.js'
import type {
  ModelConversation,
  ModelConversationRequest,
  ModelInput,
  ModelProvider,
  ModelReply,
  ModelToolCall,
  ModelToolResult,
} from '#aiPlayer/ModelProvider.js'

type OpenAiResponse = Pick<
  OpenAI.Responses.Response,
  'id' | 'status' | 'output' | 'output_text'
>

/** The one SDK call the provider needs; tests pass a mock. */
export type OpenAiResponseCreator = (
  body: OpenAI.Responses.ResponseCreateParamsNonStreaming,
  options: { signal: AbortSignal },
) => Promise<OpenAiResponse>

/** Arguments that are not JSON reach the tool as this, and fail its input check. */
const UNPARSEABLE_ARGUMENTS: JsonValue = null

function toOpenAiTool(
  definition: AiPlayerToolDefinition,
): OpenAI.Responses.FunctionTool {
  return {
    type: 'function',
    name: definition.name,
    description: definition.description,
    parameters: { ...definition.inputJsonSchema },
    // The `act` tool takes any action shape; strict mode would forbid that.
    strict: false,
  }
}

function toInputItems(input: ModelInput): OpenAI.Responses.ResponseInput {
  const items: OpenAI.Responses.ResponseInput = input.toolResults.map(
    (
      result: ModelToolResult,
    ): OpenAI.Responses.ResponseInputItem.FunctionCallOutput => ({
      type: 'function_call_output',
      call_id: result.callId,
      // No error flag on this API: the text itself says the call failed.
      output: result.isError ? `ERROR: ${result.content}` : result.content,
    }),
  )
  if (input.text !== null) {
    items.push({ role: 'user', content: input.text })
  }
  return items
}

function parseArguments(argumentsJson: string): JsonValue {
  try {
    const parsed: unknown = JSON.parse(argumentsJson)
    return isJsonValue(parsed) ? parsed : UNPARSEABLE_ARGUMENTS
  } catch {
    return UNPARSEABLE_ARGUMENTS
  }
}

const REFUSAL_SEPARATOR = '\n'

/** Every refusal the model wrote; empty when it refused nothing. */
function refusalTexts(response: OpenAiResponse): string[] {
  const texts: string[] = []
  for (const item of response.output) {
    if (item.type !== 'message') {
      continue
    }
    for (const part of item.content) {
      if (part.type === 'refusal') {
        texts.push(part.refusal)
      }
    }
  }
  return texts
}

function toModelReply(response: OpenAiResponse): ModelReply {
  if (response.status !== 'completed') {
    // `incomplete` = output limit hit; anything else is equally unusable.
    return {
      stopReason: 'truncated',
      toolCalls: [],
      text: response.output_text,
      stopDetail: `status ${String(response.status)}`,
    }
  }
  const refusals: string[] = refusalTexts(response)
  if (refusals.length > 0) {
    return {
      stopReason: 'refused',
      toolCalls: [],
      text: response.output_text,
      stopDetail: refusals.join(REFUSAL_SEPARATOR),
    }
  }
  const toolCalls: ModelToolCall[] = []
  for (const item of response.output) {
    if (item.type === 'function_call') {
      toolCalls.push({
        callId: item.call_id,
        name: item.name,
        input: parseArguments(item.arguments),
      })
    }
  }
  return {
    stopReason: toolCalls.length > 0 ? 'toolCalls' : 'finished',
    toolCalls,
    text: response.output_text,
  }
}

class OpenAiConversation implements ModelConversation {
  private readonly createResponse: OpenAiResponseCreator
  private readonly request: ModelConversationRequest
  private readonly tools: OpenAI.Responses.FunctionTool[]
  /** The API keeps the history (reasoning included) under this id. */
  private previousResponseId: string | null = null

  constructor(
    createResponse: OpenAiResponseCreator,
    request: ModelConversationRequest,
  ) {
    this.createResponse = createResponse
    this.request = request
    this.tools = request.tools.map(toOpenAiTool)
  }

  async send(input: ModelInput, abortSignal: AbortSignal): Promise<ModelReply> {
    const response = await this.createResponse(
      {
        model: this.request.modelId,
        // Not carried over by `previous_response_id`: sent on every request.
        instructions: this.request.systemPrompt,
        tools: this.tools,
        input: toInputItems(input),
        previous_response_id: this.previousResponseId,
      },
      { signal: abortSignal },
    )
    this.previousResponseId = response.id
    return toModelReply(response)
  }
}

export function createOpenAiProvider(
  createResponse: OpenAiResponseCreator,
): ModelProvider {
  return {
    startConversation: (request: ModelConversationRequest): ModelConversation =>
      new OpenAiConversation(createResponse, request),
  }
}
