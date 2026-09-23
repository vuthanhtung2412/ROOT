import { readChoiceParams } from '#game/ActionComposer.ts'
import type { ActionSpec } from '#api/client.ts'

export type BattleRemovalPieceView = {
  id: string
  kind: string
  type?: string
}

export type BattleRemovalStepperChoice = {
  label: string
  value: string
  pieceIds: string[]
}

export function isPieceIdsRemovalSpec(spec: ActionSpec): boolean {
  if (spec.type !== 'resolveEvent') {
    return false
  }
  return readChoiceParams(spec).pieceIds !== undefined
}

export function readPieceIdsFromSpec(spec: ActionSpec): string[] | null {
  const pieceIds = readChoiceParams(spec).pieceIds
  return pieceIds === undefined ? null : pieceIds
}

/** Keep one tray entry for all battle removal combos. */
export function collapsePieceIdsRemovalSpecs(
  actions: readonly ActionSpec[],
): ActionSpec[] {
  const removals: ActionSpec[] = []
  const others: ActionSpec[] = []
  for (const spec of actions) {
    if (isPieceIdsRemovalSpec(spec)) {
      removals.push(spec)
    } else {
      others.push(spec)
    }
  }
  if (removals.length === 0) {
    return [...actions]
  }
  const representative = removals[0]
  if (representative === undefined) {
    return [...others]
  }
  return [...others, representative]
}

function pieceGroupLabel(piece: BattleRemovalPieceView): string {
  if (piece.kind === 'warrior') {
    return 'warriors'
  }
  if (piece.type !== undefined && piece.type.length > 0) {
    return piece.type
  }
  return piece.kind
}

export function formatBattleRemovalComboLabel(
  pieceIds: readonly string[],
  piecesById: ReadonlyMap<string, BattleRemovalPieceView>,
): string {
  const counts = new Map<string, number>()
  for (const pieceId of pieceIds) {
    const piece = piecesById.get(pieceId)
    const group =
      piece === undefined ? 'piece' : pieceGroupLabel(piece)
    counts.set(group, (counts.get(group) ?? 0) + 1)
  }
  const parts: string[] = []
  const warriorCount = counts.get('warriors')
  if (warriorCount !== undefined) {
    parts.push(`${String(warriorCount)} x warriors`)
    counts.delete('warriors')
  }
  for (const group of [...counts.keys()].sort((left, right) =>
    left.localeCompare(right),
  )) {
    const count = counts.get(group)
    if (count === undefined) {
      continue
    }
    parts.push(`${String(count)} x ${group}`)
  }
  return parts.join(' + ')
}

function comboSignature(pieceIds: readonly string[]): string {
  return [...pieceIds].sort((left, right) => left.localeCompare(right)).join('|')
}

/**
 * Collapse legal pieceIds combos into stepper choices (one per distinct label).
 * Fungible warrior-only combos share one choice.
 */
export function buildBattleRemovalStepperChoices(
  combos: readonly string[][],
  piecesById: ReadonlyMap<string, BattleRemovalPieceView>,
): BattleRemovalStepperChoice[] {
  const byLabel = new Map<string, string[]>()
  const seenSignatures = new Set<string>()
  for (const combo of combos) {
    const signature = comboSignature(combo)
    if (seenSignatures.has(signature)) {
      continue
    }
    seenSignatures.add(signature)
    const label = formatBattleRemovalComboLabel(combo, piecesById)
    if (!byLabel.has(label)) {
      byLabel.set(label, [...combo])
    }
  }
  const choices: BattleRemovalStepperChoice[] = []
  let index = 0
  for (const [label, pieceIds] of byLabel) {
    choices.push({
      label,
      value: String(index),
      pieceIds,
    })
    index += 1
  }
  return choices
}

export function collectPieceIdsCombosFromSpecs(
  specs: readonly ActionSpec[],
): string[][] {
  const combos: string[][] = []
  for (const spec of specs) {
    const pieceIds = readPieceIdsFromSpec(spec)
    if (pieceIds === null) {
      continue
    }
    combos.push(pieceIds)
  }
  return combos
}

export function buildPiecesByIdFromClearings(
  clearings: ReadonlyArray<{
    pieces: ReadonlyArray<BattleRemovalPieceView>
  }>,
): Map<string, BattleRemovalPieceView> {
  const piecesById = new Map<string, BattleRemovalPieceView>()
  for (const clearing of clearings) {
    for (const piece of clearing.pieces) {
      piecesById.set(piece.id, {
        id: piece.id,
        kind: piece.kind,
        type: piece.type,
      })
    }
  }
  return piecesById
}
