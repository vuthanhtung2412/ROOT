import createClient from 'openapi-fetch'
import type { paths } from './schema.js'

export type { paths }
export type { components, operations } from './schema.js'

export type RootWebClient = ReturnType<typeof createRootWebClient>

export type CreateRootWebClientOptions = {
  /** Base URL of @root/web (default: http://localhost:3000). */
  baseUrl?: string
}

/** Typed fetch client for the Hono OpenAPI surface. Shared by Phaser, CLI, etc. */
export function createRootWebClient(options: CreateRootWebClientOptions = {}) {
  const baseUrl = options.baseUrl ?? process.env.ROOT_API ?? 'http://localhost:3000'
  return createClient<paths>({ baseUrl })
}
