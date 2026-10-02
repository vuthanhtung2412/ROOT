import { useEffect } from 'react'
import {
  phoneLandscapeLogicalWidth,
  stableLogicalWidth,
  viewportMetaContent,
} from '#game/phoneLandscapeViewport.ts'

const VIEWPORT_META_SELECTOR = 'meta[name="viewport"]'
const VIEWPORT_META_CONTENT_ATTRIBUTE = 'content'

/** Sideways phone: scale the wide layout down via the viewport meta tag. */
export function usePhoneLandscapeViewport(): void {
  useEffect(() => {
    const viewportMeta: Element | null = document.querySelector(
      VIEWPORT_META_SELECTOR,
    )
    if (viewportMeta === null) {
      return
    }
    let appliedWidth: number | null = null
    const updateViewport = (): void => {
      appliedWidth = stableLogicalWidth(
        appliedWidth,
        phoneLandscapeLogicalWidth({
          screenWidth: window.screen.width,
          screenHeight: window.screen.height,
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight,
        }),
      )
      const content: string = viewportMetaContent(appliedWidth)
      if (viewportMeta.getAttribute(VIEWPORT_META_CONTENT_ATTRIBUTE) !== content) {
        viewportMeta.setAttribute(VIEWPORT_META_CONTENT_ATTRIBUTE, content)
      }
    }
    updateViewport()
    window.addEventListener('resize', updateViewport)
    window.addEventListener('orientationchange', updateViewport)
    return () => {
      window.removeEventListener('resize', updateViewport)
      window.removeEventListener('orientationchange', updateViewport)
    }
  }, [])
}
