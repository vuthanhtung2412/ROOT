import { describe, expect, it, vi } from 'vitest'
import { AI_PLAYER_TOOL_DEFINITIONS } from '#aiPlayer/aiPlayerTools.js'
import type { ModelConversation } from '#aiPlayer/ModelProvider.js'
import {
  createOpenAiProvider,
  type OpenAiResponseCreator,
} from '#aiPlayer/providers/openAiProvider.js'
import { createModelProvider } from '#aiPlayer/providers/providerRegistry.js'

type OpenAiReply = Awaited<ReturnType<OpenAiResponseCreator>>

function createFunctionCallReply(argumentsJson: string): OpenAiReply {
  return {
    id: 'response-1',
    status: 'completed',
    output_text: '',
    output: [
      {
        type: 'function_call',
        call_id: 'call-1',
        name: 'act',
        arguments: argumentsJson,
      },
    ],
  }
}

const FINISHED_REPLY: OpenAiReply = {
  id: 'response-2',
  status: 'completed',
  output_text: 'Done.',
  output: [],
}

type ConversationFixture = {
  conversation: ModelConversation
  createResponse: ReturnType<typeof vi.fn<OpenAiResponseCreator>>
}

function createConversation(
  replies: readonly OpenAiReply[],
): ConversationFixture {
  const createResponse = vi.fn<OpenAiResponseCreator>()
  for (const reply of replies) {
    createResponse.mockResolvedValueOnce(reply)
  }
  const conversation = createOpenAiProvider(createResponse).startConversation({
    modelId: 'some-model',
    systemPrompt: 'You play Root.',
    tools: AI_PLAYER_TOOL_DEFINITIONS,
  })
  return { conversation, createResponse }
}

describe('openai provider', () => {
  it('sends model, instructions and function tools; maps tool calls back', async () => {
    const { conversation, createResponse } = createConversation([
      createFunctionCallReply('{"action":{"type":"endPhase"}}'),
    ])
    const abortController = new AbortController()

    const reply = await conversation.send(
      { toolResults: [], text: 'your turn' },
      abortController.signal,
    )

    expect(reply).toEqual({
      stopReason: 'toolCalls',
      toolCalls: [
        {
          callId: 'call-1',
          name: 'act',
          input: { action: { type: 'endPhase' } },
        },
      ],
      text: '',
    })
    const [body, options] = createResponse.mock.calls[0] ?? []
    expect(body).toMatchObject({
      model: 'some-model',
      instructions: 'You play Root.',
      input: [{ role: 'user', content: 'your turn' }],
      previous_response_id: null,
    })
    expect(body?.tools).toMatchObject([
      { type: 'function', name: 'show' },
      { type: 'function', name: 'actions' },
      { type: 'function', name: 'log' },
      { type: 'function', name: 'rules' },
      { type: 'function', name: 'card' },
      { type: 'function', name: 'preview' },
      {
        type: 'function',
        name: 'act',
        strict: false,
        parameters: { type: 'object', required: ['action'] },
      },
    ])
    expect(options?.signal).toBe(abortController.signal)
  })

  it('continues the same context by response id, sending tool results first', async () => {
    const { conversation, createResponse } = createConversation([
      createFunctionCallReply('{}'),
      FINISHED_REPLY,
    ])
    const abortSignal = new AbortController().signal
    await conversation.send({ toolResults: [], text: 'your turn' }, abortSignal)

    const reply = await conversation.send(
      {
        toolResults: [
          { callId: 'call-1', content: 'NOT_YOUR_SEAT', isError: true },
        ],
        text: 'continue',
      },
      abortSignal,
    )

    expect(reply).toEqual({ stopReason: 'finished', toolCalls: [], text: 'Done.' })
    expect(createResponse.mock.calls[1]?.[0]).toMatchObject({
      previous_response_id: 'response-1',
      instructions: 'You play Root.',
      input: [
        {
          type: 'function_call_output',
          call_id: 'call-1',
          output: 'ERROR: NOT_YOUR_SEAT',
        },
        { role: 'user', content: 'continue' },
      ],
    })
  })

  it('passes unparseable arguments on as null so the tool rejects them', async () => {
    const { conversation } = createConversation([
      createFunctionCallReply('{"action":'),
    ])

    const reply = await conversation.send(
      { toolResults: [], text: 'your turn' },
      new AbortController().signal,
    )

    expect(reply.toolCalls[0]?.input).toBeNull()
  })

  it('reports cut-off replies and refusals without tool calls', async () => {
    const { conversation } = createConversation([
      { ...createFunctionCallReply('{}'), status: 'incomplete' },
      {
        id: 'response-3',
        status: 'completed',
        output_text: '',
        output: [
          {
            type: 'message',
            id: 'message-1',
            role: 'assistant',
            status: 'completed',
            content: [{ type: 'refusal', refusal: 'No.' }],
          },
        ],
      },
    ])
    const abortSignal = new AbortController().signal

    const truncated = await conversation.send(
      { toolResults: [], text: 'your turn' },
      abortSignal,
    )
    const refused = await conversation.send(
      { toolResults: [], text: 'again' },
      abortSignal,
    )

    expect(truncated).toMatchObject({ stopReason: 'truncated', toolCalls: [] })
    expect(refused).toMatchObject({
      stopReason: 'refused',
      toolCalls: [],
      stopDetail: 'No.',
    })
  })
})

describe('createModelProvider', () => {
  it('needs the API key of the provider', () => {
    expect(createModelProvider('openai', {})).toBeNull()
    expect(
      createModelProvider('openai', { OPENAI_API_KEY: 'test-key' }),
    ).not.toBeNull()
  })
})
