import { type JSX } from 'react'

/** S1 wave path (long) — matches tmp/stepper-mockups T1. */
const WAVE_HORIZONTAL_PATH =
  'M4.6 12.15 C7.2 11.15, 9.1 12.85, 11.2 12.05 C13.4 11.2, 15.1 12.75, 17.0 12.0 C18.4 11.5, 19.4 12.35, 19.5 12.1'
const WAVE_VERTICAL_PATH =
  'M12.1 4.5 C11.2 7.1, 12.85 9.0, 12.05 11.1 C11.2 13.3, 12.75 15.0, 12.0 16.9 C11.5 18.3, 12.35 19.3, 12.1 19.5'

/** T1 weight from mockups. */
export const WAVE_STROKE_WIDTH = 3.2

const ICON_CLASS_NAME = 'size-5 overflow-visible'

function WaveStrokePath(props: { path: string }): JSX.Element {
  return (
    <path
      d={props.path}
      fill="none"
      stroke="currentColor"
      strokeWidth={WAVE_STROKE_WIDTH}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  )
}

/** Hand-inked wave minus for the bare map stepper. */
export function WaveMinusIcon(): JSX.Element {
  return (
    <svg
      className={ICON_CLASS_NAME}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <WaveStrokePath path={WAVE_HORIZONTAL_PATH} />
    </svg>
  )
}

/** Hand-inked wave plus for the bare map stepper. */
export function WavePlusIcon(): JSX.Element {
  return (
    <svg
      className={ICON_CLASS_NAME}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <WaveStrokePath path={WAVE_HORIZONTAL_PATH} />
      <WaveStrokePath path={WAVE_VERTICAL_PATH} />
    </svg>
  )
}
