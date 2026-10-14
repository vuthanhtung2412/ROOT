import { type JSX } from 'react'
import { LuMinus, LuPlus } from 'react-icons/lu'
import { WaveMinusIcon, WavePlusIcon } from '#react/StepperWaveIcons.tsx'

const DEFAULT_MINIMUM = 0

export type StepperVariant = 'default' | 'minimal'

const ROW_CLASS_NAME = 'flex flex-row items-center gap-1'
/** Soft cream tray behind the whole − / count / + row. */
const ROW_MINIMAL_CLASS_NAME =
  'flex flex-row items-center gap-1.5 rounded-sm bg-cream/10 px-1.5 py-0.5'

const MINUS_BUTTON_CLASS_NAME =
  'root-paper root-medallion root-paper-press m-0 flex size-8 items-center justify-center p-0 text-lg text-parchment [--root-paper-color:var(--color-parchment-deep)] disabled:opacity-40 md:size-9'
const PLUS_BUTTON_CLASS_NAME =
  'root-paper root-medallion root-paper-press m-0 flex size-8 items-center justify-center p-0 text-lg text-parchment [--root-paper-color:var(--color-rust)] disabled:opacity-40 md:size-9'
const COUNT_LABEL_CLASS_NAME =
  'root-paper root-paper-fine min-w-12 px-2 py-1 text-center font-display text-base font-bold text-ink md:min-w-14 md:text-lg'

/** No paper fill; ink − / rust + with halo for map contrast. */
const MINUS_MINIMAL_BUTTON_CLASS_NAME =
  'm-0 flex size-[30px] items-center justify-center border-0 bg-transparent p-0 text-ink cursor-root-pointer active:translate-y-px disabled:cursor-root-not-allowed disabled:opacity-40 [filter:drop-shadow(0_1px_0_var(--color-parchment))_drop-shadow(1px_0_0_var(--color-parchment))_drop-shadow(-1px_0_0_var(--color-parchment))_drop-shadow(0_-1px_0_var(--color-parchment))]'
const PLUS_MINIMAL_BUTTON_CLASS_NAME =
  'm-0 flex size-[30px] items-center justify-center border-0 bg-transparent p-0 text-rust cursor-root-pointer active:translate-y-px disabled:cursor-root-not-allowed disabled:opacity-40 [filter:drop-shadow(0_1px_0_var(--color-ink-deep))_drop-shadow(1px_0_0_var(--color-ink-deep))_drop-shadow(-1px_0_0_var(--color-ink-deep))_drop-shadow(0_-1px_0_var(--color-ink-deep))]'
const COUNT_MINIMAL_LABEL_CLASS_NAME =
  'min-w-10 px-1 py-0.5 text-center font-display text-base font-bold text-parchment text-shadow-outline'

export type StepperProps = {
  value: number
  max: number
  onChange: (next: number) => void
  min?: number
  /** Override + enabled (default: value < max). */
  canIncrease?: boolean
  /** Override − enabled (default: value > min). */
  canDecrease?: boolean
  /**
   * `default` — torn paper medallions.
   * `minimal` — wave glyphs, no fills, ink − / rust +.
   */
  variant?: StepperVariant
  className?: string
  'aria-label'?: string
  decreaseAriaLabel?: string
  increaseAriaLabel?: string
}

/** Minimal − / value/max / + control. */
export function Stepper(props: StepperProps): JSX.Element {
  const minimum: number = props.min ?? DEFAULT_MINIMUM
  const canDecrease: boolean = props.canDecrease ?? props.value > minimum
  const canIncrease: boolean = props.canIncrease ?? props.value < props.max
  const variant: StepperVariant = props.variant ?? 'default'
  const isMinimal: boolean = variant === 'minimal'
  const rowClassName: string = [
    isMinimal ? ROW_MINIMAL_CLASS_NAME : ROW_CLASS_NAME,
    props.className,
  ]
    .filter((part): part is string => part !== undefined && part.length > 0)
    .join(' ')
  return (
    <div className={rowClassName} role="group" aria-label={props['aria-label']}>
      <button
        type="button"
        className={
          isMinimal ? MINUS_MINIMAL_BUTTON_CLASS_NAME : MINUS_BUTTON_CLASS_NAME
        }
        aria-label={props.decreaseAriaLabel}
        disabled={!canDecrease}
        onClick={() => {
          props.onChange(props.value - 1)
        }}
      >
        {isMinimal ? <WaveMinusIcon /> : <LuMinus aria-hidden="true" />}
      </button>
      <span
        className={
          isMinimal ? COUNT_MINIMAL_LABEL_CLASS_NAME : COUNT_LABEL_CLASS_NAME
        }
      >
        {String(props.value)}/{String(props.max)}
      </span>
      <button
        type="button"
        className={
          isMinimal ? PLUS_MINIMAL_BUTTON_CLASS_NAME : PLUS_BUTTON_CLASS_NAME
        }
        aria-label={props.increaseAriaLabel}
        disabled={!canIncrease}
        onClick={() => {
          props.onChange(props.value + 1)
        }}
      >
        {isMinimal ? <WavePlusIcon /> : <LuPlus aria-hidden="true" />}
      </button>
    </div>
  )
}
