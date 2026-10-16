import { describe, expect, it } from 'vitest'
import {
  EXTRA_CORS_ORIGINS_ENVIRONMENT_KEY,
  isAllowedCorsOrigin,
} from '#middleware/cors.js'
import { app } from '#openapi.js'
import type { Environment } from '#aiPlayer/modelIdentifier.js'

const GITHUB_PAGES_ORIGIN: string = 'https://vuthanhtung2412.github.io'

describe('isAllowedCorsOrigin', () => {
  it('allows origins listed in the environment', () => {
    const environment: Environment = {
      [EXTRA_CORS_ORIGINS_ENVIRONMENT_KEY]: ` ${GITHUB_PAGES_ORIGIN} , https://other.example`,
    }
    expect(isAllowedCorsOrigin(GITHUB_PAGES_ORIGIN, environment)).toBe(true)
    expect(isAllowedCorsOrigin('https://other.example', environment)).toBe(true)
    expect(isAllowedCorsOrigin(GITHUB_PAGES_ORIGIN, {})).toBe(false)
  })

  it('allows Capacitor and Ionic WebView origins', () => {
    expect(isAllowedCorsOrigin('capacitor://localhost')).toBe(true)
    expect(isAllowedCorsOrigin('ionic://localhost')).toBe(true)
    expect(isAllowedCorsOrigin('http://localhost')).toBe(true)
    expect(isAllowedCorsOrigin('https://localhost')).toBe(true)
  })

  it('allows Vite localhost and LAN HTTP origins', () => {
    expect(isAllowedCorsOrigin('http://localhost:5173')).toBe(true)
    expect(isAllowedCorsOrigin('http://127.0.0.1:3000')).toBe(true)
    expect(isAllowedCorsOrigin('http://192.168.1.5:5173')).toBe(true)
    expect(isAllowedCorsOrigin('http://10.0.0.2:3000')).toBe(true)
  })

  it('allows the player id header on preflight', async () => {
    const preflight = await app.request('/game/actions', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:5173',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'X-Player-Id',
      },
    })
    expect(preflight.headers.get('Access-Control-Allow-Headers')).toContain(
      'X-Player-Id',
    )
  })

  it('rejects unrelated origins', () => {
    expect(isAllowedCorsOrigin('https://evil.example')).toBe(false)
    expect(isAllowedCorsOrigin('capacitor://evil')).toBe(false)
    expect(isAllowedCorsOrigin('http://172.16.0.1:3000')).toBe(false)
  })
})
