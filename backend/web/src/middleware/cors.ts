import { cors } from 'hono/cors'
import type { MiddlewareHandler } from 'hono'
import { PLAYER_ID_HEADER } from '#view/actionSeatGuard.js'
import type { Environment } from '#aiPlayer/modelIdentifier.js'

/** Comma list of extra origins, e.g. `https://vuthanhtung2412.github.io`. */
export const EXTRA_CORS_ORIGINS_ENVIRONMENT_KEY = 'ROOT_CORS_ORIGINS'
const ORIGIN_LIST_SEPARATOR = ','

function listExtraCorsOrigins(environment: Environment): string[] {
  const configured = environment[EXTRA_CORS_ORIGINS_ENVIRONMENT_KEY] ?? ''
  return configured
    .split(ORIGIN_LIST_SEPARATOR)
    .map((entry: string): string => entry.trim())
    .filter((entry: string): boolean => entry !== '')
}

/** Capacitor WKWebView / Android WebView origins (no port). */
const CAPACITOR_APP_ORIGINS: ReadonlySet<string> = new Set([
  'capacitor://localhost',
  'ionic://localhost',
  'http://localhost',
  'https://localhost',
])

const LAN_HTTP_ORIGIN_PATTERN =
  /^http:\/\/(?:192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}):\d+$/

/**
 * Whether a browser/WebView Origin may call the REST API.
 * React Vite (localhost + LAN) + Capacitor native shells + `ROOT_CORS_ORIGINS`.
 */
export function isAllowedCorsOrigin(
  origin: string,
  environment: Environment = process.env,
): boolean {
  if (listExtraCorsOrigins(environment).includes(origin)) {
    return true
  }
  if (CAPACITOR_APP_ORIGINS.has(origin)) {
    return true
  }
  if (
    origin.startsWith('http://localhost:') ||
    origin.startsWith('http://127.0.0.1:')
  ) {
    return true
  }
  return LAN_HTTP_ORIGIN_PATTERN.test(origin)
}

/**
 * Allow React Vite + Capacitor origins to call REST.
 * WebSocket upgrade is same-host or proxied; CORS covers browser fetch.
 */
export const corsMiddleware: MiddlewareHandler = cors({
  origin: (origin) => {
    if (origin === undefined || origin === '') {
      return origin
    }
    if (isAllowedCorsOrigin(origin)) {
      return origin
    }
    return null
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', PLAYER_ID_HEADER],
})
