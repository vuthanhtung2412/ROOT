import { cors } from 'hono/cors'
import type { MiddlewareHandler } from 'hono'

/**
 * Allow Phaser Vite origins (localhost + LAN) to call REST.
 * WebSocket upgrade is same-host or proxied; CORS covers browser fetch.
 */
export const corsMiddleware: MiddlewareHandler = cors({
  origin: (origin) => {
    if (origin === undefined || origin === '') {
      return origin
    }
    if (
      origin.startsWith('http://localhost:') ||
      origin.startsWith('http://127.0.0.1:') ||
      /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}:\d+$/.test(origin) ||
      /^http:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d+$/.test(origin)
    ) {
      return origin
    }
    return null
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
})
