import type Phaser from 'phaser'

/** Logical game design size (coords, layout). Canvas buffer may be larger. */
export const GAME_LOGICAL_WIDTH = 1280
export const GAME_LOGICAL_HEIGHT = 720

/** Cap DPR so mid-tier GPUs not crushed (3x/4x phones). */
export const MAX_DEVICE_PIXEL_RATIO = 2

export function resolveDevicePixelRatio(): number {
  if (typeof window === 'undefined') {
    return 1
  }
  return Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO)
}

/**
 * Scale Manager uses width/height × DPR with zoom 1/DPR so the backing
 * canvas is dense. Camera zoom restores logical 1280×720 world coords.
 */
export function applyHiDpiCamera(scene: Phaser.Scene): void {
  const ratio = resolveDevicePixelRatio()
  scene.cameras.main.setZoom(ratio)
  scene.cameras.main.centerOn(
    GAME_LOGICAL_WIDTH / 2,
    GAME_LOGICAL_HEIGHT / 2,
  )
}

export function gameViewSize(): { width: number; height: number } {
  return {
    width: GAME_LOGICAL_WIDTH,
    height: GAME_LOGICAL_HEIGHT,
  }
}

type PhaserWithTextFactory = {
  GameObjects: {
    GameObjectFactory: {
      prototype: {
        text: (
          this: Phaser.GameObjects.GameObjectFactory,
          x: number,
          y: number,
          content: string | string[],
          style?: Phaser.Types.GameObjects.Text.TextStyle,
        ) => Phaser.GameObjects.Text
      }
    }
  }
}

/**
 * Text textures stay 1× unless resolution raised; camera zoom would soften them.
 * Call once before `new Phaser.Game`.
 */
export function installHiDpiTextResolution(
  PhaserNamespace: PhaserWithTextFactory,
): void {
  const ratio = resolveDevicePixelRatio()
  if (ratio <= 1) {
    return
  }

  const originalText = PhaserNamespace.GameObjects.GameObjectFactory.prototype.text
  PhaserNamespace.GameObjects.GameObjectFactory.prototype.text = function (
    this: Phaser.GameObjects.GameObjectFactory,
    x: number,
    y: number,
    content: string | string[],
    style?: Phaser.Types.GameObjects.Text.TextStyle,
  ): Phaser.GameObjects.Text {
    const textObject = originalText.call(this, x, y, content, style)
    textObject.setResolution(ratio)
    return textObject
  }
}
