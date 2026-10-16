import { CanvasTexture, SRGBColorSpace } from 'three'
import { createSeededRandom } from '#game/map3d/treePlacement.ts'

/**
 * A cartoon cloud, painted: puffs with thin tails, a soft outline, shade
 * underneath and white light on top. Painted in greys, so the sprite's tint
 * gives it the colour of the sky; its bottom fades out into the mist.
 */

const CLOUD_CANVAS_WIDTH_PIXELS = 512
const CLOUD_CANVAS_HEIGHT_PIXELS = 256
/** Width over height of the painted cloud, for the sprite to keep it. */
export const CLOUD_ASPECT_RATIO =
  CLOUD_CANVAS_WIDTH_PIXELS / CLOUD_CANVAS_HEIGHT_PIXELS
const OUTLINE_COLOR = '#a3a3a3'
const SHADE_COLOR = '#cbcbcb'
const MIDTONE_COLOR = '#e6e6e6'
const LIGHT_COLOR = '#ffffff'
const OUTLINE_WIDTH_PIXELS = 4
/** The bottom fades out from this many canvas heights above the baseline. */
const BOTTOM_FADE_HEIGHT_RATIO = 0.3
const OPAQUE = 'rgba(0, 0, 0, 1)'
const TRANSPARENT = 'rgba(0, 0, 0, 0)'
/** The flat bottom of the cloud, down the canvas. */
const BASELINE_RATIO = 0.8
const MINIMUM_PUFF_COUNT = 5
const PUFF_COUNT_SPREAD = 4
/** Puffs sit between these shares of the width. */
const PUFF_LEFT_RATIO = 0.2
const PUFF_RIGHT_RATIO = 0.8
/** Puff radius, in canvas heights: at the ends, and added in the middle. */
const PUFF_END_RADIUS_RATIO = 0.13
const PUFF_MIDDLE_RADIUS_RATIO = 0.17
const PUFF_RADIUS_JITTER = 0.4
/** Puffs stray left or right of their even spacing, in widths. */
const PUFF_POSITION_JITTER_RATIO = 0.06
/** Puffs this far towards the middle may carry another on top. */
const TOP_PUFF_MIDDLENESS = 0.6
const TOP_PUFF_CHANCE = 0.7
const TOP_PUFF_RADIUS_RADII = 0.65
const TOP_PUFF_LIFT_RADII = 0.6
/** Inner contour of each puff: a curl of shade along its lower right. */
const CONTOUR_RADIUS_RADII = 0.72
const CONTOUR_WIDTH_RADII = 0.07
const CONTOUR_START_RADIANS = Math.PI * 0.05
const CONTOUR_END_RADIANS = Math.PI * 0.6
/** The middle puffs also stand higher, by this many canvas heights. */
const PUFF_MIDDLE_LIFT_RATIO = 0.1
/** A puff's centre is this many radii above the baseline. */
const PUFF_CENTER_LIFT_RADII = 0.45
/** The tails run out to these shares of the width, this thick. */
const TAIL_LEFT_RATIO = 0.05
const TAIL_RIGHT_RATIO = 0.95
const TAIL_THICKNESS_RATIO = 0.06
/** Light falls from up-left: offset and size of each tone, in radii. */
const MIDTONE_OFFSET_X_RADII = -0.08
const MIDTONE_OFFSET_Y_RADII = -0.12
const MIDTONE_RADIUS_RADII = 0.85
const LIGHT_OFFSET_X_RADII = -0.16
const LIGHT_OFFSET_Y_RADII = -0.24
const LIGHT_RADIUS_RADII = 0.6
const FULL_TURN_RADIANS = Math.PI * 2
const HALF = 0.5

type Puff = {
  x: number
  y: number
  radius: number
}

type CloudShape = {
  puffs: readonly Puff[]
  baseline: number
}

type CloudPainter = {
  context: CanvasRenderingContext2D
  shape: CloudShape
}

/** 1 in the middle of the cloud, 0 at its ends. */
function middleness(widthShare: number): number {
  return Math.sin(
    ((widthShare - PUFF_LEFT_RATIO) / (PUFF_RIGHT_RATIO - PUFF_LEFT_RATIO)) *
      Math.PI,
  )
}

function shapeCloud(seed: number): CloudShape {
  const random: () => number = createSeededRandom(seed)
  const baseline: number = CLOUD_CANVAS_HEIGHT_PIXELS * BASELINE_RATIO
  const puffCount: number =
    MINIMUM_PUFF_COUNT + Math.floor(random() * PUFF_COUNT_SPREAD)
  const puffs: Puff[] = []
  for (let index = 0; index < puffCount; index += 1) {
    const widthShare: number =
      PUFF_LEFT_RATIO +
      ((PUFF_RIGHT_RATIO - PUFF_LEFT_RATIO) * index) / (puffCount - 1)
    const middle: number = middleness(widthShare)
    const radius: number =
      CLOUD_CANVAS_HEIGHT_PIXELS *
      (PUFF_END_RADIUS_RATIO + PUFF_MIDDLE_RADIUS_RATIO * middle) *
      (1 - PUFF_RADIUS_JITTER * HALF + random() * PUFF_RADIUS_JITTER)
    const puff: Puff = {
      x:
        (widthShare + (random() - HALF) * PUFF_POSITION_JITTER_RATIO) *
        CLOUD_CANVAS_WIDTH_PIXELS,
      y:
        baseline -
        radius * PUFF_CENTER_LIFT_RADII -
        middle * PUFF_MIDDLE_LIFT_RATIO * CLOUD_CANVAS_HEIGHT_PIXELS,
      radius,
    }
    puffs.push(puff)
    // The fuller middle heaps a smaller puff on top, off to one side.
    if (middle > TOP_PUFF_MIDDLENESS && random() < TOP_PUFF_CHANCE) {
      const topRadius: number = radius * TOP_PUFF_RADIUS_RADII
      puffs.push({
        x: puff.x + (random() - HALF) * radius,
        y: puff.y - radius * TOP_PUFF_LIFT_RADII,
        radius: topRadius,
      })
    }
  }
  return { puffs, baseline }
}

/** The puffs and the tails, grown by `grow` pixels all round. */
function traceCloud(painter: CloudPainter, grow: number): void {
  const { context, shape } = painter
  context.beginPath()
  for (const puff of shape.puffs) {
    context.moveTo(puff.x + puff.radius + grow, puff.y)
    context.arc(puff.x, puff.y, puff.radius + grow, 0, FULL_TURN_RADIANS)
  }
  const tailHalfThickness: number =
    CLOUD_CANVAS_HEIGHT_PIXELS * TAIL_THICKNESS_RATIO + grow
  const tailLeft: number = CLOUD_CANVAS_WIDTH_PIXELS * TAIL_LEFT_RATIO - grow
  const tailRight: number = CLOUD_CANVAS_WIDTH_PIXELS * TAIL_RIGHT_RATIO + grow
  context.moveTo(tailLeft, shape.baseline)
  context.quadraticCurveTo(
    CLOUD_CANVAS_WIDTH_PIXELS * HALF,
    shape.baseline - tailHalfThickness * 2,
    tailRight,
    shape.baseline,
  )
  context.closePath()
}

/** Keep the paint above a line: the flat bottom of the cloud. */
function clipAbove(context: CanvasRenderingContext2D, line: number): void {
  context.beginPath()
  context.rect(0, 0, CLOUD_CANVAS_WIDTH_PIXELS, line)
  context.clip()
}

function fillTone(
  painter: CloudPainter,
  tone: { color: string; offsetX: number; offsetY: number; radius: number },
): void {
  const { context, shape } = painter
  context.fillStyle = tone.color
  context.beginPath()
  for (const puff of shape.puffs) {
    const x: number = puff.x + tone.offsetX * puff.radius
    const y: number = puff.y + tone.offsetY * puff.radius
    context.moveTo(x + tone.radius * puff.radius, y)
    context.arc(x, y, tone.radius * puff.radius, 0, FULL_TURN_RADIANS)
  }
  context.fill()
}

function paintCloud(painter: CloudPainter): void {
  const { context, shape } = painter
  context.save()
  clipAbove(context, shape.baseline + OUTLINE_WIDTH_PIXELS)
  context.fillStyle = OUTLINE_COLOR
  traceCloud(painter, OUTLINE_WIDTH_PIXELS)
  context.fill()
  context.restore()

  context.save()
  clipAbove(context, shape.baseline)
  traceCloud(painter, 0)
  context.clip()
  context.fillStyle = SHADE_COLOR
  context.fillRect(0, 0, CLOUD_CANVAS_WIDTH_PIXELS, CLOUD_CANVAS_HEIGHT_PIXELS)
  fillTone(painter, {
    color: MIDTONE_COLOR,
    offsetX: MIDTONE_OFFSET_X_RADII,
    offsetY: MIDTONE_OFFSET_Y_RADII,
    radius: MIDTONE_RADIUS_RADII,
  })
  fillTone(painter, {
    color: LIGHT_COLOR,
    offsetX: LIGHT_OFFSET_X_RADII,
    offsetY: LIGHT_OFFSET_Y_RADII,
    radius: LIGHT_RADIUS_RADII,
  })
  strokeContours(painter)
  context.restore()
  fadeBottom(painter)
}

/** The cartoon lines inside the cloud, where one puff rolls over the next. */
function strokeContours(painter: CloudPainter): void {
  const { context, shape } = painter
  context.strokeStyle = SHADE_COLOR
  context.lineCap = 'round'
  for (const puff of shape.puffs) {
    context.lineWidth = puff.radius * CONTOUR_WIDTH_RADII
    context.beginPath()
    context.arc(
      puff.x,
      puff.y,
      puff.radius * CONTOUR_RADIUS_RADII,
      CONTOUR_START_RADIANS,
      CONTOUR_END_RADIANS,
    )
    context.stroke()
  }
}

export function createCloudTexture(seed: number): CanvasTexture {
  const canvas: HTMLCanvasElement = document.createElement('canvas')
  canvas.width = CLOUD_CANVAS_WIDTH_PIXELS
  canvas.height = CLOUD_CANVAS_HEIGHT_PIXELS
  const context: CanvasRenderingContext2D | null = canvas.getContext('2d')
  if (context !== null) {
    paintCloud({ context, shape: shapeCloud(seed) })
  }
  const texture: CanvasTexture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

/** Melt the base of the cloud into the mist under it. */
function fadeBottom(painter: CloudPainter): void {
  const { context, shape } = painter
  const fade: CanvasGradient = context.createLinearGradient(
    0,
    shape.baseline - CLOUD_CANVAS_HEIGHT_PIXELS * BOTTOM_FADE_HEIGHT_RATIO,
    0,
    shape.baseline + OUTLINE_WIDTH_PIXELS,
  )
  fade.addColorStop(0, OPAQUE)
  fade.addColorStop(1, TRANSPARENT)
  context.save()
  context.globalCompositeOperation = 'destination-in'
  context.fillStyle = fade
  context.fillRect(0, 0, CLOUD_CANVAS_WIDTH_PIXELS, CLOUD_CANVAS_HEIGHT_PIXELS)
  context.restore()
}
