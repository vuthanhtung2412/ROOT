import {
  useLayoutEffect,
  useRef,
  useState,
  type JSX,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

/** Gap between the hovered element and its tooltip. */
const TOOLTIP_GAP_PIXELS = 8
/** Closest a tooltip may get to the viewport edge. */
const VIEWPORT_MARGIN_PIXELS = 6
const HALF = 0.5
const DEFAULT_WRAPPER_CLASS_NAME = 'inline-flex'

const TOOLTIP_CLASS_NAME =
  'root-paper root-paper-fine pointer-events-none fixed z-300 m-0 px-2.5 py-0.5 font-display text-sm whitespace-nowrap text-ink capitalize [--root-paper-color:var(--color-paper-bright)] md:text-base'

type TooltipAnchor = {
  centerX: number
  top: number
  bottom: number
}

type TooltipPosition = {
  left: number
  top: number
}

function anchorOf(element: HTMLElement): TooltipAnchor {
  const box: DOMRect = element.getBoundingClientRect()
  return {
    centerX: box.left + box.width * HALF,
    top: box.top,
    bottom: box.bottom,
  }
}

/** Above the anchor, below it when there is no room; kept inside the viewport. */
function positionOf(
  anchor: TooltipAnchor,
  tooltip: HTMLElement,
): TooltipPosition {
  const width: number = tooltip.offsetWidth
  const height: number = tooltip.offsetHeight
  const lastLeft: number =
    window.innerWidth - VIEWPORT_MARGIN_PIXELS - width
  const centeredLeft: number = anchor.centerX - width * HALF
  const left: number = Math.max(
    VIEWPORT_MARGIN_PIXELS,
    Math.min(centeredLeft, lastLeft),
  )
  const aboveTop: number = anchor.top - TOOLTIP_GAP_PIXELS - height
  const top: number =
    aboveTop >= VIEWPORT_MARGIN_PIXELS
      ? aboveTop
      : anchor.bottom + TOOLTIP_GAP_PIXELS
  return { left, top }
}

/**
 * Names an icon-only control the moment the pointer or keyboard focus reaches
 * it (no delay, unlike the browser's `title`). Drawn in a portal, so a
 * scrolling column never clips it.
 */
export function Tooltip(props: {
  label: string
  /** Layout of the wrapper around the control (default: inline). */
  className?: string
  children: ReactNode
}): JSX.Element {
  const [anchor, setAnchor] = useState<TooltipAnchor | null>(null)
  const [position, setPosition] = useState<TooltipPosition | null>(null)
  const tooltipRef = useRef<HTMLSpanElement | null>(null)

  useLayoutEffect(() => {
    const tooltip: HTMLSpanElement | null = tooltipRef.current
    setPosition(
      anchor === null || tooltip === null ? null : positionOf(anchor, tooltip),
    )
  }, [anchor, props.label])

  function show(element: HTMLElement): void {
    setAnchor(anchorOf(element))
  }

  function hide(): void {
    setAnchor(null)
  }

  return (
    <span
      className={props.className ?? DEFAULT_WRAPPER_CLASS_NAME}
      onPointerEnter={(event) => {
        show(event.currentTarget)
      }}
      onPointerLeave={hide}
      onPointerDown={hide}
      onFocus={(event) => {
        show(event.currentTarget)
      }}
      onBlur={hide}
    >
      {props.children}
      {anchor !== null
        ? createPortal(
            <span
              ref={tooltipRef}
              role="tooltip"
              className={TOOLTIP_CLASS_NAME}
              style={{
                left: position?.left ?? 0,
                top: position?.top ?? 0,
                visibility: position === null ? 'hidden' : 'visible',
              }}
            >
              {props.label}
            </span>,
            document.body,
          )
        : null}
    </span>
  )
}
