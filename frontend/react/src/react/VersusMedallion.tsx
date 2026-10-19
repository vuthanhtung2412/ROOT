import type { JSX } from 'react'

/** Gold paper coin between two sides of a lobby table. Centred on the row even when the sides align to the top. */
const VERSUS_CLASS_NAME =
  'root-paper root-medallion flex size-12 self-center items-center justify-center font-display text-2xl text-ink [--root-paper-color:var(--color-gold)] md:size-20 md:text-4xl'
const VERSUS_TEXT = 'VS'

export function VersusMedallion(): JSX.Element {
  return (
    <span className={VERSUS_CLASS_NAME} aria-hidden="true">
      {VERSUS_TEXT}
    </span>
  )
}
