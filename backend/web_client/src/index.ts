import createClient from 'openapi-fetch'
import type { paths } from './schema.js'

export type { paths }
export type { components, operations } from './schema.js'

export const DEFAULT_ROOT_DEV_API_BASE_URL = 'http://localhost:3000' as const
export const ROOT_DEV_API_ENV_KEY = 'ROOT_DEV_API' as const

export type RootWebClient = ReturnType<typeof createRootWebClient>

export type CreateRootWebClientOptions = {
  baseUrl?: string
  request?: (request: Request) => Promise<Response>
}

function readRootDevApiFromEnvironment(): string | undefined {
  const processValue = Reflect.get(globalThis, 'process')
  if (typeof processValue !== 'object' || processValue === null) {
    return undefined
  }
  const environment = Reflect.get(processValue, 'env')
  if (typeof environment !== 'object' || environment === null) {
    return undefined
  }
  const value = Reflect.get(environment, ROOT_DEV_API_ENV_KEY)
  if (typeof value !== 'string' || value.length === 0) {
    return undefined
  }
  return value
}

export function resolveRootDevApiBaseUrl(baseUrl?: string): string {
  return (
    baseUrl ?? readRootDevApiFromEnvironment() ?? DEFAULT_ROOT_DEV_API_BASE_URL
  )
}

export function createRootWebClient(
  options: CreateRootWebClientOptions = {},
): ReturnType<typeof createClient<paths>> {
  return createClient<paths>({
    baseUrl: resolveRootDevApiBaseUrl(options.baseUrl),
    ...(options.request === undefined ? {} : { fetch: options.request }),
  })
}
