import { useEffect, useState } from 'react'
import {
  readWindowViewportLayoutMode,
  resolveViewportLayoutMode,
  type ViewportLayoutMode,
} from '#game/viewportLayout.ts'

export function useViewportLayoutMode(): ViewportLayoutMode {
  const [mode, setMode] = useState<ViewportLayoutMode>(() =>
    readWindowViewportLayoutMode(),
  )

  useEffect(() => {
    const updateMode = (): void => {
      setMode(
        resolveViewportLayoutMode(window.innerWidth, window.innerHeight),
      )
    }
    updateMode()
    window.addEventListener('resize', updateMode)
    window.addEventListener('orientationchange', updateMode)
    return () => {
      window.removeEventListener('resize', updateMode)
      window.removeEventListener('orientationchange', updateMode)
    }
  }, [])

  return mode
}
