import { Capacitor } from '@capacitor/core'

/**
 * Browser: `ROOT_WEB_API` (GitHub Pages build), else empty = same-origin
 * (Vite proxy / served from @root/web).
 * Native Capacitor: prod API from `.env` `ROOT_PROD_API` (mise `_.file`).
 */
export function resolveDefaultApiBaseUrl(): string {
  const configuredApiUrl: string | undefined = Capacitor.isNativePlatform()
    ? import.meta.env.ROOT_PROD_API
    : import.meta.env.ROOT_WEB_API
  if (typeof configuredApiUrl !== 'string' || configuredApiUrl.length === 0) {
    return ''
  }
  return stripTrailingSlash(configuredApiUrl)
}

function stripTrailingSlash(url: string): string {
  if (url.endsWith('/')) {
    return url.slice(0, -1)
  }
  return url
}
