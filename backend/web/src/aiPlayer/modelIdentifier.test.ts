import { describe, expect, it } from 'vitest'
import {
  FALLBACK_DEFAULT_MODEL,
  formatModelIdentifier,
  listOfferedModels,
  parseModelIdentifier,
  resolveDefaultModel,
  type Environment,
} from '#aiPlayer/modelIdentifier.js'

function createEnvironment(overrides: Environment): Environment {
  return {
    ANTHROPIC_API_KEY: 'anthropic-test-key',
    OPENAI_API_KEY: 'openai-test-key',
    ...overrides,
  }
}

describe('parseModelIdentifier', () => {
  it('splits provider and model id', () => {
    expect(parseModelIdentifier('anthropic:claude-opus-5-5')).toEqual({
      provider: 'anthropic',
      modelId: 'claude-opus-5-5',
    })
  })

  it('keeps later separators inside the model id', () => {
    const parsed = parseModelIdentifier('openai:ft:custom-model')

    expect(parsed).toEqual({ provider: 'openai', modelId: 'ft:custom-model' })
    expect(parsed === null ? null : formatModelIdentifier(parsed)).toBe(
      'openai:ft:custom-model',
    )
  })

  it('rejects unknown providers, missing separator and empty model id', () => {
    expect(parseModelIdentifier('mistral:large')).toBeNull()
    expect(parseModelIdentifier('claude-opus-5-5')).toBeNull()
    expect(parseModelIdentifier('anthropic:')).toBeNull()
  })
})

describe('listOfferedModels', () => {
  it('offers the env list without malformed or duplicate entries', () => {
    const environment = createEnvironment({
      ROOT_AI_PLAYER_MODELS:
        'anthropic:claude-opus-5-5, openai:some-model,broken,anthropic:claude-opus-5-5',
    })

    expect(listOfferedModels(environment)).toEqual([
      'anthropic:claude-opus-5-5',
      'openai:some-model',
    ])
  })

  it('drops providers whose API key is missing', () => {
    const environment = createEnvironment({
      OPENAI_API_KEY: undefined,
      ROOT_AI_PLAYER_MODELS: 'anthropic:claude-opus-5-5,openai:some-model',
    })

    expect(listOfferedModels(environment)).toEqual([
      'anthropic:claude-opus-5-5',
    ])
  })

  it('offers only the default model when no list is configured', () => {
    expect(listOfferedModels(createEnvironment({}))).toEqual([
      FALLBACK_DEFAULT_MODEL,
    ])
  })
})

describe('resolveDefaultModel', () => {
  it('uses the configured default when it is offered', () => {
    const environment = createEnvironment({
      ROOT_AI_PLAYER_MODELS: 'anthropic:claude-opus-5-5,openai:some-model',
      ROOT_AI_PLAYER_DEFAULT_MODEL: 'openai:some-model',
    })

    expect(resolveDefaultModel(environment)).toBe('openai:some-model')
  })

  it('falls back to the first offered model', () => {
    const environment = createEnvironment({
      ANTHROPIC_API_KEY: undefined,
      ROOT_AI_PLAYER_MODELS: 'anthropic:claude-opus-5-5,openai:some-model',
    })

    expect(resolveDefaultModel(environment)).toBe('openai:some-model')
  })

  it('is null when no provider is configured', () => {
    const environment = createEnvironment({
      ANTHROPIC_API_KEY: undefined,
      OPENAI_API_KEY: undefined,
    })

    expect(resolveDefaultModel(environment)).toBeNull()
  })
})
