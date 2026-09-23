import createClient from 'openapi-fetch'
import type { paths } from './schema.js'

export type { paths }
export type { components, operations } from './schema.js'

/**
 * Fallback when `ROOT_DEV_API` unset. Keep in sync with `.mise.toml` `[env] ROOT_DEV_API`.
 * Prod / Funnel URL lives only in `.mise.toml` as `ROOT_PROD_API`.
 */
export const DEFAULT_ROOT_DEV_API_BASE_URL = 'http://localhost:3000' as const

export const ROOT_DEV_API_ENV_KEY = 'ROOT_DEV_API' as const

export type RootWebClient = ReturnType<typeof createRootWebClient>

export type CreateRootWebClientOptions = {
  /** Base URL of @root/web (default: `ROOT_DEV_API` env, else {@link DEFAULT_ROOT_DEV_API_BASE_URL}). */
  baseUrl?: string
}

function readRootDevApiFromEnvironment(): string | undefined {
  const runtime = globalThis as {
    process?: { env?: Record<string, string | undefined> }
  }
  const value = runtime.process?.env?.[ROOT_DEV_API_ENV_KEY]
  if (typeof value !== 'string' || value.length === 0) {
    return undefined
  }
  return value
}

/** Resolve API base: explicit option → `ROOT_DEV_API` → local default. */
export function resolveRootDevApiBaseUrl(baseUrl?: string): string {
  return (
    baseUrl ?? readRootDevApiFromEnvironment() ?? DEFAULT_ROOT_DEV_API_BASE_URL
  )
}

/** Typed fetch client for the Hono OpenAPI surface. Shared by Phaser, CLI, etc. */
export function createRootWebClient(options: CreateRootWebClientOptions = {}) {
  return createClient<paths>({
    baseUrl: resolveRootDevApiBaseUrl(options.baseUrl),
  })
}
