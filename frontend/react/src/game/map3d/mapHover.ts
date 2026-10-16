import {
  Raycaster,
  Vector2,
  type Camera,
  type Intersection,
  type Object3D,
} from 'three'

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
  /** Call once per frame: casts the ray of where the pointer is now. */
  refresh: () => void
  dispose: () => void
}

/** Something the pointer can be over, under its key. */
export type HoverTarget = {
  key: string
  object: Object3D
}

const TOUCH_POINTER_TYPE = 'touch'

/** The ray hits a hidden part too (a pawn's unlit torch): it is not there. */
function isShown(part: Object3D | null): boolean {
  return part === null || (part.visible && isShown(part.parent))
}

/** The key of the nearest target the ray hits, or null if it hits none. */
export function nearestHoverTargetKey(
  raycaster: Raycaster,
  targets: readonly HoverTarget[],
): string | null {
  let nearestKey: string | null = null
  let nearestDistance: number = Infinity
  for (const target of targets) {
    const hits: Intersection[] = raycaster.intersectObject(target.object)
    const distance: number =
      hits.find((hit: Intersection): boolean => isShown(hit.object))
        ?.distance ?? Infinity
    if (distance < nearestDistance) {
      nearestDistance = distance
      nearestKey = target.key
    }
  }
  return nearestKey
}

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
  }
  const onPointerLeave = (): void => {
    pointer = null
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
