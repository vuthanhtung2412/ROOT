import {
  useLayoutEffect,
  useState,
  useSyncExternalStore,
  type JSX,
} from 'react'
import { LuMinus, LuPlus } from 'react-icons/lu'
import {
  getHudCallbacks,
  getHudSnapshot,
  subscribeHud,
} from '#game/hudStore.ts'
import type { TurnBannerClearingStepper } from '#ui/TurnBanner.ts'

const STEPPER_ROW_CLASS_NAME =
  'clearing-wood-stepper pointer-events-auto fixed z-40 flex -translate-x-1/2 flex-row items-center gap-1'
const MINUS_BUTTON_CLASS_NAME =
  'root-paper root-medallion root-paper-press m-0 flex size-8 items-center justify-center p-0 text-lg text-parchment [--root-paper-color:var(--color-parchment-deep)] disabled:opacity-40 md:size-9'
const PLUS_BUTTON_CLASS_NAME =
  'root-paper root-medallion root-paper-press m-0 flex size-8 items-center justify-center p-0 text-lg text-parchment [--root-paper-color:var(--color-rust)] disabled:opacity-40 md:size-9'
const COUNT_LABEL_CLASS_NAME =
  'root-paper root-paper-fine min-w-12 px-2 py-1 text-center font-display text-base font-bold text-ink md:min-w-14 md:text-lg'
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
  const canDecrease = selected > 0
  const canIncrease =
    selected < maximum && props.totalSelected < props.woodCost
  const callbacks = getHudCallbacks()
  return (
    <div
      className={STEPPER_ROW_CLASS_NAME}
      style={{ left: anchor.x, top: anchor.y }}
      role="group"
      aria-label={`Wood at clearing ${String(clearingId)}: ${String(selected)} of ${String(maximum)}`}
    >
      <button
        type="button"
        className={MINUS_BUTTON_CLASS_NAME}
        aria-label={`Less wood from clearing ${String(clearingId)}`}
        disabled={!canDecrease}
        onClick={() => {
          callbacks.onClearingStepper(clearingId, selected - 1)
        }}
      >
        <LuMinus aria-hidden="true" />
      </button>
      <span className={COUNT_LABEL_CLASS_NAME}>
        {String(selected)}/{String(maximum)}
      </span>
      <button
        type="button"
        className={PLUS_BUTTON_CLASS_NAME}
        aria-label={`More wood from clearing ${String(clearingId)}`}
        disabled={!canIncrease}
        onClick={() => {
          callbacks.onClearingStepper(clearingId, selected + 1)
        }}
      >
        <LuPlus aria-hidden="true" />
      </button>
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
