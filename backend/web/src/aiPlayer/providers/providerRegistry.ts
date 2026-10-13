import Anthropic from '@anthropic-ai/sdk'
import {
  PROVIDER_API_KEY_ENVIRONMENT_KEYS,
  type Environment,
  type ModelProviderName,
} from '#aiPlayer/modelIdentifier.js'
import type { ModelProvider } from '#aiPlayer/ModelProvider.js'
import { createAnthropicProvider } from '#aiPlayer/providers/anthropicProvider.js'

/** Builds a provider from its API key. One entry per vendor. */
const PROVIDER_FACTORIES: Readonly<
  Partial<Record<ModelProviderName, (apiKey: string) => ModelProvider>>
> = {
  anthropic: (apiKey: string): ModelProvider => {
    const client = new Anthropic({ apiKey })
    return createAnthropicProvider((body, options) =>
      client.messages.create(body, options),
    )
  },
}

/** Null when the server has no API key (or no adapter) for that provider. */
export function createModelProvider(
  providerName: ModelProviderName,
  environment: Environment,
): ModelProvider | null {
  const apiKey = environment[PROVIDER_API_KEY_ENVIRONMENT_KEYS[providerName]]
  const createProvider = PROVIDER_FACTORIES[providerName]
  if (apiKey === undefined || apiKey === '' || createProvider === undefined) {
    return null
  }
  return createProvider(apiKey)
}
