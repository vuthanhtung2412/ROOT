import { Box3, Group, Object3D, Vector3 } from 'three'
import {
  meeplePackOffsets,
  type MeeplePackOffset,
} from '#game/map3d/meeplePacking.ts'

export type MeepleStackModel = {
  model: Object3D
  /** Height of one meeple (model units), before world scale. */
  height: number
}

/**
 * One meeple per warrior, packed on the ground. A lone warrior is the clone
 * itself; a larger stack is a group of clones at pack offsets.
 */
export function createMeepleStackModel(
  pieceCount: number,
  sourceModel: Object3D,
  finishFigure: (figure: Object3D) => void,
): MeepleStackModel {
  const offsets: MeeplePackOffset[] = meeplePackOffsets(pieceCount)
  const height: number = new Box3()
    .setFromObject(sourceModel)
    .getSize(new Vector3()).y
  if (offsets.length === 1) {
    const figure: Object3D = sourceModel.clone()
    finishFigure(figure)
    return { model: figure, height }
  }
  const pack: Group = new Group()
  for (const offset of offsets) {
    const figure: Object3D = sourceModel.clone()
    finishFigure(figure)
    figure.position.set(offset.x, 0, offset.z)
    pack.add(figure)
  }
  return { model: pack, height }
}
