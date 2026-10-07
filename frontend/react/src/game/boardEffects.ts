/**
 * What changed on the map between two server states, so every player can see
 * what the last action did: moves, placements, removals and battles.
 * Only committed states are compared — never a local preview.
 */

export type BoardEffectPiece = {
  id: string
  kind: string
  owner: number
  type?: string
}

export type BoardEffectClearing = {
  pieces: readonly BoardEffectPiece[]
}

/** The part of a game state the effects are read from. */
export type BoardEffectState = {
  id: string
  clearings: readonly BoardEffectClearing[]
  pending: readonly unknown[]
}

type PieceGroup = {
  owner: number
  pieceKind: string
  pieceType?: string
  count: number
}

/**
 * Where a group's stack sits inside its clearing: its position among the
 * stacks drawn there (same order as the board: first piece seen first).
 */
export type BoardStackSlot = {
  index: number
  total: number
}

export type BoardMoveEffect = PieceGroup & {
  kind: 'move'
  from: number
  to: number
  /** Forest the piece left instead of a clearing (`from` is then unused). */
  fromForest?: number
  /** Forest the piece entered instead of a clearing (`to` is then unused). */
  toForest?: number
  /**
   * Position of the move among the moves of its update: moves play one after
   * the other, the first at 0.
   */
  step: number
  /** Stack the pieces left, as drawn before the move. */
  fromSlot: BoardStackSlot
  /** Stack the pieces joined, as drawn after the move. */
  toSlot: BoardStackSlot
}

export type BoardPlaceEffect = PieceGroup & {
  kind: 'place'
  clearing: number
  /**
   * Position among the placements of its update that appear one after the
   * other; 0 = at once.
   */
  step: number
  /** The pieces placed: held off the board until the step starts. */
  pieceIds: readonly string[]
  slot: BoardStackSlot
  /** Size of the stack once the pieces are on it (what the board shows). */
  stackCount: number
}

export type BoardRemoveEffect = PieceGroup & {
  kind: 'remove'
  clearing: number
  /** The stack that lost pieces: where it still is, else where it was. */
  slot: BoardStackSlot
}

export type BoardBattleEffect = {
  kind: 'battle'
  clearing: number
  attacker: number
  defender: number
}

export type BoardEffect =
  | BoardMoveEffect
  | BoardPlaceEffect
  | BoardRemoveEffect
  | BoardBattleEffect

/** One server update worth of effects; `sequence` grows with every batch. */
export type BoardEffectBatch = {
  sequence: number
  effects: readonly BoardEffect[]
}

export const EMPTY_BOARD_EFFECT_BATCH: BoardEffectBatch = {
  sequence: 0,
  effects: [],
}

/**
 * More piece changes than one action can cause: a loaded snapshot or a new
 * game, not something to animate.
 */
const MAX_PIECE_EFFECTS_PER_UPDATE = 12

type LocatedPiece = {
  piece: BoardEffectPiece
  clearing: number
}

function locatePieces(
  clearings: readonly BoardEffectClearing[],
): Map<string, LocatedPiece> {
  const located = new Map<string, LocatedPiece>()
  clearings.forEach((clearing: BoardEffectClearing, clearingId: number) => {
    for (const piece of clearing.pieces) {
      located.set(piece.id, { piece, clearing: clearingId })
    }
  })
  return located
}

function pieceGroup(piece: BoardEffectPiece): PieceGroup {
  const group: PieceGroup = {
    owner: piece.owner,
    pieceKind: piece.kind,
    count: 1,
  }
  return piece.type === undefined ? group : { ...group, pieceType: piece.type }
}

/** Add one piece to the effect of its group, creating the effect if needed. */
function countPiece<Effect extends BoardEffect & PieceGroup>(
  effects: Map<string, Effect>,
  key: string,
  create: () => Effect,
): void {
  const existing = effects.get(key)
  effects.set(
    key,
    existing === undefined ? create() : { ...existing, count: existing.count + 1 },
  )
}

function groupKey(piece: BoardEffectPiece): string {
  return `${String(piece.owner)}:${piece.kind}:${piece.type ?? ''}`
}

/** Pieces of the piece's group in a clearing. */
function stackCountIn(
  clearing: BoardEffectClearing | undefined,
  piece: BoardEffectPiece,
): number {
  const key = groupKey(piece)
  return (clearing?.pieces ?? []).filter(
    (candidate: BoardEffectPiece): boolean => groupKey(candidate) === key,
  ).length
}

export const NO_STACK_SLOT: BoardStackSlot = { index: 0, total: 1 }
/** Moves read from a board comparison have no order: they all play first. */
const FIRST_MOVE_STEP = 0
const FIRST_PLACE_STEP = 0
/** Time between two steps of placements that appear one after the other. */
export const PLACE_STEP_MS = 350
/** Piece types placed one clearing after the other. Rule: 6.4 Birdsong wood. */
const STAGGERED_PIECE_TYPES: ReadonlySet<string> = new Set<string>(['wood'])

/** Slot of the piece's group among the stacks of a clearing; null if absent. */
export function stackSlotIn(
  clearing: BoardEffectClearing | undefined,
  piece: BoardEffectPiece,
): BoardStackSlot | null {
  const stackKeys: string[] = []
  for (const candidate of clearing?.pieces ?? []) {
    const key = groupKey(candidate)
    if (!stackKeys.includes(key)) stackKeys.push(key)
  }
  const index = stackKeys.indexOf(groupKey(piece))
  return index < 0 ? null : { index, total: stackKeys.length }
}

/** Pieces that left one clearing for another in a single step of an action. */
export type BoardMoveStep = {
  from: number
  to: number
  pieces: readonly BoardEffectPiece[]
}

const PIECES_LOG_ENTRY_TYPE = 'pieces'

function readPiece(value: unknown): BoardEffectPiece | null {
  if (typeof value !== 'object' || value === null) return null
  const id: unknown = Reflect.get(value, 'id')
  const kind: unknown = Reflect.get(value, 'kind')
  const owner: unknown = Reflect.get(value, 'owner')
  const type: unknown = Reflect.get(value, 'type')
  if (
    typeof id !== 'string' ||
    typeof kind !== 'string' ||
    typeof owner !== 'number'
  ) {
    return null
  }
  const piece: BoardEffectPiece = { id, kind, owner }
  return typeof type === 'string' ? { ...piece, type } : piece
}

type PiecesLogSide = 'placed' | 'removed'

type PiecesLogChange = {
  clearing: number
  pieces: readonly BoardEffectPiece[]
}

/** One side of a `pieces` log entry; null when the entry has no such side. */
function readPiecesChange(
  entry: unknown,
  side: PiecesLogSide,
): PiecesLogChange | null {
  if (typeof entry !== 'object' || entry === null) return null
  if (Reflect.get(entry, 't') !== PIECES_LOG_ENTRY_TYPE) return null
  const clearing: unknown = Reflect.get(entry, 'clearing')
  const listed: unknown = Reflect.get(entry, side)
  if (typeof clearing !== 'number' || !Array.isArray(listed)) return null
  const pieces: BoardEffectPiece[] = []
  for (const value of listed) {
    const piece = readPiece(value)
    if (piece === null) return null
    pieces.push(piece)
  }
  return pieces.length === 0 ? null : { clearing, pieces }
}

function samePieces(
  left: readonly BoardEffectPiece[],
  right: readonly BoardEffectPiece[],
): boolean {
  return (
    left.length === right.length &&
    left.every(
      (piece: BoardEffectPiece, index: number): boolean =>
        piece.id === right[index]?.id,
    )
  )
}

/**
 * Move steps in the order the log records them: the same pieces removed from
 * one clearing, then placed in another. A march keeps both of its moves, even
 * when a warrior of the first move leaves again in the second.
 */
export function moveStepsFromLog(entries: readonly unknown[]): BoardMoveStep[] {
  const steps: BoardMoveStep[] = []
  entries.forEach((entry: unknown, index: number) => {
    const removed = readPiecesChange(entry, 'removed')
    const placed = readPiecesChange(entries[index + 1], 'placed')
    if (removed === null || placed === null) return
    if (removed.clearing === placed.clearing) return
    if (!samePieces(removed.pieces, placed.pieces)) return
    steps.push({
      from: removed.clearing,
      to: placed.clearing,
      pieces: removed.pieces,
    })
  })
  return steps
}

/**
 * Log entries one update added. None while the earlier log was not loaded yet
 * (a resumed game shows its state before its log) or when the log restarted.
 */
export function logEntriesAddedSince(
  previousLogLength: number,
  log: readonly unknown[],
): readonly unknown[] {
  if (previousLogLength === 0 || log.length < previousLogLength) return []
  return log.slice(previousLogLength)
}

type ComparedBoards = {
  previous: readonly BoardEffectClearing[]
  next: readonly BoardEffectClearing[]
}

/** One move effect per piece group of every step, in step order. */
function moveEffectsOfSteps(
  steps: readonly BoardMoveStep[],
  boards: ComparedBoards,
): BoardMoveEffect[] {
  const moves = new Map<string, BoardMoveEffect>()
  steps.forEach((step: BoardMoveStep, stepIndex: number) => {
    for (const piece of step.pieces) {
      countPiece(
        moves,
        `${String(stepIndex)}|${groupKey(piece)}`,
        (): BoardMoveEffect => ({
          kind: 'move',
          from: step.from,
          to: step.to,
          step: stepIndex,
          fromSlot:
            stackSlotIn(boards.previous[step.from], piece) ??
            stackSlotIn(boards.next[step.from], piece) ??
            NO_STACK_SLOT,
          toSlot:
            stackSlotIn(boards.next[step.to], piece) ??
            stackSlotIn(boards.previous[step.to], piece) ??
            NO_STACK_SLOT,
          ...pieceGroup(piece),
        }),
      )
    }
  })
  return [...moves.values()]
}

/**
 * Moves, placements and removals between two committed boards. Pieces in
 * `steppedPieceIds` already have their moves told by the log, step by step.
 */
export function pieceEffectsBetween(
  previous: readonly BoardEffectClearing[],
  next: readonly BoardEffectClearing[],
  steppedPieceIds: ReadonlySet<string> = new Set<string>(),
): BoardEffect[] {
  const before = locatePieces(previous)
  const after = locatePieces(next)
  const moves = new Map<string, BoardMoveEffect>()
  const placements = new Map<string, BoardPlaceEffect>()
  const removals = new Map<string, BoardRemoveEffect>()

  for (const [pieceId, now] of after) {
    const was = before.get(pieceId)
    if (was === undefined) {
      const placementKey = `${String(now.clearing)}|${groupKey(now.piece)}`
      const placement = placements.get(placementKey)
      placements.set(
        placementKey,
        placement === undefined
          ? {
              kind: 'place',
              clearing: now.clearing,
              step: FIRST_PLACE_STEP,
              pieceIds: [pieceId],
              slot: stackSlotIn(next[now.clearing], now.piece) ?? NO_STACK_SLOT,
              stackCount: stackCountIn(next[now.clearing], now.piece),
              ...pieceGroup(now.piece),
            }
          : {
              ...placement,
              count: placement.count + 1,
              pieceIds: [...placement.pieceIds, pieceId],
            },
      )
      continue
    }
    if (was.clearing === now.clearing || steppedPieceIds.has(pieceId)) continue
    countPiece(
      moves,
      `${String(was.clearing)}>${String(now.clearing)}|${groupKey(now.piece)}`,
      (): BoardMoveEffect => ({
        kind: 'move',
        from: was.clearing,
        to: now.clearing,
        step: FIRST_MOVE_STEP,
        fromSlot:
          stackSlotIn(previous[was.clearing], was.piece) ?? NO_STACK_SLOT,
        toSlot: stackSlotIn(next[now.clearing], now.piece) ?? NO_STACK_SLOT,
        ...pieceGroup(now.piece),
      }),
    )
  }
  for (const [pieceId, was] of before) {
    if (after.has(pieceId)) continue
    countPiece(
      removals,
      `${String(was.clearing)}|${groupKey(was.piece)}`,
      (): BoardRemoveEffect => ({
        kind: 'remove',
        clearing: was.clearing,
        slot:
          stackSlotIn(next[was.clearing], was.piece) ??
          stackSlotIn(previous[was.clearing], was.piece) ??
          NO_STACK_SLOT,
        ...pieceGroup(was.piece),
      }),
    )
  }
  return [
    ...moves.values(),
    ...removals.values(),
    ...oneClearingAfterTheOther([...placements.values()]),
  ]
}

/**
 * Pieces that grow in several clearings at once (wood at every sawmill)
 * appear one clearing after the other, in clearing order.
 */
function oneClearingAfterTheOther(
  placements: readonly BoardPlaceEffect[],
): BoardPlaceEffect[] {
  const isStaggered = (placement: BoardPlaceEffect): boolean =>
    placement.pieceType !== undefined &&
    STAGGERED_PIECE_TYPES.has(placement.pieceType)
  const clearingsInOrder: number[] = [
    ...new Set<number>(
      placements
        .filter(isStaggered)
        .map((placement: BoardPlaceEffect): number => placement.clearing),
    ),
  ].sort((left: number, right: number): number => left - right)
  return placements.map(
    (placement: BoardPlaceEffect): BoardPlaceEffect =>
      isStaggered(placement)
        ? { ...placement, step: clearingsInOrder.indexOf(placement.clearing) }
        : placement,
  )
}

function readBattle(event: unknown): BoardBattleEffect | null {
  if (typeof event !== 'object' || event === null) return null
  if (Reflect.get(event, 'type') !== 'battle') return null
  const clearing: unknown = Reflect.get(event, 'clearing')
  const attacker: unknown = Reflect.get(event, 'attacker')
  const defender: unknown = Reflect.get(event, 'defender')
  if (
    typeof clearing !== 'number' ||
    typeof attacker !== 'number' ||
    typeof defender !== 'number'
  ) {
    return null
  }
  return { kind: 'battle', clearing, attacker, defender }
}

function sameBattle(
  left: BoardBattleEffect | null,
  right: BoardBattleEffect,
): boolean {
  return (
    left !== null &&
    left.clearing === right.clearing &&
    left.attacker === right.attacker &&
    left.defender === right.defender
  )
}

/** A battle that just started: pending now, not pending before. */
export function battleEffectBetween(
  previousPending: readonly unknown[],
  nextPending: readonly unknown[],
): BoardBattleEffect | null {
  const battle = readBattle(nextPending[0])
  if (battle === null) return null
  return sameBattle(readBattle(previousPending[0]), battle) ? null : battle
}

/**
 * Effects of one server update. Empty for the first state seen, another game,
 * or a wholesale board replacement. `newLogEntries` are the log entries the
 * update added: they tell the moves a board comparison cannot see.
 */
export function boardEffectsBetween(
  previous: BoardEffectState | null,
  next: BoardEffectState,
  newLogEntries: readonly unknown[] = [],
): BoardEffect[] {
  if (previous === null || previous.id !== next.id) return []
  const steps = moveStepsFromLog(newLogEntries)
  const steppedPieceIds = new Set<string>(
    steps.flatMap((step: BoardMoveStep): string[] =>
      step.pieces.map((piece: BoardEffectPiece): string => piece.id),
    ),
  )
  const pieceEffects = [
    ...moveEffectsOfSteps(steps, {
      previous: previous.clearings,
      next: next.clearings,
    }),
    ...pieceEffectsBetween(previous.clearings, next.clearings, steppedPieceIds),
  ]
  if (pieceEffects.length > MAX_PIECE_EFFECTS_PER_UPDATE) return []
  const battle = battleEffectBetween(previous.pending, next.pending)
  return battle === null ? pieceEffects : [battle, ...pieceEffects]
}
