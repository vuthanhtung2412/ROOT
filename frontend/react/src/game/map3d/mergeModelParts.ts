import {
  Group,
  Mesh,
  type BufferAttribute,
  type BufferGeometry,
  type Material,
} from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { meshesOf } from '#game/map3d/sceneObjects.ts'

const CORNERS_PER_TRIANGLE = 3
/** Third corner of a triangle, counted from its first. */
const LAST_CORNER_OFFSET = 2

/**
 * A mirrored part (a left tower made from the right one) has its triangles
 * wound the other way once its mirror is baked in: turn them back.
 */
function withTrianglesTurned(geometry: BufferGeometry): BufferGeometry | null {
  const index: BufferAttribute | null = geometry.index
  if (index === null) {
    return null
  }
  const turnedCorners: number[] = Array.from(
    { length: index.count },
    (_: undefined, corner: number): number => {
      const cornerInTriangle: number = corner % CORNERS_PER_TRIANGLE
      const firstCorner: number = corner - cornerInTriangle
      // First and last corner trade places; the middle one stays.
      return index.getX(firstCorner + LAST_CORNER_OFFSET - cornerInTriangle)
    },
  )
  return geometry.clone().setIndex(turnedCorners)
}

/** The geometry of a part, moved to where the part stands in its model. */
function placedGeometry(part: Mesh): BufferGeometry | null {
  const placed: BufferGeometry = part.geometry
    .clone()
    .applyMatrix4(part.matrixWorld)
  return part.matrixWorld.determinant() < 0
    ? withTrianglesTurned(placed)
    : placed
}

function isGeometry(geometry: BufferGeometry | null): geometry is BufferGeometry {
  return geometry !== null
}

/**
 * A building comes out of Blender as many named parts (the keep: 29), each a
 * draw call of its own, and one more for its shadow. Its parts never move
 * apart, so those that share a material become one mesh.
 * A model that cannot be merged is returned as it came.
 */
export function mergePartsByMaterial(model: Group): Group {
  model.updateMatrixWorld(true)
  const partsByMaterial: Map<Material, Mesh[]> = new Map<Material, Mesh[]>()
  for (const part of meshesOf(model)) {
    if (Array.isArray(part.material)) {
      return model
    }
    partsByMaterial.set(part.material, [
      ...(partsByMaterial.get(part.material) ?? []),
      part,
    ])
  }
  const merged: Group = new Group()
  merged.name = model.name
  for (const [material, parts] of partsByMaterial) {
    const geometries: BufferGeometry[] = parts
      .map(placedGeometry)
      .filter(isGeometry)
    // Null: the parts do not hold the same kind of data (some without UVs).
    const geometry: BufferGeometry | null =
      geometries.length === parts.length ? mergeGeometries(geometries) : null
    if (geometry === null) {
      return model
    }
    merged.add(new Mesh(geometry, material))
  }
  return merged
}
