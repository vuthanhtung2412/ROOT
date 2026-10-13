import {
  CircleGeometry,
  Group,
  Mesh,
  RingGeometry,
  type MeshBasicMaterial,
} from 'three'
import { CLEARING_FLASH_MS } from '#game/clearingFlash.ts'
import { createFlatMaterial, layFlat } from '#game/map3d/clearingMarks.ts'
import type { ClearingGround } from '#game/map3d/mapTerrain.ts'

/**
 * Flash of a clearing clicked in the game log: its soil lights up inside a
 * gold rim, then fades back. One clearing flashes at a time.
 */
export type ClearingFlashMark = {
  group: Group
  flash: (clearingId: number) => void
  /** Call once per frame. */
  update: (elapsedSeconds: number) => void
}

const MILLISECONDS_PER_SECOND = 1000
const CLEARING_FLASH_SECONDS = CLEARING_FLASH_MS / MILLISECONDS_PER_SECOND
const CIRCLE_SEGMENT_COUNT = 72

/** Above every other mark of the clearing, so nothing flickers. */
const FLASH_SOIL_HEIGHT = 0.075
const FLASH_RIM_HEIGHT = 0.08

/** In clearing radii. */
const FLASH_RIM_INNER_RADIUS_RATIO = 0.92
const FLASH_RIM_OUTER_RADIUS_RATIO = 1.02

const FLASH_SOIL_COLOR = 0xfff8e6
const FLASH_RIM_COLOR = 0xc9a04a
const FLASH_SOIL_OPACITY = 0.7

/** 1 as the flash starts, 0 once it is over; most of it goes early. */
export function clearingFlashStrength(secondsSinceStart: number): number {
  const remainingShare: number = 1 - secondsSinceStart / CLEARING_FLASH_SECONDS
  if (remainingShare <= 0) {
    return 0
  }
  return Math.min(remainingShare, 1) ** 2
}

export function createClearingFlashMark(
  clearings: readonly ClearingGround[],
): ClearingFlashMark {
  const soilMaterial: MeshBasicMaterial = createFlatMaterial(null)
  soilMaterial.color.set(FLASH_SOIL_COLOR)
  const rimMaterial: MeshBasicMaterial = createFlatMaterial(null)
  rimMaterial.color.set(FLASH_RIM_COLOR)
  const group: Group = new Group()
  group.add(
    layFlat(
      new Mesh(new CircleGeometry(1, CIRCLE_SEGMENT_COUNT), soilMaterial),
      FLASH_SOIL_HEIGHT,
    ),
    layFlat(
      new Mesh(
        new RingGeometry(
          FLASH_RIM_INNER_RADIUS_RATIO,
          FLASH_RIM_OUTER_RADIUS_RATIO,
          CIRCLE_SEGMENT_COUNT,
        ),
        rimMaterial,
      ),
      FLASH_RIM_HEIGHT,
    ),
  )
  group.visible = false

  /** Null until the first frame after the flash was asked for. */
  let startSeconds: number | null = null

  return {
    group,
    flash: (clearingId: number): void => {
      const clearing: ClearingGround | undefined = clearings.find(
        (candidate: ClearingGround): boolean =>
          candidate.clearingId === clearingId,
      )
      if (clearing === undefined) {
        return
      }
      group.position.set(clearing.center.x, 0, clearing.center.z)
      group.scale.set(clearing.radius, 1, clearing.radius)
      group.visible = true
      startSeconds = null
    },
    update: (elapsedSeconds: number): void => {
      if (!group.visible) {
        return
      }
      startSeconds ??= elapsedSeconds
      const strength: number = clearingFlashStrength(
        elapsedSeconds - startSeconds,
      )
      soilMaterial.opacity = FLASH_SOIL_OPACITY * strength
      rimMaterial.opacity = strength
      group.visible = strength > 0
    },
  }
}
