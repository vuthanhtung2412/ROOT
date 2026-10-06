import { useLayoutEffect, useState, type CSSProperties, type JSX } from 'react'

/**
 * Dims the board behind the battle. Sits under the HUD (rail, tray, hand,
 * banner) so the board stays readable around the battle and usable.
 */
const BACKDROP_CLASS_NAME =
  'battle-overlay__backdrop pointer-events-none fixed inset-0 z-50 bg-forest-deep/72'
/** Ring round the clearing the battle is fought in, above the dimming. */
const CLEARING_MARK_CLASS_NAME =
  'battle-overlay__clearing-mark pointer-events-none fixed z-50 box-border rounded-full border-4 border-gold shadow-gold-glow outline-2 outline-ink-deep'
const HALF = 0.5
/** The lit hole is a little wider than the clearing, the ring sits on its edge. */
const MARK_RADIUS_SCALE = 1.12

type ScreenCircle = {
  centerX: number
  centerY: number
  radius: number
}

/** Where the map draws a clearing on screen; null while it is not drawn. */
function measureClearing(clearingId: number): ScreenCircle | null {
  const clearing: Element | null = document.querySelector(
    `[data-clearing-id="${String(clearingId)}"]`,
  )
  if (clearing === null) {
    return null
  }
  const bounds: DOMRect = clearing.getBoundingClientRect()
  return {
    centerX: bounds.left + bounds.width * HALF,
    centerY: bounds.top + bounds.height * HALF,
    radius: bounds.width * HALF * MARK_RADIUS_SCALE,
  }
}

function sameCircle(left: ScreenCircle | null, right: ScreenCircle | null): boolean {
  if (left === null || right === null) {
    return left === right
  }
  return (
    left.centerX === right.centerX &&
    left.centerY === right.centerY &&
    left.radius === right.radius
  )
}

/** The battle clearing on screen, followed through resizes of the map. */
function useClearingOnScreen(clearingId: number): ScreenCircle | null {
  const [circle, setCircle] = useState<ScreenCircle | null>(null)
  useLayoutEffect(() => {
    const update = (): void => {
      const measured: ScreenCircle | null = measureClearing(clearingId)
      setCircle((current: ScreenCircle | null) =>
        sameCircle(current, measured) ? current : measured,
      )
    }
    update()
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('resize', update)
    }
  }, [clearingId])
  return circle
}

/** Cuts the clearing out of the dimming, so it stays lit. */
function litClearingMask(circle: ScreenCircle): CSSProperties {
  const hole = `radial-gradient(circle ${String(circle.radius)}px at ${String(circle.centerX)}px ${String(circle.centerY)}px, transparent 99%, black 100%)`
  return { maskImage: hole, WebkitMaskImage: hole }
}

/**
 * The board dims behind a battle; the clearing it is fought in stays lit and
 * ringed for as long as the battle (its result included) is on screen.
 */
export function BattleBackdrop(props: { clearingId: number }): JSX.Element {
  const circle: ScreenCircle | null = useClearingOnScreen(props.clearingId)
  return (
    <>
      <div
        className={BACKDROP_CLASS_NAME}
        style={circle === null ? undefined : litClearingMask(circle)}
        aria-hidden="true"
      />
      {circle === null ? null : (
        <div
          className={CLEARING_MARK_CLASS_NAME}
          style={{
            left: circle.centerX - circle.radius,
            top: circle.centerY - circle.radius,
            width: circle.radius * 2,
            height: circle.radius * 2,
          }}
          aria-hidden="true"
        />
      )}
    </>
  )
}
