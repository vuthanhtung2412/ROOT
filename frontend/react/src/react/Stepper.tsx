import { type JSX } from 'react'
import { LuMinus, LuPlus } from 'react-icons/lu'

const DEFAULT_MINIMUM = 0

const ROW_CLASS_NAME = 'flex flex-row items-center gap-1'
const MINUS_BUTTON_CLASS_NAME =
  'root-paper root-medallion root-paper-press m-0 flex size-8 items-center justify-center p-0 text-lg text-parchment [--root-paper-color:var(--color-parchment-deep)] disabled:opacity-40 md:size-9'
const PLUS_BUTTON_CLASS_NAME =
  'root-paper root-medallion root-paper-press m-0 flex size-8 items-center justify-center p-0 text-lg text-parchment [--root-paper-color:var(--color-rust)] disabled:opacity-40 md:size-9'
const COUNT_LABEL_CLASS_NAME =
  'root-paper root-paper-fine min-w-12 px-2 py-1 text-center font-display text-base font-bold text-ink md:min-w-14 md:text-lg'

export type StepperProps = {
  value: number
  max: number
  onChange: (next: number) => void
  min?: number
  /** Override + enabled (default: value < max). */
  canIncrease?: boolean
  /** Override − enabled (default: value > min). */
  canDecrease?: boolean
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
  const rowClassName: string =
    props.className === undefined
      ? ROW_CLASS_NAME
      : `${ROW_CLASS_NAME} ${props.className}`
  return (
    <div className={rowClassName} role="group" aria-label={props['aria-label']}>
      <button
        type="button"
        className={MINUS_BUTTON_CLASS_NAME}
        aria-label={props.decreaseAriaLabel}
        disabled={!canDecrease}
        onClick={() => {
          props.onChange(props.value - 1)
        }}
      >
        <LuMinus aria-hidden="true" />
      </button>
      <span className={COUNT_LABEL_CLASS_NAME}>
        {String(props.value)}/{String(props.max)}
      </span>
      <button
        type="button"
        className={PLUS_BUTTON_CLASS_NAME}
        aria-label={props.increaseAriaLabel}
        disabled={!canIncrease}
        onClick={() => {
          props.onChange(props.value + 1)
        }}
      >
        <LuPlus aria-hidden="true" />
      </button>
    </div>
  )
}
