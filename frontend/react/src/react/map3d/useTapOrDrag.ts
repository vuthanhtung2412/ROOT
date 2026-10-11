import {
  useCallback,
  useRef,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'

/**
 * The camera listens on the whole map, buttons included, so a drag or a
 * wheel turn that starts on a clearing still moves the view. That makes
 * every press ambiguous; this tells the two apart:
 * - the pointer barely moved → a tap: the pressed button is clicked;
 * - it moved → a drag: the camera panned, nothing is clicked.
 */
export type TapOrDragHandlers = {
  onPointerDownCapture: (event: ReactPointerEvent<HTMLElement>) => void
  onPointerUpCapture: (event: ReactPointerEvent<HTMLElement>) => void
  onClickCapture: (event: ReactMouseEvent<HTMLElement>) => void
}

type Press = {
  x: number
  y: number
  button: HTMLButtonElement | null
}

/** Further than this between press and release is a drag, not a tap. */
const TAP_SLOP_PIXELS = 6
/** The browser's own click after a release arrives within this time. */
const NATIVE_CLICK_WINDOW_MILLISECONDS = 400

function pressedButton(target: EventTarget): HTMLButtonElement | null {
  if (!(target instanceof Element)) {
    return null
  }
  const button: Element | null = target.closest('button')
  return button instanceof HTMLButtonElement ? button : null
}

export function useTapOrDrag(): TapOrDragHandlers {
  const press = useRef<Press | null>(null)
  const swallowNativeClickUntil = useRef<number>(0)

  const onPointerDownCapture = useCallback(
    (event: ReactPointerEvent<HTMLElement>): void => {
      press.current = {
        x: event.clientX,
        y: event.clientY,
        button: pressedButton(event.target),
      }
    },
    [],
  )

  const onPointerUpCapture = useCallback(
    (event: ReactPointerEvent<HTMLElement>): void => {
      const pressed: Press | null = press.current
      press.current = null
      if (pressed === null) {
        return
      }
      // Whether the browser still sends its own click depends on where the
      // pointer was captured: it is always ignored, the tap is clicked here.
      swallowNativeClickUntil.current =
        performance.now() + NATIVE_CLICK_WINDOW_MILLISECONDS
      const moved: number = Math.hypot(
        event.clientX - pressed.x,
        event.clientY - pressed.y,
      )
      if (moved < TAP_SLOP_PIXELS && pressed.button !== null) {
        pressed.button.click()
      }
    },
    [],
  )

  const onClickCapture = useCallback(
    (event: ReactMouseEvent<HTMLElement>): void => {
      if (
        event.nativeEvent.isTrusted &&
        performance.now() < swallowNativeClickUntil.current
      ) {
        event.stopPropagation()
        event.preventDefault()
      }
    },
    [],
  )

  return { onPointerDownCapture, onPointerUpCapture, onClickCapture }
}
