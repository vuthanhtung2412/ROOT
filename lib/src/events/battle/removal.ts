import type { ActionSpec } from '#actions/types.js'
import {
  boardOf as vagabondBoardOf,
  damageChosenItems,
  damageItems,
  damageableItemCount,
  isItemDamageChoiceRequired,
  isValidItemDamageChoice,
  undamagedItemChoices,
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

  // Rule: Vagabond — hits damage items; with Allied (9.2.9.IId) may remove ally warriors.
  if (victimIsVagabond(state, victim)) {
    if (
      event.alliedSeat !== undefined &&
      event.attacker === victim
    ) {
      return legalAlliedVagabondHitSpecs(state, event, victim, maxHits)
    }
    const board = vagabondBoardOf(state, victim)
    // Rule: 9.2.6 Taking Hits — the Vagabond chooses which items to damage.
    if (isItemDamageChoiceRequired(board, maxHits)) {
      return [
        {
          type: 'resolveEvent',
          actor: victim,
          params: {
            vagabondItems: undamagedItemChoices(board),
            itemCount: [damageableItemCount(board, maxHits)],
          },
        },
      ]
    }
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

function legalAlliedVagabondHitSpecs(
  state: GameState,
  event: BattleEvent,
  victim: Seat,
  maxHits: number,
): ActionSpec[] {
  const alliedSeat = event.alliedSeat!
  const allyIds = state.clearings[event.clearing]!.pieces
    .filter(
      (piece) => piece.kind === 'warrior' && piece.owner === alliedSeat,
    )
    .map((piece) => piece.id)
  const specs: ActionSpec[] = [
    {
      type: 'resolveEvent',
      actor: victim,
      params: { decline: [true] },
    },
  ]
  const maxAllyHits = Math.min(maxHits, allyIds.length)
  function addAllyCombos(
    chooseCount: number,
    startIndex: number,
    current: string[],
  ): void {
    if (current.length === chooseCount) {
      specs.push({
        type: 'resolveEvent',
        actor: victim,
        params: { pieceIds: [...current] },
      })
      return
    }
    for (let index = startIndex; index < allyIds.length; index++) {
      current.push(allyIds[index]!)
      addAllyCombos(chooseCount, index + 1, current)
      current.pop()
    }
  }
  for (let allyHits = 1; allyHits <= maxAllyHits; allyHits++) {
    addAllyCombos(allyHits, 0, [])
  }
  return specs
}

export function applyRemovalStage(
  state: GameState,
  stage: RemovalStage,
  ctx: Ctx,
): LogEntry[] {
  const { event, action, victim, maxHits, scorer } = stage

  if (victimIsVagabond(state, victim)) {
    return applyVagabondHitDamage(state, stage, ctx)
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
  stage: RemovalStage,
  ctx: Ctx,
): LogEntry[] {
  const { event, action, victim, maxHits } = stage
  const allyPieceIds = action.pieceIds ?? []
  if (
    action.decline !== true &&
    allyPieceIds.length === 0 &&
    action.items === undefined
  ) {
    throw new RuleError('INVALID_REMOVAL', { action })
  }
  const logs: LogEntry[] = []
  if (allyPieceIds.length > 0) {
    if (event.alliedSeat === undefined) {
      throw new RuleError('NO_ALLIED_SEAT')
    }
    for (const pieceId of allyPieceIds) {
      const piece = state.clearings[event.clearing]!.pieces.find(
        (entry) => entry.id === pieceId,
      )
      if (
        piece === undefined ||
        piece.kind !== 'warrior' ||
        piece.owner !== event.alliedSeat
      ) {
        throw new RuleError('INVALID_ALLY_HIT', { pieceId })
      }
    }
    if (allyPieceIds.length > maxHits) {
      throw new RuleError('TOO_MANY_ALLY_HITS')
    }
    logs.push(
      ...removePieces(
        state,
        {
          clearing: event.clearing,
          pieceIds: allyPieceIds,
          scorer: event.defender,
          options: { fromBattle: true, skipFieldHospital: true },
        },
        ctx,
      ),
    )
    event.alliedHitsTaken = (event.alliedHitsTaken ?? 0) + allyPieceIds.length
  }
  const itemHits = maxHits - allyPieceIds.length
  if (itemHits > 0) {
    const board = vagabondBoardOf(state, victim)
    if (action.items !== undefined) {
      if (!isValidItemDamageChoice(board, action.items, itemHits)) {
        throw new RuleError('INVALID_ITEM_DAMAGE_CHOICE', { items: action.items })
      }
      damageChosenItems(board, action.items)
    } else if (isItemDamageChoiceRequired(board, itemHits) && allyPieceIds.length === 0) {
      throw new RuleError('MISSING_ITEM_DAMAGE_CHOICE', { itemHits })
    } else {
      damageItems(board, itemHits)
    }
    event.itemHitsTaken = (event.itemHitsTaken ?? 0) + itemHits
  }
  logs.push({
    t: 'action',
    actor: victim,
    action:
      allyPieceIds.length > 0
        ? { type: 'resolveEvent', pieceIds: allyPieceIds }
        : action.items !== undefined
          ? { type: 'resolveEvent', items: action.items }
          : { type: 'resolveEvent', decline: true },
  })
  return logs
}
