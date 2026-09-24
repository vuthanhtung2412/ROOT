import type Phaser from 'phaser'

/** Menu camera flash before wallpaper paints. */
export const PARCHMENT_BOTTOM = 0x7a6548

/** Game letterbox / canvas fallback. */
export const WOODLAND_CANVAS_FALLBACK_HEX = '#121810'
export const WOODLAND_BOTTOM = 0x121810

const WALLPAPER_DEPTH = -100

/** CSS object-fit: cover scale for a source image into bounds. */
export function coverScaleForBounds(
  sourceWidth: number,
  sourceHeight: number,
  boundWidth: number,
  boundHeight: number,
): number {
  return Math.max(boundWidth / sourceWidth, boundHeight / sourceHeight)
}

/** Full-bleed wallpaper; crops edges like CSS cover. */
export function drawCoverWallpaper(
  scene: Phaser.Scene,
  width: number,
  height: number,
  textureKey: string,
  depth: number = WALLPAPER_DEPTH,
): Phaser.GameObjects.Image {
  const image = scene.add
    .image(width / 2, height / 2, textureKey)
    .setOrigin(0.5)
    .setDepth(depth)
  const source = image.texture.getSourceImage()
  const scale = coverScaleForBounds(
    source.width,
    source.height,
    width,
    height,
  )
  image.setScale(scale)
  return image
}
