import { CanvasTexture, SRGBColorSpace } from 'three'

/**
 * The 2D icon of a piece, with a white border along its outline: round for a
 * token, the meeple's silhouette for a warrior, a square for a building.
 */
export type IconTextureRequest = {
  imagePath: string
  /** A building icon is a square: its corners are rounded off a little. */
  roundedCorners: boolean
}

const ICON_TEXTURE_SIZE_PIXELS = 256
const ICON_BORDER_WIDTH_PIXELS = 3
const ICON_BORDER_COLOR = '#ffffff'
const ICON_CORNER_RADIUS_PIXELS = 26
/** The border is the outline stamped this many times around the icon. */
const ICON_BORDER_STAMP_COUNT = 32
const ICON_ART_SIZE_PIXELS: number =
  ICON_TEXTURE_SIZE_PIXELS - ICON_BORDER_WIDTH_PIXELS * 2
const FULL_TURN_RADIANS = Math.PI * 2

function createCanvas(sizePixels: number): HTMLCanvasElement {
  const canvas: HTMLCanvasElement = document.createElement('canvas')
  canvas.width = sizePixels
  canvas.height = sizePixels
  return canvas
}

/** The icon art at its size inside the border, corners rounded if asked. */
function drawArt(
  image: HTMLImageElement,
  roundedCorners: boolean,
): HTMLCanvasElement {
  const canvas: HTMLCanvasElement = createCanvas(ICON_ART_SIZE_PIXELS)
  const context: CanvasRenderingContext2D | null = canvas.getContext('2d')
  if (context === null) {
    return canvas
  }
  if (roundedCorners) {
    context.beginPath()
    context.roundRect(
      0,
      0,
      ICON_ART_SIZE_PIXELS,
      ICON_ART_SIZE_PIXELS,
      ICON_CORNER_RADIUS_PIXELS,
    )
    context.clip()
  }
  context.drawImage(image, 0, 0, ICON_ART_SIZE_PIXELS, ICON_ART_SIZE_PIXELS)
  return canvas
}

/** The shape of the art, filled with the border colour. */
function drawSilhouette(art: HTMLCanvasElement): HTMLCanvasElement {
  const canvas: HTMLCanvasElement = createCanvas(ICON_ART_SIZE_PIXELS)
  const context: CanvasRenderingContext2D | null = canvas.getContext('2d')
  if (context === null) {
    return canvas
  }
  context.drawImage(art, 0, 0)
  context.globalCompositeOperation = 'source-in'
  context.fillStyle = ICON_BORDER_COLOR
  context.fillRect(0, 0, ICON_ART_SIZE_PIXELS, ICON_ART_SIZE_PIXELS)
  return canvas
}

function drawBorderedIcon(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  roundedCorners: boolean,
): void {
  const context: CanvasRenderingContext2D | null = canvas.getContext('2d')
  if (context === null) {
    return
  }
  const art: HTMLCanvasElement = drawArt(image, roundedCorners)
  const silhouette: HTMLCanvasElement = drawSilhouette(art)
  for (
    let stampIndex = 0;
    stampIndex < ICON_BORDER_STAMP_COUNT;
    stampIndex += 1
  ) {
    const angle: number =
      (stampIndex / ICON_BORDER_STAMP_COUNT) * FULL_TURN_RADIANS
    context.drawImage(
      silhouette,
      ICON_BORDER_WIDTH_PIXELS + Math.cos(angle) * ICON_BORDER_WIDTH_PIXELS,
      ICON_BORDER_WIDTH_PIXELS + Math.sin(angle) * ICON_BORDER_WIDTH_PIXELS,
    )
  }
  context.drawImage(art, ICON_BORDER_WIDTH_PIXELS, ICON_BORDER_WIDTH_PIXELS)
}

/** Blank until the image has loaded, then the bordered icon. */
export function createIconTexture(request: IconTextureRequest): CanvasTexture {
  const canvas: HTMLCanvasElement = createCanvas(ICON_TEXTURE_SIZE_PIXELS)
  const texture: CanvasTexture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  const image: HTMLImageElement = new Image()
  image.onload = (): void => {
    drawBorderedIcon(canvas, image, request.roundedCorners)
    texture.needsUpdate = true
  }
  image.src = request.imagePath
  return texture
}
