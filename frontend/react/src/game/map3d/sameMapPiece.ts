import type { MapPiece } from '#game/map3d/pieceMeshes.ts'

/** Whether two pieces look the same on the map, mesh for mesh. */
export function isSameMapPiece(left: MapPiece, right: MapPiece): boolean {
  return (
    left.key === right.key &&
    left.shape === right.shape &&
    left.textureKey === right.textureKey &&
    left.texturePath === right.texturePath &&
    left.color === right.color &&
    left.count === right.count &&
    left.ground.x === right.ground.x &&
    left.ground.z === right.ground.z &&
    left.rotation === right.rotation &&
    left.isBuilding === right.isBuilding &&
    left.isInForest === right.isInForest
  )
}
