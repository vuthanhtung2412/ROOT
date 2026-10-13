import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import {
  PROVIDER_API_KEY_ENVIRONMENT_KEYS,
  type Environment,
  type ModelProviderName,
} from '#aiPlayer/modelIdentifier.js'
import type { ModelProvider } from '#aiPlayer/ModelProvider.js'
import { createAnthropicProvider } from '#aiPlayer/providers/anthropicProvider.js'
import { createOpenAiProvider } from '#aiPlayer/providers/openAiProvider.js'

/** Builds a provider from its API key. One entry per vendor. */
const PROVIDER_FACTORIES: Readonly<
  Record<ModelProviderName, (apiKey: string) => ModelProvider>
> = {
  openai: (apiKey: string): ModelProvider => {
    const client = new OpenAI({ apiKey })
    return createOpenAiProvider((body, options) =>
      client.responses.create(body, options),
    )
  },
  anthropic: (apiKey: string): ModelProvider => {
    const client = new Anthropic({ apiKey })
    return createAnthropicProvider((body, options) =>
      client.messages.create(body, options),
    )
  },
}

/** Null when the server has no API key for that provider. */
export function createModelProvider(
  providerName: ModelProviderName,
  environment: Environment,
): ModelProvider | null {
  const apiKey = environment[PROVIDER_API_KEY_ENVIRONMENT_KEYS[providerName]]
  if (apiKey === undefined || apiKey === '') {
    return null
  }
  return PROVIDER_FACTORIES[providerName](apiKey)
}
