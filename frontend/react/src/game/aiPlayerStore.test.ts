import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AiPlayer } from '#api/client.ts'
import {
  findAiPlayer,
  getAiPlayerSnapshot,
  modelDisplayName,
  setAiModels,
  setAiPlayers,
  subscribeAiPlayers,
} from '#game/aiPlayerStore.ts'

function makeAiPlayer(overrides: Partial<AiPlayer> = {}): AiPlayer {
  return {
    seat: 1,
    model: 'anthropic:claude-opus-5-5',
    status: 'idle',
    ...overrides,
  }
}

describe('aiPlayerStore', () => {
  afterEach((): void => {
    setAiPlayers([])
    setAiModels({ models: [], defaultModel: null })
  })

  it('notifies only when an AI seat really changed', () => {
    const listener = vi.fn<() => void>()
    const unsubscribe = subscribeAiPlayers(listener)

    setAiPlayers([makeAiPlayer()])
    setAiPlayers([makeAiPlayer()])
    expect(listener).toHaveBeenCalledTimes(1)

    setAiPlayers([makeAiPlayer({ status: 'thinking' })])
    expect(listener).toHaveBeenCalledTimes(2)
    expect(getAiPlayerSnapshot().aiPlayers[0]?.status).toBe('thinking')

    unsubscribe()
    setAiPlayers([])
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('keeps the offered models next to the seats', () => {
    setAiPlayers([makeAiPlayer()])

    setAiModels({
      models: ['anthropic:claude-opus-5-5', 'openai:some-model'],
      defaultModel: 'openai:some-model',
    })

    expect(getAiPlayerSnapshot()).toEqual({
      aiPlayers: [makeAiPlayer()],
      models: ['anthropic:claude-opus-5-5', 'openai:some-model'],
      defaultModel: 'openai:some-model',
    })
  })

  it('finds the AI player of a seat', () => {
    const aiPlayers: AiPlayer[] = [makeAiPlayer({ seat: 2 })]

    expect(findAiPlayer(aiPlayers, 2)).toEqual(makeAiPlayer({ seat: 2 }))
    expect(findAiPlayer(aiPlayers, 0)).toBeNull()
  })

  it('shows a model without its provider', () => {
    expect(modelDisplayName('anthropic:claude-opus-5-5')).toBe('claude-opus-5-5')
    expect(modelDisplayName('openai:ft:custom')).toBe('ft:custom')
    expect(modelDisplayName('plain-model')).toBe('plain-model')
  })
})
