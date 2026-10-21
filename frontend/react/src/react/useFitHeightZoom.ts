import { useLayoutEffect, useState, type RefObject } from 'react'
import { UNSCALED_ZOOM } from '#game/viewportFit.ts'

/** Share of the frame height the content may take: the rest is stage padding. */
const FRAME_FILL_RATIO = 0.88
/** Below this the content stops shrinking and the stage scrolls instead. */
const MIN_FIT_ZOOM = 0.6
/** Ignore sub-percent changes so the zoom does not jitter. */
const ZOOM_CHANGE_TOLERANCE = 0.01

export type FitHeightTarget = {
  /** Element scaled down to fit. */
  contentRef: RefObject<HTMLElement | null>
  /** Ancestor whose height the content must fit in. */
  frameSelector: string
}

/** Zoom that fits a content of this natural height inside the frame. */
export function fitHeightZoom(frameHeight: number, naturalContentHeight: number): number {
  if (frameHeight <= 0 || naturalContentHeight <= 0) return UNSCALED_ZOOM
  const fittingZoom: number = (frameHeight * FRAME_FILL_RATIO) / naturalContentHeight
  return Math.max(MIN_FIT_ZOOM, Math.min(UNSCALED_ZOOM, fittingZoom))
}

/**
 * CSS zoom that shrinks the content until it fits the frame height. Both
 * heights are read on screen (`getBoundingClientRect`), so a zoom on the app
 * root scales them alike.
 */
export function useFitHeightZoom(target: FitHeightTarget): number {
  const [zoom, setZoom] = useState<number>(UNSCALED_ZOOM)
  const { contentRef, frameSelector } = target

  useLayoutEffect(() => {
    const content: HTMLElement | null = contentRef.current
    const frame: Element | null = content?.closest(frameSelector) ?? null
    if (content === null || frame === null) return undefined
    const updateZoom = (): void => {
      setZoom((currentZoom: number): number => {
        const naturalContentHeight: number = content.getBoundingClientRect().height / currentZoom
        const nextZoom: number = fitHeightZoom(
          frame.getBoundingClientRect().height,
          naturalContentHeight,
        )
        return Math.abs(nextZoom - currentZoom) < ZOOM_CHANGE_TOLERANCE ? currentZoom : nextZoom
      })
    }
    const resizeObserver = new ResizeObserver(updateZoom)
    resizeObserver.observe(frame)
    resizeObserver.observe(content)
    return () => {
      resizeObserver.disconnect()
    }
  }, [contentRef, frameSelector])

  return zoom
}
