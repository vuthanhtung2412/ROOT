import type { ClientAction } from '#game/resolution/ActionComposer.ts'
import type { BattleTarget, MarchMove } from '#game/eyrieActionComposerModels.ts'

/** Ready action when recruit/build offers exactly one clearing. */
export function soleDecreeClearingAction(params: {
  column: string
  cardId: string
  clearings: readonly number[]
}): ClientAction | null {
  if (params.clearings.length !== 1) {
    return null
  }
  const clearing = params.clearings[0]
  if (clearing === undefined) {
    return null
  }
  return {
    type: 'decree',
    column: params.column,
    cardId: params.cardId,
    clearing,
  }
}

/** Ready action when battle offers exactly one target. */
export function soleDecreeBattleAction(params: {
  column: string
  cardId: string
  targets: readonly BattleTarget[]
}): ClientAction | null {
  if (params.targets.length !== 1) {
    return null
  }
  const match = params.targets[0]
  if (match === undefined) {
    return null
  }
  return {
    type: 'decree',
    column: params.column,
    cardId: params.cardId,
    clearing: match.clearing,
    defender: match.defender,
  }
}

/** Ready action when move offers exactly one march. */
export function soleDecreeMoveAction(params: {
  column: string
  cardId: string
  moves: readonly MarchMove[]
}): ClientAction | null {
  if (params.moves.length !== 1) {
    return null
  }
  const match = params.moves[0]
  if (match === undefined) {
    return null
  }
  return {
    type: 'decree',
    column: params.column,
    cardId: params.cardId,
    moves: [match],
  }
}

/** Ready action when A New Roost offers exactly one clearing. */
export function soleNewRoostAction(
  clearings: readonly number[],
): ClientAction | null {
  if (clearings.length !== 1) {
    return null
  }
  const clearing = clearings[0]
  if (clearing === undefined) {
    return null
  }
  return { type: 'newRoost', clearing }
}
