import {
  BoxGeometry,
  CircleGeometry,
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  Scene,
  SRGBColorSpace,
  Texture,
} from 'three'
import type { MapWorldSize } from '#game/map3d/mapWorldSpace.ts'

/** The board is a slab lying on a dark table that fades into fog. */
export const BOARD_THICKNESS = 1.2
const BOARD_EDGE_COLOR = 0x5b4630
const TABLE_COLOR = 0x2b4136
const TABLE_RADIUS = 600
const TABLE_SEGMENT_COUNT = 48
/** `--color-forest-deep`: the table fades into the game backdrop. */
const BACKGROUND_COLOR = 0x24362e
const FOG_NEAR = 160
const FOG_FAR = 420

const SKY_LIGHT_COLOR = 0xfff3dc
const GROUND_LIGHT_COLOR = 0x39503f
const SKY_LIGHT_INTENSITY = 1.5
const SUN_COLOR = 0xffe2b0
const SUN_INTENSITY = 2.1
const SUN_POSITION = { x: -55, y: 90, z: 40 } as const
const SHADOW_MAP_SIZE_PIXELS = 2048
const SHADOW_AREA_HALF_SIZE = 75
const SHADOW_CAMERA_FAR = 260
const SHADOW_BIAS = -0.0006
const SHADOW_NORMAL_BIAS = 0.05

const QUARTER_TURN_RADIANS = Math.PI / 2

export function createMapTexture(image: HTMLImageElement): Texture {
  const texture: Texture = new Texture(image)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 8
  texture.needsUpdate = true
  return texture
}

function createBoard(worldSize: MapWorldSize, mapTexture: Texture): Mesh {
  const edgeMaterial: MeshStandardMaterial = new MeshStandardMaterial({
    color: BOARD_EDGE_COLOR,
    roughness: 1,
  })
  const topMaterial: MeshStandardMaterial = new MeshStandardMaterial({
    map: mapTexture,
    roughness: 1,
  })
  // Box faces: +x, -x, +y (top), -y, +z, -z.
  const board: Mesh = new Mesh(
    new BoxGeometry(worldSize.width, BOARD_THICKNESS, worldSize.depth),
    [
      edgeMaterial,
      edgeMaterial,
      topMaterial,
      edgeMaterial,
      edgeMaterial,
      edgeMaterial,
    ],
  )
  board.position.y = -BOARD_THICKNESS / 2
  board.receiveShadow = true
  board.castShadow = true
  return board
}

function createTable(): Mesh {
  const table: Mesh = new Mesh(
    new CircleGeometry(TABLE_RADIUS, TABLE_SEGMENT_COUNT),
    new MeshStandardMaterial({ color: TABLE_COLOR, roughness: 1 }),
  )
  table.rotation.x = -QUARTER_TURN_RADIANS
  table.position.y = -BOARD_THICKNESS
  table.receiveShadow = true
  return table
}

function createSun(): DirectionalLight {
  const sun: DirectionalLight = new DirectionalLight(SUN_COLOR, SUN_INTENSITY)
  sun.position.set(SUN_POSITION.x, SUN_POSITION.y, SUN_POSITION.z)
  sun.castShadow = true
  sun.shadow.mapSize.set(SHADOW_MAP_SIZE_PIXELS, SHADOW_MAP_SIZE_PIXELS)
  sun.shadow.camera.left = -SHADOW_AREA_HALF_SIZE
  sun.shadow.camera.right = SHADOW_AREA_HALF_SIZE
  sun.shadow.camera.top = SHADOW_AREA_HALF_SIZE
  sun.shadow.camera.bottom = -SHADOW_AREA_HALF_SIZE
  sun.shadow.camera.far = SHADOW_CAMERA_FAR
  sun.shadow.bias = SHADOW_BIAS
  sun.shadow.normalBias = SHADOW_NORMAL_BIAS
  return sun
}

/** Scene with the board, the table under it and the daylight. */
export function createMapEnvironment(
  worldSize: MapWorldSize,
  mapTexture: Texture,
): Scene {
  const scene: Scene = new Scene()
  scene.background = new Color(BACKGROUND_COLOR)
  scene.fog = new Fog(BACKGROUND_COLOR, FOG_NEAR, FOG_FAR)
  scene.add(
    createBoard(worldSize, mapTexture),
    createTable(),
    new HemisphereLight(
      SKY_LIGHT_COLOR,
      GROUND_LIGHT_COLOR,
      SKY_LIGHT_INTENSITY,
    ),
    createSun(),
  )
  return scene
}
