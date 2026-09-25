import type { ActionSpec, ResolveEventAction } from '#actions/types.js'
import {
  boardOf as vagabondBoardOf,
  damageItems,
} from '#factions/vagabond/items.js'
import type { Ctx } from '#game/ctx.js'
import type { LogEntry } from '#log/types.js'
import type { ClearingId } from '#map/types.js'
import type { Piece, Seat } from '#pieces/types.js'
import { playerOf } from '#queries/seat.js'
import { removePieces } from '#rules/remove.js'
import { RuleError } from '#rules/RuleError.js'
import type { GameState } from '#state/types.js'
import type { BattleEvent } from '#events/types.js'
import type { RemovalSelection, RemovalStage } from '#events/battle/types.js'

function victimPieces(state: GameState, clearing: ClearingId, victim: Seat): Piece[] {
  // Rule: Vagabond pawn cannot be removed — hits damage items instead.
  return state.clearings[clearing]!.pieces.filter(
    (piece: Piece): boolean => piece.owner === victim && piece.kind !== 'pawn',
  )
}

function victimIsVagabond(state: GameState, victim: Seat): boolean {
  return playerOf(state, victim).faction === 'vagabond'
}

/**
 * Rule: 1.4 + Battle 4.3.4 — remove exactly min(hits, pieces);
 * warriors before buildings/tokens.
 */
export function isValidRemoval(state: GameState, selection: RemovalSelection): boolean {
  const { clearing, victim, pieceIds, maxHits } = selection
  if (pieceIds.length === 0) return false
  const ids: Set<string> = new Set(pieceIds)
  if (ids.size !== pieceIds.length) return false

  const onBoard: Piece[] = victimPieces(state, clearing, victim)
  const exactRemoveCount: number = Math.min(maxHits, onBoard.length)
  if (pieceIds.length !== exactRemoveCount) return false

  const byId: Map<string, Piece> = new Map(
    onBoard.map((piece: Piece): [string, Piece] => [piece.id, piece]),
  )
  for (const id of pieceIds) {
    if (!byId.has(id)) return false
  }

  const selected: Piece[] = pieceIds.map((id: string): Piece => byId.get(id)!)
  const boardWarriors: Piece[] = onBoard.filter((piece: Piece): boolean => piece.kind === 'warrior')
  const selectedWarriors: Piece[] = selected.filter(
    (piece: Piece): boolean => piece.kind === 'warrior',
  )
  const selectedOther: Piece[] = selected.filter(
    (piece: Piece): boolean => piece.kind !== 'warrior',
  )
  if (selectedOther.length > 0 && selectedWarriors.length < boardWarriors.length) {
    return false
  }
  return true
}

interface RemovalComboBuild {
  ids: string[]
  chooseCount: number
  startIndex: number
  current: string[]
  prefix: string[]
}

/** Exact-size removal combos only (Rule: 1.4 + Battle 4.3.4). */
export function legalRemovalSpecs(
  state: GameState,
  event: BattleEvent,
  victim: Seat,
  maxHits: number,
): ActionSpec[] {
  if (maxHits <= 0) return []

  // Rule: Vagabond — each hit damages one undamaged item (acknowledge via decline).
  if (victimIsVagabond(state, victim)) {
    return [
      {
        type: 'resolveEvent',
        actor: victim,
        params: { decline: [true] },
      },
    ]
  }

  const pieces: Piece[] = victimPieces(state, event.clearing, victim)
  if (pieces.length === 0) return []

  const specs: ActionSpec[] = []
  const warriorIds: string[] = pieces
    .filter((piece: Piece): boolean => piece.kind === 'warrior')
    .map((piece: Piece): string => piece.id)
  const otherIds: string[] = pieces
    .filter((piece: Piece): boolean => piece.kind !== 'warrior')
    .map((piece: Piece): string => piece.id)
  const exactRemoveCount: number = Math.min(maxHits, pieces.length)

  function addCombos(build: RemovalComboBuild): void {
    if (build.current.length === build.chooseCount) {
      specs.push({
        type: 'resolveEvent',
        actor: victim,
        params: { pieceIds: [...build.prefix, ...build.current] },
      })
      return
    }
    for (let index = build.startIndex; index < build.ids.length; index += 1) {
      const pieceId: string | undefined = build.ids[index]
      if (pieceId === undefined) {
        continue
      }
      build.current.push(pieceId)
      addCombos({
        ids: build.ids,
        chooseCount: build.chooseCount,
        startIndex: index + 1,
        current: build.current,
        prefix: build.prefix,
      })
      build.current.pop()
    }
  }

  if (exactRemoveCount <= warriorIds.length) {
    addCombos({
      ids: warriorIds,
      chooseCount: exactRemoveCount,
      startIndex: 0,
      current: [],
      prefix: [],
    })
    return specs
  }

  const otherChooseCount: number = exactRemoveCount - warriorIds.length
  if (otherChooseCount > otherIds.length) {
    return []
  }
  addCombos({
    ids: otherIds,
    chooseCount: otherChooseCount,
    startIndex: 0,
    current: [],
    prefix: warriorIds,
  })
  return specs
}

export function applyRemovalStage(
  state: GameState,
  stage: RemovalStage,
  ctx: Ctx,
): LogEntry[] {
  const { event, action, victim, maxHits, scorer } = stage

  if (victimIsVagabond(state, victim)) {
    return applyVagabondHitDamage(state, victim, maxHits, action)
  }

  if (!action.pieceIds) {
    throw new RuleError('INVALID_REMOVAL', { action })
  }
  if (
    !isValidRemoval(state, {
      clearing: event.clearing,
      victim,
      pieceIds: action.pieceIds,
      maxHits,
    })
  ) {
    throw new RuleError('INVALID_REMOVAL_ORDER', { pieceIds: action.pieceIds })
  }
  return removePieces(
    state,
    {
      clearing: event.clearing,
      pieceIds: action.pieceIds,
      scorer,
      options: { fromBattle: true },
    },
    ctx,
  )
}

function applyVagabondHitDamage(
  state: GameState,
  victim: Seat,
  maxHits: number,
  action: ResolveEventAction,
): LogEntry[] {
  if (action.decline !== true && action.pieceIds === undefined) {
    throw new RuleError('INVALID_REMOVAL', { action })
  }
  const board = vagabondBoardOf(state, victim)
  damageItems(board, maxHits)
  return [
    {
      t: 'action',
      actor: victim,
      action: { type: 'resolveEvent', decline: true },
    },
  ]
}
