import { afterEach, describe, expect, it, vi } from 'vitest'

const isNativePlatform = vi.fn(() => false)

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => isNativePlatform(),
  },
}))

describe('resolveDefaultApiBaseUrl', () => {
  afterEach(() => {
    isNativePlatform.mockReset()
    isNativePlatform.mockReturnValue(false)
    vi.unstubAllEnvs()
  })

  it('returns empty string in browser', async () => {
    isNativePlatform.mockReturnValue(false)
    vi.stubEnv('ROOT_PROD_API', 'https://funnel.example.ts.net:8443')
    const { resolveDefaultApiBaseUrl } = await import(
      '#api/defaultApiBaseUrl.ts'
    )
    expect(resolveDefaultApiBaseUrl()).toBe('')
  })

  it('returns web API URL in browser when env set', async () => {
    isNativePlatform.mockReturnValue(false)
    vi.stubEnv('ROOT_WEB_API', 'https://api.example.com/')
    vi.resetModules()
    const { resolveDefaultApiBaseUrl } = await import(
      '#api/defaultApiBaseUrl.ts'
    )
    expect(resolveDefaultApiBaseUrl()).toBe('https://api.example.com')
  })

  it('returns prod API URL on native when env set', async () => {
    isNativePlatform.mockReturnValue(true)
    vi.stubEnv('ROOT_PROD_API', 'https://funnel.example.ts.net:8443/')
    vi.resetModules()
    const { resolveDefaultApiBaseUrl } = await import(
      '#api/defaultApiBaseUrl.ts'
    )
    expect(resolveDefaultApiBaseUrl()).toBe(
      'https://funnel.example.ts.net:8443',
    )
  })

  it('returns empty on native when prod API env missing', async () => {
    isNativePlatform.mockReturnValue(true)
    vi.stubEnv('ROOT_PROD_API', '')
    vi.resetModules()
    const { resolveDefaultApiBaseUrl } = await import(
      '#api/defaultApiBaseUrl.ts'
    )
    expect(resolveDefaultApiBaseUrl()).toBe('')
  })
})
