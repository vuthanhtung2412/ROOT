import {
  useEffect,
  useRef,
  useSyncExternalStore,
  type JSX,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { cardImagePublicPath } from '#assets/gameAssets.ts'
import {
  getHudCallbacks,
  getHudSnapshot,
  patchHud,
  subscribeHud,
  type DecreeDragHudState,
  type DecreePanelHudState,
} from '#game/hudStore.ts'
import { isDecreeColumnOfferedFor } from '#ui/decreePanel.ts'

/** Pointer travel that turns a press on a card into a drag. */
const DRAG_START_DISTANCE_PIXELS = 8
const PRIMARY_POINTER_BUTTON = 0
/** Bare hook class of the panel frame: a staged card dropped outside it goes back to the hand. */
export const DECREE_PANEL_HOOK_CLASS_NAME = 'decree-panel'
const DECREE_PANEL_SELECTOR = `.${DECREE_PANEL_HOOK_CLASS_NAME}`

/** The dragged card follows the pointer, over every other layer. */
const GHOST_CLASS_NAME =
  'decree-drag-ghost pointer-events-none fixed z-200 w-16 -translate-1/2 -rotate-3 overflow-hidden rounded-md border-2 border-gold shadow-card-selected md:w-28 md:border-3'

type ScreenPoint = {
  x: number
  y: number
}

type DecreeDropTarget =
  | { kind: 'column'; column: string }
  | { kind: 'hand' }
  | null

export type DecreeCardDragInput = {
  cardId: string
  defId: string
  /** Off for a card that may not be laid in the Decree now. */
  isDraggable: boolean
  /** The press became a drag (a hand card drops its hold timer). */
  onDragStart?: () => void
}

export type DecreeCardDrag = {
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void
  /** True while this card follows the pointer. */
  isDragging: () => boolean
  /** True once after a drag ended: the click that follows it is not a tap. */
  consumeDragEnded: () => boolean
}

/** Column slot under the point that takes the card; null when there is none. */
function offeredColumnAt(point: ScreenPoint, cardId: string): string | null {
  const panel: DecreePanelHudState = getHudSnapshot().decreePanel
  if (panel === null) {
    return null
  }
  const column: string | undefined = document
    .elementsFromPoint(point.x, point.y)
    .flatMap((element) =>
      element instanceof HTMLElement &&
      element.dataset.decreeColumn !== undefined
        ? [element.dataset.decreeColumn]
        : [],
    )[0]
  return column !== undefined &&
    isDecreeColumnOfferedFor(panel.view, { cardId, column })
    ? column
    : null
}

function isInsideDecreePanel(point: ScreenPoint): boolean {
  const frame: DOMRect | undefined = document
    .querySelector(DECREE_PANEL_SELECTOR)
    ?.getBoundingClientRect()
  return (
    frame !== undefined &&
    point.x >= frame.left &&
    point.x <= frame.right &&
    point.y >= frame.top &&
    point.y <= frame.bottom
  )
}

/** A slot takes the card; a staged card dragged off the panel goes back to the hand. */
function dropTargetAt(point: ScreenPoint, cardId: string): DecreeDropTarget {
  const column: string | null = offeredColumnAt(point, cardId)
  if (column !== null) {
    return { kind: 'column', column }
  }
  const isStaged: boolean =
    getHudSnapshot().decreePanel?.view.stagedCardIds.includes(cardId) === true
  return isStaged && !isInsideDecreePanel(point) ? { kind: 'hand' } : null
}

/**
 * Drag of a card onto a Decree panel slot: a hand card is laid, a staged card
 * moves to another slot or goes back to the hand. Pointer events, so it works
 * by mouse and by touch.
 */
export function useDecreeCardDrag(input: DecreeCardDragInput): DecreeCardDrag {
  const isDraggingRef = useRef<boolean>(false)
  const hasDragEndedRef = useRef<boolean>(false)
  const stopListeningRef = useRef<(() => void) | null>(null)

  useEffect(
    () => (): void => {
      stopListeningRef.current?.()
    },
    [],
  )

  function onPointerDown(event: ReactPointerEvent<HTMLElement>): void {
    hasDragEndedRef.current = false
    if (!input.isDraggable || event.button !== PRIMARY_POINTER_BUTTON) {
      return
    }
    stopListeningRef.current?.()
    const startPoint: ScreenPoint = { x: event.clientX, y: event.clientY }

    function onPointerMove(moveEvent: PointerEvent): void {
      const point: ScreenPoint = { x: moveEvent.clientX, y: moveEvent.clientY }
      if (!isDraggingRef.current) {
        const distance: number = Math.hypot(
          point.x - startPoint.x,
          point.y - startPoint.y,
        )
        if (distance < DRAG_START_DISTANCE_PIXELS) {
          return
        }
        isDraggingRef.current = true
        input.onDragStart?.()
      }
      patchHud({
        decreeDrag: {
          cardId: input.cardId,
          defId: input.defId,
          x: point.x,
          y: point.y,
          overColumn: offeredColumnAt(point, input.cardId),
        },
      })
    }

    function stopListening(): void {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', stopListening)
      stopListeningRef.current = null
      if (isDraggingRef.current) {
        isDraggingRef.current = false
        hasDragEndedRef.current = true
        patchHud({ decreeDrag: null })
      }
    }

    function onPointerUp(upEvent: PointerEvent): void {
      const wasDragging: boolean = isDraggingRef.current
      stopListening()
      if (!wasDragging) {
        return
      }
      const target: DecreeDropTarget = dropTargetAt(
        { x: upEvent.clientX, y: upEvent.clientY },
        input.cardId,
      )
      if (target?.kind === 'column') {
        getHudCallbacks().onDecreeCardStaged({
          cardId: input.cardId,
          column: target.column,
        })
      } else if (target?.kind === 'hand') {
        getHudCallbacks().onDecreeCardTakenBack(input.cardId)
      }
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', stopListening)
    stopListeningRef.current = stopListening
  }

  return {
    onPointerDown,
    isDragging: (): boolean => isDraggingRef.current,
    consumeDragEnded: (): boolean => {
      const hasEnded: boolean = hasDragEndedRef.current
      hasDragEndedRef.current = false
      return hasEnded
    },
  }
}

/** The card being dragged, drawn under the pointer. */
export function DecreeDragGhost(): JSX.Element | null {
  const drag: DecreeDragHudState = useSyncExternalStore(
    subscribeHud,
    () => getHudSnapshot().decreeDrag,
    () => getHudSnapshot().decreeDrag,
  )
  const imagePath: string | null =
    drag !== null ? cardImagePublicPath(drag.defId) : null
  if (drag === null || imagePath === null) {
    return null
  }
  return (
    <img
      className={GHOST_CLASS_NAME}
      style={{ left: drag.x, top: drag.y }}
      src={imagePath}
      alt=""
      draggable={false}
    />
  )
}
