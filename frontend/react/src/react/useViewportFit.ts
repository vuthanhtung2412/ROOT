import { useEffect, useState } from 'react'
import {
  fittedLogicalWidth,
  readWindowViewportMeasure,
  stableLogicalWidth,
  UNSCALED_ZOOM,
  viewportMetaContent,
  viewportZoom,
  type ViewportMeasure,
} from '#game/viewportFit.ts'

const VIEWPORT_META_SELECTOR = 'meta[name="viewport"]'
const VIEWPORT_META_CONTENT_ATTRIBUTE = 'content'

/**
 * Scale the wide layout down on viewports smaller than the design size.
 * Sets the viewport meta tag (phones, tablets) and returns the CSS zoom the
 * app root needs where that tag is ignored (desktop browsers).
 */
export function useViewportFit(): number {
  const [zoom, setZoom] = useState<number>(UNSCALED_ZOOM)

  useEffect(() => {
    const viewportMeta: Element | null = document.querySelector(
      VIEWPORT_META_SELECTOR,
    )
    let appliedWidth: number | null = null
    const updateFit = (): void => {
      const measure: ViewportMeasure = readWindowViewportMeasure()
      appliedWidth = stableLogicalWidth(
        appliedWidth,
        fittedLogicalWidth(measure),
      )
      const content: string = viewportMetaContent(appliedWidth)
      if (
        viewportMeta !== null &&
        viewportMeta.getAttribute(VIEWPORT_META_CONTENT_ATTRIBUTE) !== content
      ) {
        viewportMeta.setAttribute(VIEWPORT_META_CONTENT_ATTRIBUTE, content)
      }
      setZoom(viewportZoom(measure))
    }
    updateFit()
    window.addEventListener('resize', updateFit)
    window.addEventListener('orientationchange', updateFit)
    return () => {
      window.removeEventListener('resize', updateFit)
      window.removeEventListener('orientationchange', updateFit)
    }
  }, [])

  return zoom
}
