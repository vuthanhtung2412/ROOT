import {
  Group,
  Sprite,
  SpriteMaterial,
  type CanvasTexture,
  type Color,
  type HemisphereLight,
} from 'three'
import {
  CLOUD_ASPECT_RATIO,
  createCloudTexture,
} from '#game/map3d/cloudTexture.ts'
import {
  marginReach,
  MIST_LAYER_HEIGHTS,
  MIST_RENDER_ORDER,
} from '#game/map3d/edgeMist.ts'
import type { MapTerrain } from '#game/map3d/mapTerrain.ts'
import {
  groundDistance,
  type MapGroundPoint,
} from '#game/map3d/mapWorldSpace.ts'
import { createSeededRandom } from '#game/map3d/treePlacement.ts'

/**
 * Cartoon clouds drifting over the mist around the woodland, never over the
 * playable area. They take a little of the sky's colour as the day turns.
 */
export type CloudLighting = {
  skyLight: HemisphereLight
  /** The backdrop the mist fades into. */
  backdrop: Color
}

export type SkyClouds = {
  group: Group
  /** Drift the clouds; call once per frame with the scene's clock. */
  update: (elapsedSeconds: number) => void
}

type DriftingCloud = {
  sprite: Sprite
  home: MapGroundPoint
  phaseRadians: number
  periodSeconds: number
}

const CLOUD_SEED = 7331
const CLOUD_SHAPE_SEEDS: readonly number[] = [11, 23, 47, 89]
const CLOUD_COUNT = 500
const MAXIMUM_PLACEMENT_TRIES = 15000
/** Clouds keep this far apart, centre to centre: they overlap, never stack. */
const MINIMUM_CLOUD_SPACING = 4
/** Clouds sit this far out, in margins: a little past the edge of the playable area. */
const CLOUD_INNER_MARGIN_REACH = 0.25
const CLOUD_OUTER_MARGIN_REACH = 1.5
const MINIMUM_CLOUD_WIDTH = 9
const CLOUD_WIDTH_SPREAD = 8
/** Just over the highest layer of mist, stacked in layers well apart. */
const CLOUD_HEIGHT_ABOVE_MIST = 2
const CLOUD_HEIGHT_SPREAD = 10
/** Over the mist. */
const CLOUD_RENDER_ORDER = MIST_RENDER_ORDER + 1
/**
 * The clouds take the light of the sky: peach at dawn, blue and dim at
 * night. At this strength of it they shine full white.
 */
const FULL_SKY_LIGHT_INTENSITY = 1.5
/** Share of the backdrop mixed in, so the clouds sit in the mist. */
const BACKDROP_BLEND_SHARE = 0.6
/** The mist and the woodland show a little through the clouds. */
const CLOUD_OPACITY = 0.8
const DRIFT_DISTANCE = 3
const MINIMUM_DRIFT_PERIOD_SECONDS = 45
const DRIFT_PERIOD_SPREAD_SECONDS = 35
const FULL_TURN_RADIANS = Math.PI * 2
const HALF = 0.5

/** Spots in the band around the woodland, so many tries allow. */
function placeClouds(
  terrain: MapTerrain,
  random: () => number,
): MapGroundPoint[] {
  const halfReachX: number =
    terrain.worldSize.width * HALF + terrain.marginX * CLOUD_OUTER_MARGIN_REACH
  const halfReachZ: number =
    terrain.worldSize.depth * HALF + terrain.marginZ * CLOUD_OUTER_MARGIN_REACH
  const spots: MapGroundPoint[] = []
  for (
    let attempt = 0;
    attempt < MAXIMUM_PLACEMENT_TRIES && spots.length < CLOUD_COUNT;
    attempt += 1
  ) {
    const spot: MapGroundPoint = {
      x: (random() * 2 - 1) * halfReachX,
      z: (random() * 2 - 1) * halfReachZ,
    }
    const reach: number = marginReach(terrain, spot)
    if (
      reach >= CLOUD_INNER_MARGIN_REACH &&
      reach <= CLOUD_OUTER_MARGIN_REACH &&
      // None south of the woodland: the hand of cards covers it.
      spot.z <= terrain.worldSize.depth * HALF &&
      spots.every(
        (taken: MapGroundPoint): boolean =>
          groundDistance(taken, spot) >= MINIMUM_CLOUD_SPACING,
      )
    ) {
      spots.push(spot)
    }
  }
  return spots
}

export function createSkyClouds(
  terrain: MapTerrain,
  lighting: CloudLighting,
): SkyClouds {
  const random: () => number = createSeededRandom(CLOUD_SEED)
  const materials: SpriteMaterial[] = CLOUD_SHAPE_SEEDS.map(
    (seed: number): SpriteMaterial => {
      const texture: CanvasTexture = createCloudTexture(seed)
      return new SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: CLOUD_OPACITY,
        depthWrite: false,
        fog: false,
        toneMapped: false,
      })
    },
  )
  const mistTop: number = Math.max(...MIST_LAYER_HEIGHTS)
  const group: Group = new Group()
  const clouds: DriftingCloud[] = placeClouds(terrain, random).flatMap(
    (home: MapGroundPoint, index: number): DriftingCloud[] => {
      const material: SpriteMaterial | undefined =
        materials[index % materials.length]
      if (material === undefined) {
        return []
      }
      const sprite: Sprite = new Sprite(material)
      const width: number = MINIMUM_CLOUD_WIDTH + random() * CLOUD_WIDTH_SPREAD
      sprite.scale.set(width, width / CLOUD_ASPECT_RATIO, 1)
      sprite.position.set(
        home.x,
        mistTop + CLOUD_HEIGHT_ABOVE_MIST + random() * CLOUD_HEIGHT_SPREAD,
        home.z,
      )
      sprite.renderOrder = CLOUD_RENDER_ORDER
      group.add(sprite)
      return [
        {
          sprite,
          home,
          phaseRadians: random() * FULL_TURN_RADIANS,
          periodSeconds:
            MINIMUM_DRIFT_PERIOD_SECONDS +
            random() * DRIFT_PERIOD_SPREAD_SECONDS,
        },
      ]
    },
  )

  return {
    group,
    update: (elapsedSeconds: number): void => {
      const brightness: number = Math.min(
        lighting.skyLight.intensity / FULL_SKY_LIGHT_INTENSITY,
        1,
      )
      for (const material of materials) {
        material.color
          .copy(lighting.skyLight.color)
          .multiplyScalar(brightness)
          .lerp(lighting.backdrop, BACKDROP_BLEND_SHARE)
      }
      for (const cloud of clouds) {
        cloud.sprite.position.x =
          cloud.home.x +
          Math.sin(
            (elapsedSeconds / cloud.periodSeconds) * FULL_TURN_RADIANS +
              cloud.phaseRadians,
          ) *
            DRIFT_DISTANCE
      }
    },
  }
}
