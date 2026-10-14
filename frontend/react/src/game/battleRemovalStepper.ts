import { readChoiceParams } from '#game/resolution/ActionComposer.ts'
import type { ActionSpec } from '#api/client.ts'

export type BattleRemovalPieceView = {
  id: string
  kind: string
  type?: string
  /** Seat owner — used with factionByOwner for warrior art. */
  owner?: number
  factionId?: string
}

export type BattleRemovalStepperChoice = {
  label: string
  value: string
  pieceIds: string[]
}

/** One clickable tile in the shared removal pick row. */
export type BattleRemovalPickTile = {
  pieceId: string
  kind: string
  type?: string
  factionId?: string
}

/**
 * Click-to-pick model: forced pieces always leave; tiles are the rest.
 * Confirm when forced ∪ selected equals a legal combo.
 */
export type BattleRemovalPickModel = {
  forcedPieceIds: string[]
  legalCombos: string[][]
  tiles: BattleRemovalPickTile[]
  hitsToChoose: number
  /**
   * True when every legal combo is the same multiset of piece kinds/types
   * (e.g. only warriors). No real choice — UI should auto-submit.
   */
  fungibleOnly: boolean
}

/** Auto-submit when there is nothing meaningful to pick. */
export function shouldAutoSubmitBattleRemoval(
  model: BattleRemovalPickModel,
): boolean {
  if (model.fungibleOnly) {
    return true
  }
  if (model.hitsToChoose <= 0 || model.tiles.length === 0) {
    return true
  }
  return model.legalCombos.length <= 1
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
    pieces: ReadonlyArray<{
      id: string
      kind: string
      type?: string
      owner?: number
    }>
  }>,
  factionByOwner?: ReadonlyMap<number, string>,
): Map<string, BattleRemovalPieceView> {
  const piecesById = new Map<string, BattleRemovalPieceView>()
  for (const clearing of clearings) {
    for (const piece of clearing.pieces) {
      const view: BattleRemovalPieceView = {
        id: piece.id,
        kind: piece.kind,
      }
      if (piece.type !== undefined) {
        view.type = piece.type
      }
      if (piece.owner !== undefined) {
        view.owner = piece.owner
        const factionId = factionByOwner?.get(piece.owner)
        if (factionId !== undefined) {
          view.factionId = factionId
        }
      }
      piecesById.set(piece.id, view)
    }
  }
  return piecesById
}

function comboContainsAll(
  combo: readonly string[],
  pieceIds: ReadonlySet<string>,
): boolean {
  for (const pieceId of pieceIds) {
    if (!combo.includes(pieceId)) {
      return false
    }
  }
  return true
}

function setsEqual(left: ReadonlySet<string>, right: ReadonlySet<string>): boolean {
  if (left.size !== right.size) {
    return false
  }
  for (const value of left) {
    if (!right.has(value)) {
      return false
    }
  }
  return true
}

/**
 * Pieces present in every legal combo are forced (no choice). Remaining hits
 * are click-to-pick tiles — same UX as Vagabond item damage.
 */
export function buildBattleRemovalPickModel(
  combos: readonly string[][],
  piecesById: ReadonlyMap<string, BattleRemovalPieceView>,
): BattleRemovalPickModel | null {
  if (combos.length === 0) {
    return null
  }
  const firstCombo = combos[0]
  if (firstCombo === undefined) {
    return null
  }
  const forcedPieceIds = firstCombo.filter((pieceId) =>
    combos.every((combo) => combo.includes(pieceId)),
  )
  const forcedSet = new Set(forcedPieceIds)
  const selectableIds = new Set<string>()
  for (const combo of combos) {
    for (const pieceId of combo) {
      if (!forcedSet.has(pieceId)) {
        selectableIds.add(pieceId)
      }
    }
  }
  const tiles: BattleRemovalPickTile[] = [...selectableIds]
    .sort((left, right) => left.localeCompare(right))
    .flatMap((pieceId): BattleRemovalPickTile[] => {
      const piece = piecesById.get(pieceId)
      if (piece === undefined) {
        return []
      }
      const tile: BattleRemovalPickTile = {
        pieceId,
        kind: piece.kind,
      }
      if (piece.type !== undefined) {
        tile.type = piece.type
      }
      if (piece.factionId !== undefined) {
        tile.factionId = piece.factionId
      }
      return [tile]
    })
  const hitsToChoose = firstCombo.length - forcedPieceIds.length
  const comboLabels = new Set(
    combos.map((combo) => formatBattleRemovalComboLabel(combo, piecesById)),
  )
  return {
    forcedPieceIds,
    legalCombos: combos.map((combo) => [...combo]),
    tiles,
    hitsToChoose,
    fungibleOnly: comboLabels.size <= 1,
  }
}

/** True when adding this piece still leaves at least one legal combo reachable. */
export function canSelectBattleRemovalPiece(
  model: BattleRemovalPickModel,
  selectedPieceIds: readonly string[],
  pieceId: string,
): boolean {
  if (selectedPieceIds.includes(pieceId)) {
    return false
  }
  if (selectedPieceIds.length >= model.hitsToChoose) {
    return false
  }
  const next = new Set([...model.forcedPieceIds, ...selectedPieceIds, pieceId])
  return model.legalCombos.some((combo) => comboContainsAll(combo, next))
}

export function isBattleRemovalPickComplete(
  model: BattleRemovalPickModel,
  selectedPieceIds: readonly string[],
): boolean {
  if (selectedPieceIds.length !== model.hitsToChoose) {
    return false
  }
  const full = new Set([...model.forcedPieceIds, ...selectedPieceIds])
  return model.legalCombos.some((combo) => setsEqual(full, new Set(combo)))
}

export function resolveBattleRemovalPickPieceIds(
  model: BattleRemovalPickModel,
  selectedPieceIds: readonly string[],
): string[] | null {
  if (!isBattleRemovalPickComplete(model, selectedPieceIds)) {
    return null
  }
  return [...model.forcedPieceIds, ...selectedPieceIds]
}
