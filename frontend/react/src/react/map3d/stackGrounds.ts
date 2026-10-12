import type { MapGroundPoint } from '#game/map3d/mapWorldSpace.ts'
import type { MapPiece } from '#game/map3d/pieceMeshes.ts'

/** Where each piece of the map stands, by the key of its map piece. */
export type PieceGrounds = ReadonlyMap<string, MapGroundPoint>

/**
 * Where every piece stands now, and where the pieces no longer on the map
 * last stood: a stack that just left its clearing whole is still found where
 * it was, so its move can set off from there.
 */
export function rememberPieceGrounds(
  known: PieceGrounds,
  pieces: readonly MapPiece[],
): PieceGrounds {
  return new Map<string, MapGroundPoint>([
    ...known,
    ...pieces.map(
      (piece: MapPiece): [string, MapGroundPoint] => [piece.key, piece.ground],
    ),
  ])
}
