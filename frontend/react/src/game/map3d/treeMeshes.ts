import {
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  type Mesh,
  MeshStandardMaterial,
  Object3D,
} from 'three'
import type { TreeModels } from '#game/map3d/mapModels.ts'
import { meshesOf } from '#game/map3d/sceneObjects.ts'
import type { TreePlacement } from '#game/map3d/treePlacement.ts'

/** Model units → world units: a pine stands a bit over a meeple. */
const TREE_MODEL_SCALE = 2.5
/** Share of trees swapped for an orange one: it is Autumn, after all. */
const AUTUMN_TREE_SHARE = 0.012
const FULL_TURN_RADIANS = Math.PI * 2

/** The kit's teal foliage, repainted in the greens of the Root woodland. */
const FOLIAGE_MATERIAL_NAME_PREFIX = 'leafs'
const PINE_DARK_COLOR = 0x1d4535
const PINE_LIGHT_COLOR = 0x3a7153
const LEAFY_DARK_COLOR = 0x6c9f3d
const LEAFY_LIGHT_COLOR = 0xa6cc5a
const AUTUMN_DARK_COLOR = 0xc8571f
const AUTUMN_LIGHT_COLOR = 0xeb9a35
const BARK_COLOR = 0x5a3f2b

type FoliagePalette = {
  darkColor: number
  lightColor: number
}

const PINE_PALETTE: FoliagePalette = {
  darkColor: PINE_DARK_COLOR,
  lightColor: PINE_LIGHT_COLOR,
}
const LEAFY_PALETTE: FoliagePalette = {
  darkColor: LEAFY_DARK_COLOR,
  lightColor: LEAFY_LIGHT_COLOR,
}
const AUTUMN_PALETTE: FoliagePalette = {
  darkColor: AUTUMN_DARK_COLOR,
  lightColor: AUTUMN_LIGHT_COLOR,
}

/** One tree model and the trees that use it. */
type TreeVariant = {
  model: Group
  palette: FoliagePalette
  placements: TreePlacement[]
}

/** Stable 0..1 number per tree (its turn), reused for shade and variant. */
function treeShade(placement: TreePlacement): number {
  return placement.rotation / FULL_TURN_RADIANS
}

function createVariants(
  models: readonly Group[],
  palette: FoliagePalette,
): TreeVariant[] {
  return models.map(
    (model: Group): TreeVariant => ({ model, palette, placements: [] }),
  )
}

/** Deal every placement to one model variant. */
function sortPlacementsIntoVariants(
  placements: readonly TreePlacement[],
  models: TreeModels,
): TreeVariant[] {
  const pineVariants: TreeVariant[] = createVariants(models.pine, PINE_PALETTE)
  const leafyVariants: TreeVariant[] = createVariants(
    models.leafy,
    LEAFY_PALETTE,
  )
  const autumnVariants: TreeVariant[] = createVariants(
    models.autumn,
    AUTUMN_PALETTE,
  )
  placements.forEach((placement: TreePlacement, index: number): void => {
    const isAutumn: boolean = treeShade(placement) < AUTUMN_TREE_SHARE
    const kindVariants: TreeVariant[] =
      placement.kind === 'pine' ? pineVariants : leafyVariants
    const variants: TreeVariant[] =
      isAutumn && autumnVariants.length > 0 ? autumnVariants : kindVariants
    variants[index % variants.length]?.placements.push(placement)
  })
  return [...pineVariants, ...leafyVariants, ...autumnVariants]
}

function isFoliage(mesh: Mesh): boolean {
  return (
    !Array.isArray(mesh.material) &&
    mesh.material.name.startsWith(FOLIAGE_MATERIAL_NAME_PREFIX)
  )
}

/** All trees of one variant: one instanced mesh per part of the model. */
function buildVariantMeshes(variant: TreeVariant): InstancedMesh[] {
  variant.model.updateMatrixWorld(true)
  const parts: Mesh[] = meshesOf(variant.model)
  const transform: Object3D = new Object3D()
  const instanceMatrix: Matrix4 = new Matrix4()
  const lightColor: Color = new Color(variant.palette.lightColor)
  const color: Color = new Color()
  return parts.map((part: Mesh): InstancedMesh => {
    const foliage: boolean = isFoliage(part)
    const mesh: InstancedMesh = new InstancedMesh(
      part.geometry,
      new MeshStandardMaterial({
        color: foliage ? 0xffffff : BARK_COLOR,
        roughness: 1,
        flatShading: true,
      }),
      variant.placements.length,
    )
    variant.placements.forEach(
      (placement: TreePlacement, index: number): void => {
        transform.position.set(placement.position.x, 0, placement.position.z)
        transform.rotation.y = placement.rotation
        transform.scale.setScalar(TREE_MODEL_SCALE * placement.scale)
        transform.updateMatrix()
        instanceMatrix.multiplyMatrices(transform.matrix, part.matrixWorld)
        mesh.setMatrixAt(index, instanceMatrix)
        if (foliage) {
          color
            .set(variant.palette.darkColor)
            .lerp(lightColor, treeShade(placement))
          mesh.setColorAt(index, color)
        }
      },
    )
    mesh.castShadow = true
    mesh.receiveShadow = true
    return mesh
  })
}

/** The whole woodland: a few instanced meshes, one draw call each. */
export function createTreeMeshes(
  placements: readonly TreePlacement[],
  models: TreeModels,
): Group {
  const trees: Group = new Group()
  for (const variant of sortPlacementsIntoVariants(placements, models)) {
    if (variant.placements.length > 0) {
      trees.add(...buildVariantMeshes(variant))
    }
  }
  return trees
}
