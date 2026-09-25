import { cors } from 'hono/cors'
import type { MiddlewareHandler } from 'hono'

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
 * React Vite (localhost + LAN) + Capacitor native shells.
 */
export function isAllowedCorsOrigin(origin: string): boolean {
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
  allowHeaders: ['Content-Type'],
})
