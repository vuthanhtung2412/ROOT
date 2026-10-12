import {
  CanvasTexture,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  type Object3D,
} from 'three'

/**
 * An empty building slot: a drawing on the ground, not an object. A square
 * of darker earth with four corner marks, as in the digital game.
 */
export type SlotDrawings = {
  /** A new slot drawing, lying on the ground at its parent's origin. */
  create: () => Object3D
  dispose: () => void
}

/** Side of the drawing, world units. */
const SLOT_SIZE = 1.9
/** Just clear of the ground, so the two never flicker. */
const SLOT_LIFT = 0.02
const SLOT_TEXTURE_SIZE_PIXELS = 256
const SLOT_STAIN_COLOR = 'rgb(58, 50, 36)'
const SLOT_STAIN_OPACITY = 0.5
/**
 * The edge of the stain is soft: it is laid in thin coats, each a little
 * smaller, over this many pixels.
 */
const SLOT_STAIN_FEATHER_PIXELS = 14
const SLOT_STAIN_COAT_COUNT = 7
/** The stain is a square, this far in from the corner marks. */
const SLOT_STAIN_INSET_PIXELS = 12
const SLOT_MARK_COLOR = 'rgba(236, 230, 208, 0.9)'
const SLOT_MARK_WIDTH_PIXELS = 13
/** Corner marks: how far in from the edge they sit, how long their arms are. */
const SLOT_MARK_INSET_PIXELS = 22
const SLOT_MARK_ARM_PIXELS = 58
/** The corners of the drawing, as (±1, ±1). */
const SLOT_CORNER_SIGNS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
]
const HALF = 0.5
const DOUBLE = 2
const QUARTER_TURN_RADIANS = Math.PI * HALF

function paintSlot(canvas: HTMLCanvasElement): void {
  const context: CanvasRenderingContext2D | null = canvas.getContext('2d')
  if (context === null) {
    return
  }
  const center: number = SLOT_TEXTURE_SIZE_PIXELS * HALF
  const cornerReach: number = center - SLOT_MARK_INSET_PIXELS
  const stainReach: number = cornerReach - SLOT_STAIN_INSET_PIXELS
  context.fillStyle = SLOT_STAIN_COLOR
  // Equal coats that add up to the stain's opacity where they all overlap.
  context.globalAlpha =
    1 - Math.pow(1 - SLOT_STAIN_OPACITY, 1 / SLOT_STAIN_COAT_COUNT)
  for (let coat = 0; coat < SLOT_STAIN_COAT_COUNT; coat += 1) {
    const coatReach: number =
      stainReach -
      (SLOT_STAIN_FEATHER_PIXELS * coat) / (SLOT_STAIN_COAT_COUNT - 1)
    context.beginPath()
    context.roundRect(
      center - coatReach,
      center - coatReach,
      coatReach * DOUBLE,
      coatReach * DOUBLE,
      SLOT_STAIN_FEATHER_PIXELS,
    )
    context.fill()
  }
  context.globalAlpha = 1
  context.strokeStyle = SLOT_MARK_COLOR
  context.lineWidth = SLOT_MARK_WIDTH_PIXELS
  context.lineCap = 'round'
  context.lineJoin = 'round'
  for (const [signX, signY] of SLOT_CORNER_SIGNS) {
    const cornerX: number = center + signX * cornerReach
    const cornerY: number = center + signY * cornerReach
    // Each corner is an L, open towards the middle of the slot.
    context.beginPath()
    context.moveTo(cornerX - signX * SLOT_MARK_ARM_PIXELS, cornerY)
    context.lineTo(cornerX, cornerY)
    context.lineTo(cornerX, cornerY - signY * SLOT_MARK_ARM_PIXELS)
    context.stroke()
  }
}

export function createSlotDrawings(): SlotDrawings {
  const canvas: HTMLCanvasElement = document.createElement('canvas')
  canvas.width = SLOT_TEXTURE_SIZE_PIXELS
  canvas.height = SLOT_TEXTURE_SIZE_PIXELS
  paintSlot(canvas)
  const texture: CanvasTexture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  const geometry: PlaneGeometry = new PlaneGeometry(SLOT_SIZE, SLOT_SIZE)
  const material: MeshStandardMaterial = new MeshStandardMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    roughness: 1,
  })
  return {
    create: (): Object3D => {
      const drawing: Mesh = new Mesh(geometry, material)
      drawing.rotation.x = -QUARTER_TURN_RADIANS
      drawing.position.y = SLOT_LIFT
      drawing.receiveShadow = true
      // The holder is what the caller turns to face the slot its own way.
      const slot: Group = new Group()
      slot.add(drawing)
      return slot
    },
    dispose: (): void => {
      geometry.dispose()
      texture.dispose()
      material.dispose()
    },
  }
}
