import {
  BoxGeometry,
  BufferGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Vector3,
  type Material,
} from 'three'
import { describe, expect, it } from 'vitest'
import { mergePartsByMaterial } from '#game/map3d/mergeModelParts.ts'
import { meshesOf } from '#game/map3d/sceneObjects.ts'

const PART_SIZE = 1
const RIGHT_PART_X = 4
const MIRRORED = -1
const CORNERS_PER_TRIANGLE = 3

function materialFixture(): Material {
  return new MeshStandardMaterial()
}

function partFixture(material: Material, x: number): Mesh {
  const part: Mesh = new Mesh(
    new BoxGeometry(PART_SIZE, PART_SIZE, PART_SIZE),
    material,
  )
  part.position.x = x
  return part
}

function modelFixture(parts: readonly Mesh[]): Group {
  const model: Group = new Group()
  model.add(...parts)
  return model
}

/** Whether the first triangle of a geometry faces the way its normals say. */
function firstTriangleFacesItsNormal(geometry: BufferGeometry): boolean {
  const corners: Vector3[] = Array.from(
    { length: CORNERS_PER_TRIANGLE },
    (_: undefined, corner: number): Vector3 =>
      new Vector3().fromBufferAttribute(
        geometry.getAttribute('position'),
        geometry.index?.getX(corner) ?? corner,
      ),
  )
  const [first, second, third] = corners
  if (first === undefined || second === undefined || third === undefined) {
    return false
  }
  const faceNormal: Vector3 = second
    .clone()
    .sub(first)
    .cross(third.clone().sub(first))
  const vertexNormal: Vector3 = new Vector3().fromBufferAttribute(
    geometry.getAttribute('normal'),
    geometry.index?.getX(0) ?? 0,
  )
  return faceNormal.dot(vertexNormal) > 0
}

describe('mergePartsByMaterial', () => {
  it('makes one mesh of the parts that share a material', () => {
    const material: Material = materialFixture()
    const merged: Group = mergePartsByMaterial(
      modelFixture([
        partFixture(material, 0),
        partFixture(material, RIGHT_PART_X),
      ]),
    )

    const meshes: Mesh[] = meshesOf(merged)
    expect(meshes).toHaveLength(1)
    meshes[0]?.geometry.computeBoundingBox()
    expect(meshes[0]?.geometry.boundingBox?.max.x).toBeCloseTo(
      RIGHT_PART_X + PART_SIZE / 2,
    )
  })

  it('keeps one mesh per material', () => {
    const merged: Group = mergePartsByMaterial(
      modelFixture([
        partFixture(materialFixture(), 0),
        partFixture(materialFixture(), RIGHT_PART_X),
      ]),
    )

    expect(meshesOf(merged)).toHaveLength(2)
  })

  it('keeps a mirrored part facing outwards', () => {
    const mirrored: Mesh = partFixture(materialFixture(), 0)
    mirrored.scale.x = MIRRORED

    const merged: Group = mergePartsByMaterial(modelFixture([mirrored]))

    const geometry: BufferGeometry | undefined = meshesOf(merged)[0]?.geometry
    expect(geometry).toBeDefined()
    expect(
      geometry === undefined ? false : firstTriangleFacesItsNormal(geometry),
    ).toBe(true)
  })

  it('returns the model as it came when its parts cannot be merged', () => {
    const material: Material = materialFixture()
    const withoutUvs: Mesh = partFixture(material, RIGHT_PART_X)
    withoutUvs.geometry.deleteAttribute('uv')
    const model: Group = modelFixture([partFixture(material, 0), withoutUvs])

    expect(mergePartsByMaterial(model)).toBe(model)
  })
})
