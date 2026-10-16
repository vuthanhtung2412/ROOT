/** A failed asset download is tried again this many times before giving up. */
export const ASSET_FETCH_RETRY_COUNT = 3
/** Pause before each new try, so a flaky network has time to come back. */
export const ASSET_FETCH_RETRY_DELAY_MS = 1000

function wait(durationMs: number): Promise<void> {
  return new Promise((resolve: () => void): void => {
    setTimeout(resolve, durationMs)
  })
}

/**
 * Runs `fetchAsset`, and on failure tries again up to
 * `ASSET_FETCH_RETRY_COUNT` times, `ASSET_FETCH_RETRY_DELAY_MS` apart.
 * The last error is thrown once every try failed.
 */
export async function retryAssetFetch<Asset>(
  fetchAsset: () => Promise<Asset>,
): Promise<Asset> {
  let lastError: Error = new Error('Asset fetch never ran')
  for (
    let attempt: number = 0;
    attempt <= ASSET_FETCH_RETRY_COUNT;
    attempt += 1
  ) {
    if (attempt > 0) {
      await wait(ASSET_FETCH_RETRY_DELAY_MS)
    }
    try {
      return await fetchAsset()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
    }
  }
  throw lastError
}
