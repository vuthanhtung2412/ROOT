import type Phaser from 'phaser'

/** Menu cream gradient. */
export const PARCHMENT_TOP = 0xcbb896
export const PARCHMENT_BOTTOM = 0x7a6548

/** Game letterbox green gradient. */
export const WOODLAND_TOP = 0x1a2618
export const WOODLAND_BOTTOM = 0x121810
export const WOODLAND_CANVAS_FALLBACK_HEX = '#121810'

export function drawVerticalGradient(
  scene: Phaser.Scene,
  width: number,
  height: number,
  topColor: number,
  bottomColor: number,
  depth = -100,
): void {
  const graphics = scene.add.graphics().setDepth(depth)
  graphics.fillGradientStyle(topColor, topColor, bottomColor, bottomColor, 1)
  graphics.fillRect(0, 0, width, height)
}
