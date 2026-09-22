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
    vi.stubEnv('ROOT_FUNNEL_URL', 'https://funnel.example.ts.net:8443')
    const { resolveDefaultApiBaseUrl } = await import(
      '#api/defaultApiBaseUrl.ts'
    )
    expect(resolveDefaultApiBaseUrl()).toBe('')
  })

  it('returns funnel URL on native when env set', async () => {
    isNativePlatform.mockReturnValue(true)
    vi.stubEnv('ROOT_FUNNEL_URL', 'https://funnel.example.ts.net:8443/')
    vi.resetModules()
    const { resolveDefaultApiBaseUrl } = await import(
      '#api/defaultApiBaseUrl.ts'
    )
    expect(resolveDefaultApiBaseUrl()).toBe(
      'https://funnel.example.ts.net:8443',
    )
  })

  it('returns empty on native when funnel env missing', async () => {
    isNativePlatform.mockReturnValue(true)
    vi.stubEnv('ROOT_FUNNEL_URL', '')
    vi.resetModules()
    const { resolveDefaultApiBaseUrl } = await import(
      '#api/defaultApiBaseUrl.ts'
    )
    expect(resolveDefaultApiBaseUrl()).toBe('')
  })
})
