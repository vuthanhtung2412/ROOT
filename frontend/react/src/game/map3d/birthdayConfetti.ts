import {
  type Color,
  DoubleSide,
  InstancedMesh,
  type Matrix4,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
} from 'three'
import { pickPartyColor } from '#game/map3d/birthdayPartyColors.ts'
import type { ClearingGround, MapTerrain } from '#game/map3d/mapTerrain.ts'
import type { MapGroundPoint } from '#game/map3d/mapWorldSpace.ts'
import {
  createSeededRandom,
  distanceToRiver,
} from '#game/map3d/treePlacement.ts'

/**
 * Birthday edition: confetti strewn over the trodden ground of every
 * clearing, flat and small so the pieces on top stay easy to read.
 */
const CONFETTI_SEED = 2210
const CONFETTI_PER_CLEARING = 110
/** Confetti stays this far in from the edge of a clearing (ratio of its radius). */
const CONFETTI_SPREAD_RATIO = 0.95
const CONFETTI_LENGTH = 0.22
const CONFETTI_WIDTH = 0.12
const CONFETTI_SIZE_SPREAD = 0.4
/** Water and its banks stay clear: the river is about 1.4 either side of its line. */
const CONFETTI_RIVER_CLEARANCE = 1.8
/** Just over the ground, under the soil tint and rings of `clearingMarks.ts`. */
const CONFETTI_HEIGHT = 0.045
/** Pieces lie flat but not perfectly: a little tilt catches the light. */
const MAXIMUM_TILT_RADIANS = 0.25
const QUARTER_TURN_RADIANS = Math.PI / 2
const FULL_TURN_RADIANS = Math.PI * 2
const HALF = 0.5
const CONFETTI_ROUGHNESS = 0.6

/** One piece of confetti: how it lies, its colour. */
type ConfettiPiece = {
  matrix: Matrix4
  color: Color
}

/** One piece somewhere in the clearing, evenly over its area. */
function pieceGround(
  clearing: ClearingGround,
  random: () => number,
): MapGroundPoint {
  const distance: number =
    Math.sqrt(random()) * clearing.radius * CONFETTI_SPREAD_RATIO
  const angle: number = random() * FULL_TURN_RADIANS
  return {
    x: clearing.center.x + Math.cos(angle) * distance,
    z: clearing.center.z + Math.sin(angle) * distance,
  }
}

function placePiece(
  ground: MapGroundPoint,
  random: () => number,
  transform: Object3D,
): ConfettiPiece {
  transform.position.set(ground.x, CONFETTI_HEIGHT, ground.z)
  transform.rotation.set(
    -QUARTER_TURN_RADIANS + (random() - HALF) * 2 * MAXIMUM_TILT_RADIANS,
    (random() - HALF) * 2 * MAXIMUM_TILT_RADIANS,
    random() * FULL_TURN_RADIANS,
  )
  transform.scale.setScalar(1 + (random() - HALF) * CONFETTI_SIZE_SPREAD)
  transform.updateMatrix()
  return { matrix: transform.matrix.clone(), color: pickPartyColor(random()) }
}

/** Every piece of every clearing, none on the river crossing it. */
function placeConfetti(terrain: MapTerrain): ConfettiPiece[] {
  const random: () => number = createSeededRandom(CONFETTI_SEED)
  const transform: Object3D = new Object3D()
  return terrain.clearings.flatMap(
    (clearing: ClearingGround): ConfettiPiece[] =>
      Array.from({ length: CONFETTI_PER_CLEARING }, (): MapGroundPoint =>
        pieceGround(clearing, random),
      )
        .filter(
          (ground: MapGroundPoint): boolean =>
            distanceToRiver(ground, terrain) > CONFETTI_RIVER_CLEARANCE,
        )
        .map(
          (ground: MapGroundPoint): ConfettiPiece =>
            placePiece(ground, random, transform),
        ),
  )
}

/** All confetti of the map: one instanced mesh, one draw call. */
export function createBirthdayConfetti(terrain: MapTerrain): InstancedMesh {
  const pieces: ConfettiPiece[] = placeConfetti(terrain)
  const confetti: InstancedMesh = new InstancedMesh(
    new PlaneGeometry(CONFETTI_LENGTH, CONFETTI_WIDTH),
    new MeshStandardMaterial({
      roughness: CONFETTI_ROUGHNESS,
      // A piece tilted away from the camera still shows its colour.
      side: DoubleSide,
    }),
    pieces.length,
  )
  pieces.forEach((piece: ConfettiPiece, index: number): void => {
    confetti.setMatrixAt(index, piece.matrix)
    confetti.setColorAt(index, piece.color)
  })
  confetti.receiveShadow = true
  return confetti
}
