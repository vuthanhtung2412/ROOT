import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ASSET_FETCH_RETRY_COUNT,
  ASSET_FETCH_RETRY_DELAY_MS,
  retryAssetFetch,
} from '#assets/retryAssetFetch.ts'

const LOADED_ASSET = 'loaded-asset'
const NETWORK_ERROR = new Error('network down')

describe('retryAssetFetch', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns the asset of the first try without waiting', async () => {
    const fetchAsset = vi.fn(
      (): Promise<string> => Promise.resolve(LOADED_ASSET),
    )

    await expect(retryAssetFetch(fetchAsset)).resolves.toBe(LOADED_ASSET)
    expect(fetchAsset).toHaveBeenCalledTimes(1)
  })

  it('tries again one delay after a failure', async () => {
    const fetchAsset = vi
      .fn((): Promise<string> => Promise.resolve(LOADED_ASSET))
      .mockRejectedValueOnce(NETWORK_ERROR)

    const loading: Promise<string> = retryAssetFetch(fetchAsset)
    await vi.advanceTimersByTimeAsync(ASSET_FETCH_RETRY_DELAY_MS - 1)
    expect(fetchAsset).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)

    await expect(loading).resolves.toBe(LOADED_ASSET)
    expect(fetchAsset).toHaveBeenCalledTimes(2)
  })

  it('throws the last error once every retry failed', async () => {
    const fetchAsset = vi.fn(
      (): Promise<string> => Promise.reject(NETWORK_ERROR),
    )

    const loading: Promise<string> = retryAssetFetch(fetchAsset)
    const settled: Promise<void> = expect(loading).rejects.toBe(NETWORK_ERROR)
    await vi.advanceTimersByTimeAsync(
      ASSET_FETCH_RETRY_DELAY_MS * ASSET_FETCH_RETRY_COUNT,
    )

    await settled
    expect(fetchAsset).toHaveBeenCalledTimes(ASSET_FETCH_RETRY_COUNT + 1)
  })
})
