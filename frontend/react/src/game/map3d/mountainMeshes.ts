import { Box3, Group, Vector3 } from 'three'
import {
  MOUNTAIN_WIDTH,
  type MountainPlacement,
} from '#game/map3d/mountainPlacement.ts'
import { meshesOf } from '#game/map3d/sceneObjects.ts'

/**
 * One stone spire per placement, sized to `MOUNTAIN_WIDTH` and stood on the
 * ground. Few enough that each is a clone, not an instanced mesh.
 */
export function createMountainMeshes(
  placements: readonly MountainPlacement[],
  models: readonly Group[],
): Group {
  const mountains: Group = new Group()
  for (const placement of placements) {
    const model: Group | undefined = models[placement.modelIndex]
    if (model === undefined) {
      continue
    }
    mountains.add(createMountain(model, placement))
  }
  return mountains
}

/** The model at its size in the woodland, standing on the ground. */
function createMountain(model: Group, placement: MountainPlacement): Group {
  const bounds: Box3 = new Box3().setFromObject(model)
  const size: Vector3 = bounds.getSize(new Vector3())
  const modelScale: number = MOUNTAIN_WIDTH / Math.max(size.x, size.z)
  const body: Group = model.clone()
  body.position.y = -bounds.min.y
  for (const mesh of meshesOf(body)) {
    mesh.castShadow = true
    mesh.receiveShadow = true
  }
  // Scale lives on a wrapper so the lift stays in model units.
  const mountain: Group = new Group()
  mountain.position.set(placement.position.x, 0, placement.position.z)
  mountain.rotation.y = placement.rotation
  mountain.scale.setScalar(modelScale * placement.scale)
  mountain.add(body)
  return mountain
}
