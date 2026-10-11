import { Mesh, type Object3D } from 'three'

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
