import { createContext, useContext, useState, type JSX, type KeyboardEvent } from 'react'
import { IoMdEye, IoMdEyeOff } from 'react-icons/io'

/** Modal root class: names the group the overlay layers listen to. */
export const BOARD_OVERLAY_GROUP_CLASS_NAME = 'group/board'
/** Wraps everything drawn over the board art; hidden while the peek button is held. */
export const BOARD_OVERLAY_LAYER_CLASS_NAME =
  'board-overlay-layer contents group-data-[overlays-hidden=true]/board:hidden'
const PEEK_KEYS: readonly string[] = [' ', 'Enter']
/** `root-paper` sets `position: relative`, so the corner placement lives on a wrapper. */
const PEEK_CORNER_CLASS_NAME = 'absolute bottom-2 left-2 z-50 flex'
/** Square torn cream paper: parchment grain, wiggly ink edge. */
const PEEK_BUTTON_CLASS_NAME =
  'faction-board-modal__peek root-paper root-paper-fine root-paper-chip-none root-paper-press m-0 flex size-9 items-center justify-center p-0 text-xl text-ink select-none [--root-paper-color:var(--color-cream)] md:size-10 md:text-2xl'

export type OverlayPeek = {
  overlaysHidden: boolean
  setOverlaysHidden: (hidden: boolean) => void
}

const NO_OVERLAY_PEEK: OverlayPeek = {
  overlaysHidden: false,
  setOverlaysHidden: (): void => {},
}

/** Provided by the faction board modal; read by the button on each board's art. */
export const OverlayPeekContext = createContext<OverlayPeek>(NO_OVERLAY_PEEK)

export function useOverlayPeek(): OverlayPeek {
  const [overlaysHidden, setOverlaysHidden] = useState<boolean>(false)
  return { overlaysHidden, setOverlaysHidden }
}

/** Bottom-left of the board art. Hold to see the bare board without pieces or overlays. */
export function HideOverlaysButton(): JSX.Element {
  const peek: OverlayPeek = useContext(OverlayPeekContext)
  const { setOverlaysHidden } = peek
  const show = (): void => {
    setOverlaysHidden(false)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (PEEK_KEYS.includes(event.key)) setOverlaysHidden(true)
  }
  return (
    <span className={PEEK_CORNER_CLASS_NAME}>
      <button
        type="button"
        className={PEEK_BUTTON_CLASS_NAME}
        aria-label="Hold to hide board overlays"
        aria-pressed={peek.overlaysHidden}
        title="Hold to hide board overlays"
        onPointerDown={() => {
          setOverlaysHidden(true)
        }}
        onPointerUp={show}
        onPointerLeave={show}
        onPointerCancel={show}
        onKeyDown={onKeyDown}
        onKeyUp={show}
        onBlur={show}
        onContextMenu={(event) => {
          event.preventDefault()
        }}
      >
        {peek.overlaysHidden ? <IoMdEyeOff /> : <IoMdEye />}
      </button>
    </span>
  )
}
