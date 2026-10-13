import type { JSX } from 'react'
import { CLEARING_FLASH_MS } from '#game/clearingFlash.ts'
import type { ClearingPixelHitTarget } from '#game/boardLayout.ts'
import { useKeyframes } from '#react/useKeyframes.ts'

const FLASH_FADE_OUT_KEYFRAMES: Keyframe[] = [{ opacity: 1 }, { opacity: 0 }]

const FLASH_MARK_CLASS_NAME =
  'clearing-flash pointer-events-none absolute box-border rounded-full border-4 border-solid border-gold bg-paper-bright/70'

export type ClearingFlashMarkProps = {
  target: ClearingPixelHitTarget
}

/** The soil of a clearing lights up, then fades back. */
export function ClearingFlashMark(props: ClearingFlashMarkProps): JSX.Element {
  const fadeRef = useKeyframes(FLASH_FADE_OUT_KEYFRAMES, {
    duration: CLEARING_FLASH_MS,
    easing: 'ease-out',
    fill: 'forwards',
  })
  const diameter: number = props.target.radius * 2
  return (
    <div
      ref={fadeRef}
      className={FLASH_MARK_CLASS_NAME}
      style={{
        left: props.target.centerX - props.target.radius,
        top: props.target.centerY - props.target.radius,
        width: diameter,
        height: diameter,
      }}
    />
  )
}
