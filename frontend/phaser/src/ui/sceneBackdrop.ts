import type Phaser from 'phaser'

/**
 * Boot / letterbox / page chrome behind wallpapers.
 * Keep in sync with `style.css` html/body/#game background.
 */
export const CANVAS_FALLBACK_HEX = '#121810'

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
