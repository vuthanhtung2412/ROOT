import type { NormalizedMapPoint } from '#game/map3d/mapWorldSpace.ts'
import type { MapColorSampler, RgbColor } from '#game/map3d/treePlacement.ts'

/**
 * Small copy of the map art to read colours from: one pixel is about one
 * tree, so a sample is already the average colour under that tree.
 */
const SAMPLE_WIDTH_PIXELS = 255
const RGBA_CHANNEL_COUNT = 4
const GREEN_CHANNEL_OFFSET = 1
const BLUE_CHANNEL_OFFSET = 2
/** Reads as "no tree" (see `treeKindForColor`). */
const UNREADABLE_COLOR: RgbColor = { red: 255, green: 0, blue: 0 }

function clampIndex(value: number, length: number): number {
  return Math.min(Math.max(Math.floor(value), 0), length - 1)
}

export function createMapColorSampler(image: HTMLImageElement): MapColorSampler {
  const width: number = SAMPLE_WIDTH_PIXELS
  const height: number = Math.round(
    (SAMPLE_WIDTH_PIXELS * image.naturalHeight) / image.naturalWidth,
  )
  const canvas: HTMLCanvasElement = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context: CanvasRenderingContext2D | null = canvas.getContext('2d', {
    willReadFrequently: true,
  })
  if (context === null) {
    return (): RgbColor => UNREADABLE_COLOR
  }
  context.drawImage(image, 0, 0, width, height)
  const pixels: Uint8ClampedArray = context.getImageData(
    0,
    0,
    width,
    height,
  ).data
  return (point: NormalizedMapPoint): RgbColor => {
    const column: number = clampIndex(point.x * width, width)
    const row: number = clampIndex(point.y * height, height)
    const offset: number = (row * width + column) * RGBA_CHANNEL_COUNT
    return {
      red: pixels[offset] ?? UNREADABLE_COLOR.red,
      green: pixels[offset + GREEN_CHANNEL_OFFSET] ?? UNREADABLE_COLOR.green,
      blue: pixels[offset + BLUE_CHANNEL_OFFSET] ?? UNREADABLE_COLOR.blue,
    }
  }
}
