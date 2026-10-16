import { Raycaster, Vector2, type Camera } from 'three'

/**
 * Follows the mouse over the map and casts its ray into the scene, for the
 * parts of it that answer to being pointed at. A finger has no hover.
 */
export type MapHoverInput = {
  /** Takes the pointer moves: the element around the canvas. */
  element: HTMLElement
  camera: Camera
  /** Called with the pointer's ray, or with null once it left the map. */
  onHover: (raycaster: Raycaster | null) => void
}

export type MapHover = {
  /** The camera moved under a still pointer: cast its ray again. */
  refresh: () => void
  dispose: () => void
}

const TOUCH_POINTER_TYPE = 'touch'

export function createMapHover(input: MapHoverInput): MapHover {
  const raycaster: Raycaster = new Raycaster()
  /** Where the pointer is, in normalized device coordinates; null off the map. */
  let pointer: Vector2 | null = null

  const refresh = (): void => {
    if (pointer === null) {
      input.onHover(null)
      return
    }
    raycaster.setFromCamera(pointer, input.camera)
    input.onHover(raycaster)
  }

  const onPointerMove = (event: PointerEvent): void => {
    if (event.pointerType === TOUCH_POINTER_TYPE) {
      return
    }
    // Read off the element as drawn: the view may be scaled to the screen.
    const bounds: DOMRect = input.element.getBoundingClientRect()
    pointer = new Vector2(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      1 - ((event.clientY - bounds.top) / bounds.height) * 2,
    )
    refresh()
  }
  const onPointerLeave = (): void => {
    pointer = null
    refresh()
  }
  input.element.addEventListener('pointermove', onPointerMove)
  input.element.addEventListener('pointerleave', onPointerLeave)

  return {
    refresh,
    dispose: (): void => {
      input.element.removeEventListener('pointermove', onPointerMove)
      input.element.removeEventListener('pointerleave', onPointerLeave)
    },
  }
}
