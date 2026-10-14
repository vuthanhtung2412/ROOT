import {
  useLayoutEffect,
  useState,
  useSyncExternalStore,
  type JSX,
} from 'react'
import {
  getHudCallbacks,
  getHudSnapshot,
  subscribeHud,
} from '#game/hudStore.ts'
import { Stepper } from '#react/Stepper.tsx'
import type { TurnBannerClearingStepper } from '#ui/TurnBanner.ts'

const STEPPER_ROW_CLASS_NAME =
  'clearing-wood-stepper pointer-events-auto fixed z-40 -translate-x-1/2'
/** Sit just under the clearing ring. */
const BELOW_CLEARING_GAP_PIXELS = 6
const HALF = 0.5

type ScreenAnchor = {
  x: number
  y: number
}

function measureClearingBottom(clearingId: number): ScreenAnchor | null {
  const clearing: Element | null = document.querySelector(
    `[data-clearing-id="${String(clearingId)}"]`,
  )
  if (clearing === null) {
    return null
  }
  const bounds: DOMRect = clearing.getBoundingClientRect()
  return {
    x: bounds.left + bounds.width * HALF,
    y: bounds.bottom + BELOW_CLEARING_GAP_PIXELS,
  }
}

function sameAnchor(
  left: ScreenAnchor | null,
  right: ScreenAnchor | null,
): boolean {
  if (left === null || right === null) {
    return left === right
  }
  return left.x === right.x && left.y === right.y
}

/** Follow a clearing while the 3D camera pans or the window resizes. */
function useClearingBottom(clearingId: number): ScreenAnchor | null {
  const [anchor, setAnchor] = useState<ScreenAnchor | null>(null)
  useLayoutEffect(() => {
    let frameId = 0
    const update = (): void => {
      const measured = measureClearingBottom(clearingId)
      setAnchor((current) =>
        sameAnchor(current, measured) ? current : measured,
      )
      frameId = window.requestAnimationFrame(update)
    }
    update()
    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [clearingId])
  return anchor
}

function ClearingWoodStepper(props: {
  stepper: TurnBannerClearingStepper
  totalSelected: number
  woodCost: number
}): JSX.Element | null {
  const anchor = useClearingBottom(props.stepper.clearingId)
  if (anchor === null) {
    return null
  }
  const { clearingId, selected, maximum } = props.stepper
  const canIncrease =
    selected < maximum && props.totalSelected < props.woodCost
  const callbacks = getHudCallbacks()
  return (
    <div
      className={STEPPER_ROW_CLASS_NAME}
      style={{ left: anchor.x, top: anchor.y }}
    >
      <Stepper
        value={selected}
        max={maximum}
        canIncrease={canIncrease}
        aria-label={`Wood at clearing ${String(clearingId)}: ${String(selected)} of ${String(maximum)}`}
        decreaseAriaLabel={`Less wood from clearing ${String(clearingId)}`}
        increaseAriaLabel={`More wood from clearing ${String(clearingId)}`}
        onChange={(next) => {
          callbacks.onClearingStepper(clearingId, next)
        }}
      />
    </div>
  )
}

/**
 * Wood-spend steppers under each clearing that can pay the Marquise build.
 * Counts come from the active composer prompt.
 */
export function ClearingWoodSteppers(): JSX.Element | null {
  const composer = useSyncExternalStore(
    subscribeHud,
    () => getHudSnapshot().turnBanner.composer,
    () => getHudSnapshot().turnBanner.composer,
  )
  const steppers = composer?.clearingSteppers
  if (steppers === undefined || steppers.length === 0) {
    return null
  }
  const totalSelected = steppers.reduce(
    (sum, stepper) => sum + stepper.selected,
    0,
  )
  const woodCost = composer?.clearingStepperBudget ?? totalSelected
  return (
    <>
      {steppers.map((stepper) => (
        <ClearingWoodStepper
          key={stepper.clearingId}
          stepper={stepper}
          totalSelected={totalSelected}
          woodCost={woodCost}
        />
      ))}
    </>
  )
}
