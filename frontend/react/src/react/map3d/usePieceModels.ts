import { useEffect, useMemo, useState } from 'react'
import { loadPieceModels, type PieceModels } from '#game/map3d/mapModels.ts'
import type { MapScene } from '#game/map3d/mapScene.ts'
import type { MapPiece } from '#game/map3d/pieceMeshes.ts'

const TEXTURE_KEY_SEPARATOR = '|'

/**
 * Loads the 3D models of the kinds of pieces on the map and hands them to
 * the scene. They come after the woodland is up: until then, and for a kind
 * of piece that just appeared, a piece is only its icon.
 */
export function usePieceModels(
  scene: MapScene | null,
  pieces: readonly MapPiece[],
): void {
  // As one string: the same kinds of pieces after a board update load nothing.
  const textureKeys: string = useMemo(
    () =>
      [...new Set<string>(pieces.map((piece: MapPiece): string => piece.textureKey))]
        .sort()
        .join(TEXTURE_KEY_SEPARATOR),
    [pieces],
  )
  const [pieceModels, setPieceModels] = useState<PieceModels | null>(null)
  // Downloaded once the woodland is up, so they do not hold it back.
  const sceneIsUp: boolean = scene !== null

  useEffect(() => {
    if (!sceneIsUp) {
      return undefined
    }
    let cancelled = false
    void loadPieceModels(textureKeys.split(TEXTURE_KEY_SEPARATOR)).then(
      (loaded: PieceModels): void => {
        if (!cancelled) {
          setPieceModels(loaded)
        }
      },
    )
    return (): void => {
      cancelled = true
    }
  }, [sceneIsUp, textureKeys])

  useEffect(() => {
    if (pieceModels !== null) {
      scene?.setPieceModels(pieceModels)
    }
  }, [scene, pieceModels])
}
