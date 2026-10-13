import { describe, expect, it, vi } from 'vitest'
import { AI_PLAYER_TOOL_DEFINITIONS } from '#aiPlayer/aiPlayerTools.js'
import type { ModelConversation } from '#aiPlayer/ModelProvider.js'
import {
  createAnthropicProvider,
  type AnthropicMessageCreator,
  type AnthropicReplyMessage,
} from '#aiPlayer/providers/anthropicProvider.js'
import { createModelProvider } from '#aiPlayer/providers/providerRegistry.js'

type AnthropicReply = AnthropicReplyMessage

const TOOL_USE_REPLY: AnthropicReply = {
  stop_reason: 'tool_use',
  content: [
    {
      type: 'thinking',
      thinking: '',
      signature: 'thinking-signature',
    },
    { type: 'text', text: 'Checking my options.', citations: null },
    {
      type: 'tool_use',
      id: 'tool-use-1',
      name: 'actions',
      input: {},
      caller: { type: 'direct' },
    },
  ],
}

const END_TURN_REPLY: AnthropicReply = {
  stop_reason: 'end_turn',
  content: [{ type: 'text', text: 'Done.', citations: null }],
}

type ConversationFixture = {
  conversation: ModelConversation
  createMessage: ReturnType<typeof vi.fn<AnthropicMessageCreator>>
}

function createConversation(
  replies: readonly AnthropicReply[],
): ConversationFixture {
  const createMessage = vi.fn<AnthropicMessageCreator>()
  for (const reply of replies) {
    createMessage.mockResolvedValueOnce(reply)
  }
  const conversation = createAnthropicProvider(createMessage).startConversation({
    modelId: 'claude-opus-5-5',
    systemPrompt: 'You play Root.',
    tools: AI_PLAYER_TOOL_DEFINITIONS,
  })
  return { conversation, createMessage }
}

describe('anthropic provider', () => {
  it('sends model, system prompt and tools; maps tool calls back', async () => {
    const { conversation, createMessage } = createConversation([TOOL_USE_REPLY])
    const abortController = new AbortController()

    const reply = await conversation.send(
      { toolResults: [], text: 'your turn' },
      abortController.signal,
    )

    expect(reply).toEqual({
      stopReason: 'toolCalls',
      toolCalls: [{ callId: 'tool-use-1', name: 'actions', input: {} }],
      text: 'Checking my options.',
    })
    const [body, options] = createMessage.mock.calls[0] ?? []
    expect(body).toMatchObject({
      model: 'claude-opus-5-5',
      system: 'You play Root.',
      cache_control: { type: 'ephemeral' },
      messages: [{ role: 'user', content: [{ type: 'text', text: 'your turn' }] }],
    })
    expect(body?.tools).toMatchObject([
      { name: 'show' },
      { name: 'actions' },
      { name: 'log' },
      { name: 'rules' },
      { name: 'card' },
      { name: 'clearing' },
      { name: 'score' },
      { name: 'decree' },
      { name: 'preview' },
      {
        name: 'act',
        input_schema: { type: 'object', required: ['action'] },
      },
    ])
    expect(body).not.toHaveProperty('tool_choice')
    expect(options?.signal).toBe(abortController.signal)
  })

  it('keeps the whole history: the reply unchanged, then the tool results', async () => {
    const { conversation, createMessage } = createConversation([
      TOOL_USE_REPLY,
      END_TURN_REPLY,
    ])
    const abortSignal = new AbortController().signal
    await conversation.send({ toolResults: [], text: 'your turn' }, abortSignal)

    const reply = await conversation.send(
      {
        toolResults: [
          { callId: 'tool-use-1', content: 'NOT_YOUR_SEAT', isError: true },
        ],
        text: 'continue',
      },
      abortSignal,
    )

    expect(reply).toEqual({ stopReason: 'finished', toolCalls: [], text: 'Done.' })
    const messages = createMessage.mock.calls[1]?.[0].messages
    expect(messages).toHaveLength(3)
    expect(messages?.[1]).toEqual({
      role: 'assistant',
      content: TOOL_USE_REPLY.content,
    })
    expect(messages?.[2]).toEqual({
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: 'tool-use-1',
          content: 'NOT_YOUR_SEAT',
          is_error: true,
        },
        { type: 'text', text: 'continue' },
      ],
    })
  })

  it('asks for summarised thinking and hands it back as the reasoning', async () => {
    const { conversation, createMessage } = createConversation([
      {
        stop_reason: 'end_turn',
        content: [
          {
            type: 'thinking',
            thinking: 'The roost is undefended.',
            signature: 'thinking-signature',
          },
          { type: 'text', text: 'Done.', citations: null },
        ],
      },
    ])

    const reply = await conversation.send(
      { toolResults: [], text: 'your turn' },
      new AbortController().signal,
    )

    expect(reply.reasoning).toBe('The roost is undefended.')
    expect(createMessage.mock.calls[0]?.[0]).toMatchObject({
      thinking: { type: 'adaptive', display: 'summarized' },
    })
  })

  it('reports refusals and cut-off replies without tool calls', async () => {
    const { conversation } = createConversation([
      {
        ...TOOL_USE_REPLY,
        stop_reason: 'refusal',
        stop_details: {
          type: 'refusal',
          category: 'reasoning_extraction',
          explanation: 'Asked to reproduce internal reasoning.',
        },
      },
      { ...TOOL_USE_REPLY, stop_reason: 'max_tokens' },
    ])
    const abortSignal = new AbortController().signal

    const refused = await conversation.send(
      { toolResults: [], text: 'your turn' },
      abortSignal,
    )
    const truncated = await conversation.send(
      { toolResults: [], text: 'again' },
      abortSignal,
    )

    expect(refused).toMatchObject({
      stopReason: 'refused',
      toolCalls: [],
      stopDetail:
        'refusal · reasoning_extraction · Asked to reproduce internal reasoning.',
    })
    expect(truncated).toMatchObject({
      stopReason: 'truncated',
      toolCalls: [],
      stopDetail: 'max_tokens',
    })
  })

  it('does not record a failed request in the history', async () => {
    const { conversation, createMessage } = createConversation([])
    createMessage.mockRejectedValueOnce(new Error('network down'))
    createMessage.mockResolvedValueOnce(END_TURN_REPLY)
    const abortSignal = new AbortController().signal

    await expect(
      conversation.send({ toolResults: [], text: 'your turn' }, abortSignal),
    ).rejects.toThrow('network down')
    await conversation.send({ toolResults: [], text: 'retry' }, abortSignal)

    expect(createMessage.mock.calls[1]?.[0].messages).toHaveLength(1)
  })
})

describe('createModelProvider', () => {
  it('needs the API key of the provider', () => {
    expect(createModelProvider('anthropic', {})).toBeNull()
    expect(createModelProvider('anthropic', { ANTHROPIC_API_KEY: '' })).toBeNull()
    expect(
      createModelProvider('anthropic', { ANTHROPIC_API_KEY: 'test-key' }),
    ).not.toBeNull()
  })
})
