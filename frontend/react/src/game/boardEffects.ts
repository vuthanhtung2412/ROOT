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
  /** Stack the pieces left, as drawn before the move. */
  fromSlot: BoardStackSlot
  /** Stack the pieces joined, as drawn after the move. */
  toSlot: BoardStackSlot
}

export type BoardPlaceEffect = PieceGroup & {
  kind: 'place'
  clearing: number
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

const NO_STACK_SLOT: BoardStackSlot = { index: 0, total: 1 }

/** Slot of the piece's group among the stacks of a clearing; null if absent. */
function stackSlotIn(
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

/** Moves, placements and removals between two committed boards. */
export function pieceEffectsBetween(
  previous: readonly BoardEffectClearing[],
  next: readonly BoardEffectClearing[],
): BoardEffect[] {
  const before = locatePieces(previous)
  const after = locatePieces(next)
  const moves = new Map<string, BoardMoveEffect>()
  const placements = new Map<string, BoardPlaceEffect>()
  const removals = new Map<string, BoardRemoveEffect>()

  for (const [pieceId, now] of after) {
    const was = before.get(pieceId)
    if (was === undefined) {
      countPiece(
        placements,
        `${String(now.clearing)}|${groupKey(now.piece)}`,
        (): BoardPlaceEffect => ({
          kind: 'place',
          clearing: now.clearing,
          slot: stackSlotIn(next[now.clearing], now.piece) ?? NO_STACK_SLOT,
          stackCount: stackCountIn(next[now.clearing], now.piece),
          ...pieceGroup(now.piece),
        }),
      )
      continue
    }
    if (was.clearing === now.clearing) continue
    countPiece(
      moves,
      `${String(was.clearing)}>${String(now.clearing)}|${groupKey(now.piece)}`,
      (): BoardMoveEffect => ({
        kind: 'move',
        from: was.clearing,
        to: now.clearing,
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
  return [...moves.values(), ...removals.values(), ...placements.values()]
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
 * or a wholesale board replacement.
 */
export function boardEffectsBetween(
  previous: BoardEffectState | null,
  next: BoardEffectState,
): BoardEffect[] {
  if (previous === null || previous.id !== next.id) return []
  const pieceEffects = pieceEffectsBetween(previous.clearings, next.clearings)
  if (pieceEffects.length > MAX_PIECE_EFFECTS_PER_UPDATE) return []
  const battle = battleEffectBetween(previous.pending, next.pending)
  return battle === null ? pieceEffects : [battle, ...pieceEffects]
}
