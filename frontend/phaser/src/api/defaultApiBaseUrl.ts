import { Capacitor } from '@capacitor/core'

/**
 * Browser: empty = same-origin (Vite proxy / served from @root/web).
 * Native Capacitor: Tailscale Funnel URL from mise `ROOT_FUNNEL_URL`.
 */
export function resolveDefaultApiBaseUrl(): string {
  if (!Capacitor.isNativePlatform()) {
    return ''
  }
  const funnelUrl = import.meta.env.ROOT_FUNNEL_URL
  if (typeof funnelUrl !== 'string' || funnelUrl.length === 0) {
    return ''
  }
  return stripTrailingSlash(funnelUrl)
}

function stripTrailingSlash(url: string): string {
  if (url.endsWith('/')) {
    return url.slice(0, -1)
  }
  return url
}
