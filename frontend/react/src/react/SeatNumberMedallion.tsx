import { useState, type JSX, type PointerEvent } from 'react'
import { LuX } from 'react-icons/lu'
import { seatMedallionTapOutcome } from '#ui/seatNumberMedallionTap.ts'

/** Top left of a seat tile: the seat number. Gold = this browser's seat. */
const MEDALLION_CLASS_NAME =
  'root-paper root-medallion absolute -top-3 -left-3 m-0 flex size-8 items-center justify-center p-0 font-mono text-lg font-bold text-ink md:-top-4 md:-left-4 md:size-11 md:text-[22px]'
const LOCAL_PAPER_CLASS_NAME = '[--root-paper-color:var(--color-gold)]'
const PAPER_CLASS_NAME = '[--root-paper-color:var(--color-parchment-deep)]'
/** With a remove action: rust paper and ✕ on hover, focus or an armed tap. */
const REMOVE_BUTTON_CLASS_NAME =
  'group root-paper-press cursor-root-pointer hover:text-paper-bright hover:[--root-paper-color:var(--color-rust)] focus-visible:text-paper-bright focus-visible:[--root-paper-color:var(--color-rust)] data-[armed=true]:text-paper-bright data-[armed=true]:[--root-paper-color:var(--color-rust)] disabled:cursor-root-not-allowed'
const NUMBER_CLASS_NAME =
  'group-hover:hidden group-focus-visible:hidden group-data-[armed=true]:hidden'
const REMOVE_ICON_CLASS_NAME =
  'hidden group-hover:block group-focus-visible:block group-data-[armed=true]:block'

export type SeatNumberMedallionProps = {
  /** 1-based, as players count seats. */
  seatNumber: number
  isLocal: boolean
  /** Non-null: the medallion turns into ✕ and takes the seat away. */
  onRemove: (() => void) | null
  /** Screen reader text of the remove button, e.g. "Expel seat 2, Eyrie". */
  removeLabel?: string
  /** Bare hook class name QA scripts select on. */
  hookClassName?: string
  disabled?: boolean
}

export function SeatNumberMedallion(props: SeatNumberMedallionProps): JSX.Element {
  const [isArmed, setArmed] = useState<boolean>(false)
  const [pressPointerType, setPressPointerType] = useState<string>('')
  const paperClassName: string = props.isLocal ? LOCAL_PAPER_CLASS_NAME : PAPER_CLASS_NAME
  const onRemove: (() => void) | null = props.onRemove
  if (onRemove === null) {
    return <span className={`${MEDALLION_CLASS_NAME} ${paperClassName}`}>{props.seatNumber}</span>
  }
  const handleClick = (): void => {
    const outcome = seatMedallionTapOutcome({ pointerType: pressPointerType, isArmed })
    setPressPointerType('')
    if (outcome === 'arm') {
      setArmed(true)
      return
    }
    setArmed(false)
    onRemove()
  }
  return (
    <button
      type="button"
      className={`${props.hookClassName ?? ''} ${MEDALLION_CLASS_NAME} ${paperClassName} ${REMOVE_BUTTON_CLASS_NAME}`}
      data-armed={isArmed}
      aria-label={props.removeLabel ?? `Remove seat ${String(props.seatNumber)}`}
      title="Remove from the table"
      disabled={props.disabled === true}
      onPointerDown={(event: PointerEvent<HTMLButtonElement>): void => {
        setPressPointerType(event.pointerType)
      }}
      onBlur={(): void => {
        setArmed(false)
      }}
      onClick={handleClick}
    >
      <span className={NUMBER_CLASS_NAME}>{props.seatNumber}</span>
      <LuX className={REMOVE_ICON_CLASS_NAME} aria-hidden="true" />
    </button>
  )
}
