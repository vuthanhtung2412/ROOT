import { Capacitor } from '@capacitor/core'

/**
 * Browser: empty = same-origin (Vite proxy / served from @root/web).
 * Native Capacitor: prod API from mise `ROOT_PROD_API`.
 */
export function resolveDefaultApiBaseUrl(): string {
  if (!Capacitor.isNativePlatform()) {
    return ''
  }
  const prodApiUrl = import.meta.env.ROOT_PROD_API
  if (typeof prodApiUrl !== 'string' || prodApiUrl.length === 0) {
    return ''
  }
  return stripTrailingSlash(prodApiUrl)
}

function stripTrailingSlash(url: string): string {
  if (url.endsWith('/')) {
    return url.slice(0, -1)
  }
  return url
}
