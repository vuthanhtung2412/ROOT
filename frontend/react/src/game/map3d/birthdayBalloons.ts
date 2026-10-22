import {
  type Color,
  Group,
  InstancedMesh,
  Matrix4,
  type Material,
  type Mesh,
  MeshStandardMaterial,
  Object3D,
} from 'three'
import { pickPartyColor } from '#game/map3d/birthdayPartyColors.ts'
import { meshesOf } from '#game/map3d/sceneObjects.ts'
import {
  createSeededRandom,
  type TreePlacement,
} from '#game/map3d/treePlacement.ts'

/**
 * Birthday edition: balloons tied one by one to the tops of pines, spread
 * evenly over the woodland, each in a colour of the party kit. The clearings
 * stay clear: only full-height pines carry them.
 */
const BALLOON_SEED = 1206
/**
 * Side of a square of woodland, world units: each square holds one balloon,
 * on one of its pines, so they are spread evenly but not in rows.
 */
const BALLOON_SPACING = 8
/**
 * Top of a pine per unit of tree scale, world units: the kit's pines are
 * about 1.4 tall, drawn at 2.5 times (`TREE_MODEL_SCALE` in treeMeshes.ts).
 */
const PINE_TOP_HEIGHT_PER_SCALE = 3.5
/** The string is tied a little inside the crown, not on its very tip. */
const TIE_HEIGHT_RATIO = 0.85
/** Model units → world units: a balloon on its string, about three tall. */
const BALLOON_MODEL_SCALE = 4.5
const BALLOON_SCALE_SPREAD = 0.25
/** A balloon leans a little off its knot, as if in a breeze, radians. */
const MAXIMUM_LEAN_RADIANS = 0.15
const FULL_TURN_RADIANS = Math.PI * 2
const HALF = 0.5

/** Material of the balloon itself in `balloon.glb`; the string keeps its own. */
const BALLOON_MATERIAL_NAME = 'balloon'
/** A bit of shine: balloons are rubber, not felt. */
const BALLOON_ROUGHNESS = 0.45

/** One balloon: where its string is tied, how it leans, its colour. */
type BalloonPlacement = {
  matrix: Matrix4
  color: Color
}

/** One balloon tied to the top of a pine. */
function placeBalloon(
  pine: TreePlacement,
  random: () => number,
  transform: Object3D,
): BalloonPlacement {
  const tieHeight: number =
    PINE_TOP_HEIGHT_PER_SCALE * pine.scale * TIE_HEIGHT_RATIO
  transform.position.set(pine.position.x, tieHeight, pine.position.z)
  transform.rotation.set(
    (random() - HALF) * 2 * MAXIMUM_LEAN_RADIANS,
    random() * FULL_TURN_RADIANS,
    (random() - HALF) * 2 * MAXIMUM_LEAN_RADIANS,
  )
  transform.scale.setScalar(
    BALLOON_MODEL_SCALE * (1 + (random() - HALF) * BALLOON_SCALE_SPREAD),
  )
  transform.updateMatrix()
  return { matrix: transform.matrix.clone(), color: pickPartyColor(random()) }
}

/** The full-height pines, by the square of woodland they stand in. */
function pinesBySquare(
  placements: readonly TreePlacement[],
): TreePlacement[][] {
  const squares: Map<string, TreePlacement[]> = new Map<
    string,
    TreePlacement[]
  >()
  for (const placement of placements) {
    if (placement.kind === 'pine') {
      const squareKey: string = [
        Math.floor(placement.position.x / BALLOON_SPACING),
        Math.floor(placement.position.z / BALLOON_SPACING),
      ].join(':')
      squares.set(squareKey, [...(squares.get(squareKey) ?? []), placement])
    }
  }
  return [...squares.values()]
}

/** One balloon per square of woodland, on a pine picked at random in it. */
function placeBalloons(
  placements: readonly TreePlacement[],
): BalloonPlacement[] {
  const random: () => number = createSeededRandom(BALLOON_SEED)
  const transform: Object3D = new Object3D()
  return pinesBySquare(placements).flatMap(
    (pines: TreePlacement[]): BalloonPlacement[] => {
      const pine: TreePlacement | undefined =
        pines[Math.floor(random() * pines.length)]
      return pine === undefined ? [] : [placeBalloon(pine, random, transform)]
    },
  )
}

function isBalloonPart(part: Mesh): boolean {
  return (
    !Array.isArray(part.material) &&
    part.material.name === BALLOON_MATERIAL_NAME
  )
}

/** The part's own material, the balloon one shinier and tinted per instance. */
function partMaterial(part: Mesh): Material {
  const material: Material | Material[] = part.material
  const single: Material = Array.isArray(material)
    ? new MeshStandardMaterial()
    : material.clone()
  if (isBalloonPart(part) && single instanceof MeshStandardMaterial) {
    single.roughness = BALLOON_ROUGHNESS
  }
  return single
}

/** Every balloon of the woodland: one instanced mesh per part of the model. */
export function createBirthdayBalloons(
  placements: readonly TreePlacement[],
  model: Group,
): Group {
  const balloons: Group = new Group()
  const balloonPlacements: BalloonPlacement[] = placeBalloons(placements)
  if (balloonPlacements.length === 0) {
    return balloons
  }
  model.updateMatrixWorld(true)
  const instanceMatrix: Matrix4 = new Matrix4()
  for (const part of meshesOf(model)) {
    const mesh: InstancedMesh = new InstancedMesh(
      part.geometry,
      partMaterial(part),
      balloonPlacements.length,
    )
    const tinted: boolean = isBalloonPart(part)
    balloonPlacements.forEach(
      (balloon: BalloonPlacement, index: number): void => {
        instanceMatrix.multiplyMatrices(balloon.matrix, part.matrixWorld)
        mesh.setMatrixAt(index, instanceMatrix)
        if (tinted) {
          mesh.setColorAt(index, balloon.color)
        }
      },
    )
    mesh.castShadow = true
    balloons.add(mesh)
  }
  return balloons
}
