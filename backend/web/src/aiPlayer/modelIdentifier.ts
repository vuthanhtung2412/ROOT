/** Providers an AI player model may come from. */
export const MODEL_PROVIDER_NAMES = ['anthropic', 'openai'] as const

export type ModelProviderName = (typeof MODEL_PROVIDER_NAMES)[number]

/** `<provider>:<modelId>`, e.g. `anthropic:claude-opus-5-5`. */
export type ModelIdentifier = {
  provider: ModelProviderName
  modelId: string
}

export type Environment = Readonly<Record<string, string | undefined>>

const PROVIDER_SEPARATOR = ':'
const MODEL_LIST_SEPARATOR = ','

/** Server-only secrets. Never sent to a client. */
export const PROVIDER_API_KEY_ENVIRONMENT_KEYS: Readonly<
  Record<ModelProviderName, string>
> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
}

/** Comma list of `<provider>:<modelId>` offered in the lobby. */
export const OFFERED_MODELS_ENVIRONMENT_KEY = 'ROOT_AI_PLAYER_MODELS'
export const DEFAULT_MODEL_ENVIRONMENT_KEY = 'ROOT_AI_PLAYER_DEFAULT_MODEL'
export const FALLBACK_DEFAULT_MODEL = 'anthropic:claude-opus-5-5'

function isModelProviderName(value: string): value is ModelProviderName {
  return MODEL_PROVIDER_NAMES.some(
    (provider: ModelProviderName): boolean => provider === value,
  )
}

export function parseModelIdentifier(text: string): ModelIdentifier | null {
  const separatorIndex = text.indexOf(PROVIDER_SEPARATOR)
  if (separatorIndex < 0) {
    return null
  }
  const provider = text.slice(0, separatorIndex).trim()
  const modelId = text.slice(separatorIndex + PROVIDER_SEPARATOR.length).trim()
  if (!isModelProviderName(provider) || modelId === '') {
    return null
  }
  return { provider, modelId }
}

export function formatModelIdentifier(model: ModelIdentifier): string {
  return `${model.provider}${PROVIDER_SEPARATOR}${model.modelId}`
}

function isProviderConfigured(
  provider: ModelProviderName,
  environment: Environment,
): boolean {
  const apiKey = environment[PROVIDER_API_KEY_ENVIRONMENT_KEYS[provider]]
  return apiKey !== undefined && apiKey !== ''
}

function configuredDefaultModel(environment: Environment): string {
  return environment[DEFAULT_MODEL_ENVIRONMENT_KEY] ?? FALLBACK_DEFAULT_MODEL
}

/**
 * Models a lobby may pick: the env list (or just the default when unset),
 * minus malformed ids and providers whose API key is missing.
 */
export function listOfferedModels(environment: Environment): string[] {
  const configured =
    environment[OFFERED_MODELS_ENVIRONMENT_KEY] ??
    configuredDefaultModel(environment)
  const offered: string[] = []
  for (const entry of configured.split(MODEL_LIST_SEPARATOR)) {
    const model = parseModelIdentifier(entry)
    if (model === null || !isProviderConfigured(model.provider, environment)) {
      continue
    }
    const formatted = formatModelIdentifier(model)
    if (!offered.includes(formatted)) {
      offered.push(formatted)
    }
  }
  return offered
}

/** The configured default when it is offered, else the first offered model. */
export function resolveDefaultModel(environment: Environment): string | null {
  const offered = listOfferedModels(environment)
  const configured = parseModelIdentifier(configuredDefaultModel(environment))
  if (configured !== null) {
    const formatted = formatModelIdentifier(configured)
    if (offered.includes(formatted)) {
      return formatted
    }
  }
  return offered[0] ?? null
}
