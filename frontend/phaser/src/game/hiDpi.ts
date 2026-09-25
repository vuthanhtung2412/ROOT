import type Phaser from 'phaser'

/** Logical game design size (coords, layout). Canvas buffer may be larger. */
export const GAME_LOGICAL_WIDTH = 1280
export const GAME_LOGICAL_HEIGHT = 720

/** Cap DPR so mid-tier GPUs not crushed (4x phones). */
export const MAX_DEVICE_PIXEL_RATIO = 3

let hiDpiTextResolution = 1
let hiDpiSyncInProgress = false

export function resolveDevicePixelRatio(): number {
  if (typeof window === 'undefined') {
    return 1
  }
  return Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO)
}

/**
 * Grow backing store with FIT CSS size × DPR so Retina / big windows
 * do not browser-upscale a soft canvas (sharpens every texture).
 */
export function syncHiDpiGameSize(game: Phaser.Game): void {
  if (hiDpiSyncInProgress) {
    return
  }

  const devicePixelRatio = resolveDevicePixelRatio()
  const displayWidth = game.scale.displaySize.width
  const displayHeight = game.scale.displaySize.height
  if (displayWidth < 2 || displayHeight < 2) {
    return
  }

  const bufferWidth = Math.round(displayWidth * devicePixelRatio)
  const bufferHeight = Math.round(displayHeight * devicePixelRatio)
  const cameraZoom = bufferWidth / GAME_LOGICAL_WIDTH

  if (
    game.scale.gameSize.width === bufferWidth &&
    game.scale.gameSize.height === bufferHeight
  ) {
    applyHiDpiToRunningScenes(game, cameraZoom)
    return
  }

  hiDpiSyncInProgress = true
  try {
    game.scale.setGameSize(bufferWidth, bufferHeight)
    game.scale.setZoom(1 / devicePixelRatio)
    applyHiDpiToRunningScenes(game, cameraZoom)
  } finally {
    hiDpiSyncInProgress = false
  }
}

export function applyHiDpiCamera(scene: Phaser.Scene): void {
  const cameraZoom = scene.scale.width / GAME_LOGICAL_WIDTH
  applyHiDpiCameraZoom(scene, cameraZoom)
  setHiDpiTextResolution(cameraZoom)
}

export function gameViewSize(): { width: number; height: number } {
  return {
    width: GAME_LOGICAL_WIDTH,
    height: GAME_LOGICAL_HEIGHT,
  }
}

type PhaserTextFactory = {
  // eslint-disable-next-line max-params -- Phaser upstream signature
  text: (
    this: Phaser.GameObjects.GameObjectFactory,
    x: number,
    y: number,
    content: string | string[],
    style?: Phaser.Types.GameObjects.Text.TextStyle,
  ) => Phaser.GameObjects.Text
}

type PhaserWithTextFactory = {
  GameObjects: {
    GameObjectFactory: {
      prototype: PhaserTextFactory
    }
  }
}

/** Call once before `new Phaser.Game`. */
export function installHiDpiTextResolution(
  PhaserNamespace: PhaserWithTextFactory,
): void {
  hiDpiTextResolution = resolveDevicePixelRatio()
  if (hiDpiTextResolution <= 1) {
    return
  }

  const textFactoryPrototype =
    PhaserNamespace.GameObjects.GameObjectFactory.prototype
  const originalText = textFactoryPrototype.text
  Object.defineProperty(textFactoryPrototype, 'text', {
    configurable: true,
    writable: true,
    // eslint-disable-next-line max-params -- Phaser upstream signature
    value: function (
      this: Phaser.GameObjects.GameObjectFactory,
      x: number,
      y: number,
      content: string | string[],
      style?: Phaser.Types.GameObjects.Text.TextStyle,
    ): Phaser.GameObjects.Text {
      const textObject = originalText.call(this, x, y, content, style)
      textObject.setResolution(hiDpiTextResolution)
      return textObject
    },
  })
}

function applyHiDpiToRunningScenes(
  game: Phaser.Game,
  cameraZoom: number,
): void {
  setHiDpiTextResolution(cameraZoom)
  for (const scene of game.scene.getScenes(true)) {
    applyHiDpiCameraZoom(scene, cameraZoom)
  }
}

function applyHiDpiCameraZoom(scene: Phaser.Scene, cameraZoom: number): void {
  scene.cameras.main.setZoom(cameraZoom)
  scene.cameras.main.centerOn(
    GAME_LOGICAL_WIDTH / 2,
    GAME_LOGICAL_HEIGHT / 2,
  )
}

function setHiDpiTextResolution(cameraZoom: number): void {
  hiDpiTextResolution = Math.max(1, cameraZoom)
}
