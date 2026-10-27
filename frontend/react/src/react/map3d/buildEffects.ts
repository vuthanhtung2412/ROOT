import type {
  BoardEffect,
  BoardEffectBatch,
  BoardPlaceEffect,
} from '#game/boardEffects.ts'
import { BUILDING_KIND, buildingPieceKey } from '#react/map3d/mapPieces.ts'

/**
 * On the 3D map a new building goes up in a cloud of dust, played by the
 * scene itself; the flat pop-in of the effects layer is not for it.
 */
function isBuildEffect(effect: BoardEffect): effect is BoardPlaceEffect {
  return effect.kind === 'place' && effect.pieceKind === BUILDING_KIND
}

/** Map piece keys of the buildings an update put on the board. */
export function builtPieceKeys(batch: BoardEffectBatch): string[] {
  return batch.effects
    .filter(isBuildEffect)
    .flatMap((effect: BoardPlaceEffect): string[] =>
      effect.pieceIds.map((pieceId: string): string =>
        buildingPieceKey(effect.clearing, pieceId),
      ),
    )
}

/** The batch without its new buildings: what the effects layer still plays. */
export function withoutBuildEffects(batch: BoardEffectBatch): BoardEffectBatch {
  return {
    ...batch,
    effects: batch.effects.filter(
      (effect: BoardEffect): boolean => !isBuildEffect(effect),
    ),
  }
}
