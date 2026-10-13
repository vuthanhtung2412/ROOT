import {
  InstancedMesh,
  Light,
  Line,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Points,
  PointsMaterial,
  Sprite,
  SpriteMaterial,
  type Material,
  type Object3D,
  type Texture,
} from 'three'

/** Every mesh under an object (a loaded model is a tree of groups). */
export function meshesOf(root: Object3D): Mesh[] {
  const meshes: Mesh[] = []
  root.traverse((child: Object3D): void => {
    if (child instanceof Mesh) {
      meshes.push(child)
    }
  })
  return meshes
}

function isTexture(texture: Texture | null): texture is Texture {
  return texture !== null
}

/** The images a material of the map draws with. */
function texturesOf(material: Material): Texture[] {
  if (material instanceof MeshStandardMaterial) {
    return [
      material.map,
      material.normalMap,
      material.roughnessMap,
      material.metalnessMap,
      material.emissiveMap,
      material.aoMap,
      material.alphaMap,
    ].filter(isTexture)
  }
  if (
    material instanceof MeshBasicMaterial ||
    material instanceof SpriteMaterial ||
    material instanceof PointsMaterial
  ) {
    return [material.map].filter(isTexture)
  }
  return []
}

function disposeMaterial(material: Material): void {
  for (const texture of texturesOf(material)) {
    texture.dispose()
  }
  material.dispose()
}

/**
 * Give back the graphics memory of everything under an object: geometries,
 * materials, their images, shadow maps. A renderer does not do it on its own,
 * and a scene rebuilt on the same canvas would pile its memory on the last.
 * Whatever is still used afterwards (a model kept for the next scene) is
 * simply uploaded again when it is next drawn.
 */
export function disposeObjectTree(root: Object3D): void {
  root.traverse((child: Object3D): void => {
    if (child instanceof Light) {
      child.dispose()
      return
    }
    if (child instanceof Sprite) {
      // Every sprite shares one geometry, owned by three.js.
      disposeMaterial(child.material)
      return
    }
    if (
      !(child instanceof Mesh || child instanceof Points || child instanceof Line)
    ) {
      return
    }
    child.geometry.dispose()
    const materials: Material[] = Array.isArray(child.material)
      ? child.material
      : [child.material]
    materials.forEach(disposeMaterial)
    if (child instanceof InstancedMesh) {
      child.dispose()
    }
  })
}
