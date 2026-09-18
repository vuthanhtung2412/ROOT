import type { Action, ActionSpec, MarchMove } from '../actions/types.js'
import { defOf } from '../cards/Deck.js'
import { Deck } from '../cards/Deck.js'
import type { Card } from '../cards/types.js'
import { matchesSuit } from '../cards/suit.js'
import { openBattle } from '../events/battle.js'
import type { Ctx } from '../game/ctx.js'
import type { LogEntry } from '../log/types.js'
import { FALL } from '../map/fall.js'
import type { ClearingId } from '../map/types.js'
import { canCraft } from '../queries/craft.js'
import { canMove } from '../queries/move.js'
import { canPlace } from '../queries/place.js'
import { warriors } from '../queries/pieces.js'
import { rules } from '../queries/ruler.js'
import { playerOf } from '../queries/seat.js'
import { openSlots } from '../queries/slots.js'
import { craftCard } from '../rules/craft.js'
import { moveWarriors } from '../rules/move.js'
import { placeUpTo } from '../rules/place.js'
import { RuleError } from '../rules/RuleError.js'
import {
  DECREE_COLUMNS,
  EYRIE_ROOST_DRAW_BONUS_THRESHOLDS,
  EYRIE_ROOST_VP,
  type DecreeColumn,
  type EyrieBoard,
} from '../state/boards.js'
import { HAND_LIMIT } from '../state/constants.js'
import type { DecreeCursor, GameState, Phase, Step } from '../state/types.js'
import type { Seat } from '../pieces/types.js'
import { Faction } from './Faction.js'
import { isVizier, makeViziers } from './eyrie/viziers.js'

const STEPS: Record<Phase, Step[]> = {
  birdsong: ['emergency', 'decreeAdd', 'newRoost'],
  daylight: ['craft', 'decree'],
  evening: ['score', 'draw', 'discard'],
}

function boardOf(state: GameState, seat: Seat): EyrieBoard {
  const board = playerOf(state, seat).board
  if (board.kind !== 'eyrie') throw new RuleError('NOT_EYRIE', { seat })
  return board
}

/** Rule: Eyrie > Setup 2 — free corner, prefer opposite Marquise start. */
export function eyrieStartClearing(state: GameState): ClearingId {
  const taken = new Set<ClearingId>()
  for (const p of state.players) {
    if (p.faction !== 'marquise') continue
    for (const corner of FALL.corners) {
      const hasKeep = state.clearings[corner]!.pieces.some(
        (x) => x.kind === 'token' && x.type === 'keep' && x.owner === p.seat,
      )
      if (hasKeep) taken.add(corner)
    }
  }
  const preferred = FALL.opposite(FALL.corners[0])
  if (!taken.has(preferred)) return preferred
  for (const corner of FALL.corners) {
    if (!taken.has(corner)) return corner
  }
  return preferred
}

function roostClearings(state: GameState, seat: Seat): ClearingId[] {
  const out: ClearingId[] = []
  for (let id = 0; id < state.clearings.length; id++) {
    if (
      state.clearings[id]!.pieces.some(
        (p) => p.kind === 'building' && p.type === 'roost' && p.owner === seat,
      )
    ) {
      out.push(id)
    }
  }
  return out
}

function roostsOnMap(state: GameState, seat: Seat): number {
  let n = 0
  for (const clearing of state.clearings) {
    for (const p of clearing.pieces) {
      if (p.kind === 'building' && p.type === 'roost' && p.owner === seat) n += 1
    }
  }
  return n
}

function cardMatchesClearing(card: Card, clearing: ClearingId): boolean {
  return matchesSuit(card, FALL.clearings[clearing]!.suit)
}

function enemySeatsInClearing(state: GameState, clearing: ClearingId, seat: Seat): Seat[] {
  const enemies = new Set<Seat>()
  for (const p of state.clearings[clearing]!.pieces) {
    if (p.owner !== seat && (p.kind === 'warrior' || p.kind === 'pawn')) {
      enemies.add(p.owner)
    }
  }
  return [...enemies]
}

function canBattleHere(
  state: GameState,
  seat: Seat,
  clearing: ClearingId,
  defender: Seat,
): boolean {
  if (defender === seat) return false
  if (warriors(state, clearing, seat) < 1) return false
  return enemySeatsInClearing(state, clearing, seat).includes(defender)
}

/** Check recruit — supply + roost + suit + canPlace. */
function recruitLegal(
  state: GameState,
  seat: Seat,
  card: Card,
  clearing: ClearingId,
): boolean {
  if (!cardMatchesClearing(card, clearing)) return false
  if (!roostClearings(state, seat).includes(clearing)) return false
  if (boardOf(state, seat).supply.warriors < 1) return false
  return canPlace(state, seat, clearing)
}

function moveLegal(
  state: GameState,
  seat: Seat,
  card: Card,
  moves: MarchMove[],
  ctx: Ctx,
): boolean {
  if (moves.length < 1) return false
  const from = moves[0]!.from
  if (!cardMatchesClearing(card, from)) return false
  if (warriors(state, from, seat) < 1) return false
  for (const move of moves) {
    if (move.count < 1) return false
    if (!canMove(state, seat, move.from, move.to, ctx.hooks)) return false
    if (move.count > warriors(state, move.from, seat)) return false
  }
  return true
}

function hasAnyDecreeMove(
  state: GameState,
  seat: Seat,
  card: Card,
  ctx: Ctx,
): boolean {
  for (let from = 0; from < 12; from++) {
    if (!cardMatchesClearing(card, from as ClearingId)) continue
    if (warriors(state, from as ClearingId, seat) < 1) continue
    for (let to = 0; to < 12; to++) {
      if (canMove(state, seat, from as ClearingId, to as ClearingId, ctx.hooks)) return true
    }
  }
  return false
}

function battleLegal(
  state: GameState,
  seat: Seat,
  card: Card,
  clearing: ClearingId,
  defender: Seat,
): boolean {
  if (!cardMatchesClearing(card, clearing)) return false
  return canBattleHere(state, seat, clearing, defender)
}

function hasAnyDecreeBattle(state: GameState, seat: Seat, card: Card): boolean {
  for (let clearing = 0; clearing < 12; clearing++) {
    if (!cardMatchesClearing(card, clearing as ClearingId)) continue
    for (const defender of enemySeatsInClearing(state, clearing as ClearingId, seat)) {
      if (canBattleHere(state, seat, clearing as ClearingId, defender)) return true
    }
  }
  return false
}

function buildLegal(
  state: GameState,
  seat: Seat,
  card: Card,
  clearing: ClearingId,
  ctx: Ctx,
): boolean {
  if (!cardMatchesClearing(card, clearing)) return false
  if (!rules(state, clearing, seat, ctx.hooks)) return false
  if (roostClearings(state, seat).includes(clearing)) return false
  if (boardOf(state, seat).roostTrack.placed < 1) return false
  if (!canPlace(state, seat, clearing)) return false
  if (openSlots(state, clearing) < 1) return false
  return true
}

function hasAnyDecreeBuild(
  state: GameState,
  seat: Seat,
  card: Card,
  ctx: Ctx,
): boolean {
  for (let clearing = 0; clearing < 12; clearing++) {
    if (buildLegal(state, seat, card, clearing as ClearingId, ctx)) return true
  }
  return false
}

function cardResolvable(
  state: GameState,
  seat: Seat,
  column: DecreeColumn,
  card: Card,
  ctx: Ctx,
): boolean {
  switch (column) {
    case 'recruit':
      for (let c = 0; c < 12; c++) {
        if (recruitLegal(state, seat, card, c as ClearingId)) return true
      }
      return false
    case 'move':
      return hasAnyDecreeMove(state, seat, card, ctx)
    case 'battle':
      return hasAnyDecreeBattle(state, seat, card)
    case 'build':
      return hasAnyDecreeBuild(state, seat, card, ctx)
  }
}

function findDecreeCard(board: EyrieBoard, column: DecreeColumn, cardId: string): Card | undefined {
  return board.decree[column].find((c) => c.id === cardId)
}

function ensureDecreeCursor(state: GameState, seat: Seat): DecreeCursor | null {
  if (state.turnScratch.decree) return state.turnScratch.decree
  const board = boardOf(state, seat)
  for (const column of DECREE_COLUMNS) {
    if (board.decree[column].length === 0) continue
    const cursor: DecreeCursor = {
      column,
      remaining: board.decree[column].map((c) => c.id),
    }
    state.turnScratch.decree = cursor
    return cursor
  }
  return null
}

function advanceDecreeCursor(state: GameState, seat: Seat): void {
  const board = boardOf(state, seat)
  const cursor = state.turnScratch.decree
  if (!cursor) return
  if (cursor.remaining.length > 0) return
  const idx = DECREE_COLUMNS.indexOf(cursor.column)
  for (let i = idx + 1; i < DECREE_COLUMNS.length; i++) {
    const column = DECREE_COLUMNS[i]!
    if (board.decree[column].length === 0) continue
    state.turnScratch.decree = {
      column,
      remaining: board.decree[column].map((c) => c.id),
    }
    return
  }
  state.turnScratch.decree = null
}

function removeDecreeCard(board: EyrieBoard, column: DecreeColumn, cardId: string): Card {
  const idx = board.decree[column].findIndex((c) => c.id === cardId)
  if (idx < 0) throw new RuleError('DECREE_CARD_MISSING', { column, cardId })
  return board.decree[column].splice(idx, 1)[0]!
}

function tuckBuilderViziers(board: EyrieBoard): void {
  const [v0, v1] = makeViziers()
  board.decree = { recruit: [], move: [], battle: [], build: [] }
  board.decree.recruit.push(v0)
  board.decree.move.push(v1)
}

function warriorCount(state: GameState, clearing: ClearingId): number {
  return state.clearings[clearing]!.pieces.filter((p) => p.kind === 'warrior').length
}

function fewestWarriorClearings(state: GameState, seat: Seat): ClearingId[] {
  const candidates: ClearingId[] = []
  for (let id = 0; id < 12; id++) {
    if (!canPlace(state, seat, id as ClearingId)) continue
    if (openSlots(state, id as ClearingId) < 1) continue
    if (boardOf(state, seat).roostTrack.placed < 1) continue
    candidates.push(id as ClearingId)
  }
  if (candidates.length === 0) return []
  let min = Infinity
  for (const c of candidates) {
    min = Math.min(min, warriorCount(state, c))
  }
  return candidates.filter((c) => warriorCount(state, c) === min)
}

function eveningDrawBonus(roostCount: number): number {
  let bonus = 0
  for (const t of EYRIE_ROOST_DRAW_BONUS_THRESHOLDS) {
    if (roostCount >= t) bonus += 1
  }
  return bonus
}

function retuckViziersAfterPurge(board: EyrieBoard): void {
  const viziers = DECREE_COLUMNS.flatMap((col) => board.decree[col].filter(isVizier))
  board.decree = { recruit: [], move: [], battle: [], build: [] }
  // Rule: 7.8.1 Builder — Recruit + Move. House: Builder-only depose retucks same.
  if (viziers[0]) board.decree.recruit.push(viziers[0])
  if (viziers[1]) board.decree.move.push(viziers[1])
}

export class Eyrie extends Faction {
  readonly id = 'eyrie' as const
  readonly steps = STEPS

  setup(state: GameState, seat: Seat, _ctx: Ctx): void {
    const board = boardOf(state, seat)
    board.supply.warriors = 20
    board.leader = 'builder'
    board.roostTrack.placed = 6

    const start = eyrieStartClearing(state)
    // Rule: Eyrie > Setup 2 — roost + 6 warriors; 6 remain on track.
    placeUpTo(state, seat, start, { kind: 'building', type: 'roost' }, 1)
    placeUpTo(state, seat, start, { kind: 'warrior' }, 6)

    // Rule: Eyrie > Setup 3–4 / 7.8.1 Builder viziers on Recruit + Move.
    tuckBuilderViziers(board)
  }

  autoActions(state: GameState, phase: Phase, step: Step): Action[] {
    if (phase === 'birdsong' && step === 'emergency') {
      if (state.turnScratch.emergencyOrdersDone) return []
      if (playerOf(state, state.currentSeat).hand.length > 0) return []
      return [{ type: 'emergencyOrders' }]
    }
    if (phase === 'evening' && step === 'score') {
      if (state.turnScratch.eveningScoreDone) return []
      return [{ type: 'eveningScore' }]
    }
    if (phase === 'evening' && step === 'draw') {
      if (state.turnScratch.eveningDrawDone) return []
      return [{ type: 'eveningDraw' }]
    }
    return []
  }

  legalActions(state: GameState, ctx: Ctx): ActionSpec[] {
    const seat = state.currentSeat
    const specs: ActionSpec[] = [...ctx.grantedActions()]

    if (state.phase === 'birdsong' && state.step === 'emergency') {
      specs.push({ type: 'endPhase', actor: seat })
      return specs
    }

    if (state.phase === 'birdsong' && state.step === 'decreeAdd') {
      const hand = playerOf(state, seat).hand
      if (hand.length > 0) {
        specs.push({
          type: 'addToDecree',
          actor: seat,
          params: {
            cardIds: hand.map((c) => c.id),
            birdCardIds: hand.filter((c) => defOf(c).suit === 'bird').map((c) => c.id),
            columns: [...DECREE_COLUMNS],
          },
        })
      } else {
        specs.push({ type: 'endPhase', actor: seat })
      }
      return specs
    }

    if (state.phase === 'birdsong' && state.step === 'newRoost') {
      if (roostsOnMap(state, seat) === 0 && boardOf(state, seat).roostTrack.placed > 0) {
        specs.push({
          type: 'newRoost',
          actor: seat,
          params: { clearing: fewestWarriorClearings(state, seat) },
        })
        return specs
      }
      specs.push({ type: 'endPhase', actor: seat })
      return specs
    }

    if (state.phase === 'daylight' && state.step === 'craft') {
      const craftable = playerOf(state, seat).hand.filter((c) => canCraft(state, seat, c))
      if (craftable.length > 0) {
        specs.push({
          type: 'craft',
          actor: seat,
          params: { cardIds: craftable.map((c) => c.id) },
        })
      }
      specs.push({ type: 'endPhase', actor: seat })
      return specs
    }

    if (state.phase === 'daylight' && state.step === 'decree') {
      const cursor = ensureDecreeCursor(state, seat)
      if (!cursor) {
        specs.push({ type: 'endPhase', actor: seat })
        return specs
      }
      const board = boardOf(state, seat)
      let any = false
      for (const cardId of cursor.remaining) {
        const card = findDecreeCard(board, cursor.column, cardId)
        if (!card) continue
        if (!cardResolvable(state, seat, cursor.column, card, ctx)) continue
        any = true
        const params: Record<string, unknown[]> = {
          column: [cursor.column],
          cardIds: [cardId],
        }
        if (cursor.column === 'recruit') {
          params.clearing = Array.from({ length: 12 }, (_, i) => i).filter((c) =>
            recruitLegal(state, seat, card, c as ClearingId),
          )
        } else if (cursor.column === 'build') {
          params.clearing = Array.from({ length: 12 }, (_, i) => i).filter((c) =>
            buildLegal(state, seat, card, c as ClearingId, ctx),
          )
        } else if (cursor.column === 'battle') {
          const clearings: number[] = []
          const defenders: number[] = []
          for (let c = 0; c < 12; c++) {
            for (const d of enemySeatsInClearing(state, c as ClearingId, seat)) {
              if (battleLegal(state, seat, card, c as ClearingId, d)) {
                clearings.push(c)
                defenders.push(d)
              }
            }
          }
          params.clearing = clearings
          params.defender = defenders
        } else if (cursor.column === 'move') {
          const froms: number[] = []
          const tos: number[] = []
          for (let from = 0; from < 12; from++) {
            if (!cardMatchesClearing(card, from as ClearingId)) continue
            if (warriors(state, from as ClearingId, seat) < 1) continue
            for (let to = 0; to < 12; to++) {
              if (canMove(state, seat, from as ClearingId, to as ClearingId, ctx.hooks)) {
                froms.push(from)
                tos.push(to)
              }
            }
          }
          params.from = froms
          params.to = tos
        }
        specs.push({ type: 'decree', actor: seat, params })
      }
      if (!any) {
        specs.push({ type: 'turmoil', actor: seat })
        return specs
      }
      return specs
    }

    if (state.phase === 'evening' && state.step === 'score') {
      specs.push({ type: 'endPhase', actor: seat })
      return specs
    }

    if (state.phase === 'evening' && state.step === 'draw') {
      specs.push({ type: 'endPhase', actor: seat })
      return specs
    }

    if (state.phase === 'evening' && state.step === 'discard') {
      const handSize = playerOf(state, seat).hand.length
      if (handSize > HAND_LIMIT) {
        specs.push({ type: 'discard', actor: seat })
        return specs
      }
      specs.push({ type: 'endPhase', actor: seat })
      return specs
    }

    specs.push({ type: 'endPhase', actor: seat })
    return specs
  }

  validate(state: GameState, action: Action, ctx: Ctx): void {
    const seat = state.currentSeat

    switch (action.type) {
      case 'endPhase': {
        if (
          state.phase === 'birdsong' &&
          state.step === 'decreeAdd' &&
          playerOf(state, seat).hand.length > 0
        ) {
          throw new RuleError('MUST_ADD_TO_DECREE')
        }
        if (
          state.phase === 'birdsong' &&
          state.step === 'newRoost' &&
          roostsOnMap(state, seat) === 0 &&
          boardOf(state, seat).roostTrack.placed > 0
        ) {
          throw new RuleError('MUST_NEW_ROOST')
        }
        if (
          state.phase === 'evening' &&
          state.step === 'discard' &&
          playerOf(state, seat).hand.length > HAND_LIMIT
        ) {
          throw new RuleError('HAND_OVER_LIMIT', {
            hand: playerOf(state, seat).hand.length,
          })
        }
        if (state.phase === 'daylight' && state.step === 'decree') {
          const cursor = ensureDecreeCursor(state, seat)
          if (cursor) throw new RuleError('DECREE_INCOMPLETE')
        }
        return
      }
      case 'emergencyOrders':
        if (state.phase !== 'birdsong' || state.step !== 'emergency') {
          throw new RuleError('WRONG_STEP', { phase: state.phase, step: state.step })
        }
        return
      case 'eveningScore':
        if (state.phase !== 'evening' || state.step !== 'score') {
          throw new RuleError('WRONG_STEP', { phase: state.phase, step: state.step })
        }
        return
      case 'eveningDraw':
        if (state.phase !== 'evening' || state.step !== 'draw') {
          throw new RuleError('WRONG_STEP', { phase: state.phase, step: state.step })
        }
        return
      case 'addToDecree': {
        if (state.phase !== 'birdsong' || state.step !== 'decreeAdd') {
          throw new RuleError('WRONG_STEP', { phase: state.phase, step: state.step })
        }
        if (action.cards.length < 1 || action.cards.length > 2) {
          throw new RuleError('INVALID_DECREE_ADD', { count: action.cards.length })
        }
        const hand = playerOf(state, seat).hand
        const ids = new Set<string>()
        let birds = 0
        for (const entry of action.cards) {
          if (ids.has(entry.cardId)) throw new RuleError('DUPLICATE_DECREE_CARD', entry)
          ids.add(entry.cardId)
          if (!DECREE_COLUMNS.includes(entry.column)) {
            throw new RuleError('INVALID_DECREE_COLUMN', { column: entry.column })
          }
          const card = hand.find((c) => c.id === entry.cardId)
          if (!card) throw new RuleError('CARD_NOT_IN_HAND', { cardId: entry.cardId })
          if (defOf(card).suit === 'bird') birds += 1
        }
        if (birds > 1) throw new RuleError('TOO_MANY_BIRDS_ON_DECREE', { birds })
        return
      }
      case 'newRoost': {
        if (state.phase !== 'birdsong' || state.step !== 'newRoost') {
          throw new RuleError('WRONG_STEP', { phase: state.phase, step: state.step })
        }
        if (roostsOnMap(state, seat) > 0) throw new RuleError('ROOSTS_STILL_ON_MAP')
        if (!fewestWarriorClearings(state, seat).includes(action.clearing)) {
          throw new RuleError('INVALID_NEW_ROOST', { clearing: action.clearing })
        }
        return
      }
      case 'craft': {
        if (state.phase !== 'daylight' || state.step !== 'craft') {
          throw new RuleError('WRONG_STEP', { phase: state.phase, step: state.step })
        }
        const card = playerOf(state, seat).hand.find((c) => c.id === action.cardId)
        if (!card || !canCraft(state, seat, card)) {
          throw new RuleError('CANNOT_CRAFT', { cardId: action.cardId })
        }
        return
      }
      case 'decree': {
        if (state.phase !== 'daylight' || state.step !== 'decree') {
          throw new RuleError('WRONG_STEP', { phase: state.phase, step: state.step })
        }
        const cursor = ensureDecreeCursor(state, seat)
        if (!cursor || cursor.column !== action.column) {
          throw new RuleError('WRONG_DECREE_COLUMN', {
            expected: cursor?.column,
            got: action.column,
          })
        }
        if (!cursor.remaining.includes(action.cardId)) {
          throw new RuleError('DECREE_CARD_NOT_REMAINING', { cardId: action.cardId })
        }
        const board = boardOf(state, seat)
        const card = findDecreeCard(board, action.column, action.cardId)
        if (!card) throw new RuleError('DECREE_CARD_MISSING', { cardId: action.cardId })
        switch (action.column) {
          case 'recruit':
            if (action.clearing === undefined) throw new RuleError('CLEARING_REQUIRED')
            if (!recruitLegal(state, seat, card, action.clearing)) {
              throw new RuleError('CANNOT_DECREE_RECRUIT', { clearing: action.clearing })
            }
            return
          case 'move':
            if (!action.moves || !moveLegal(state, seat, card, action.moves, ctx)) {
              throw new RuleError('CANNOT_DECREE_MOVE', { moves: action.moves })
            }
            return
          case 'battle':
            if (action.clearing === undefined || action.defender === undefined) {
              throw new RuleError('BATTLE_PARAMS_REQUIRED')
            }
            if (!battleLegal(state, seat, card, action.clearing, action.defender)) {
              throw new RuleError('CANNOT_DECREE_BATTLE', {
                clearing: action.clearing,
                defender: action.defender,
              })
            }
            return
          case 'build':
            if (action.clearing === undefined) throw new RuleError('CLEARING_REQUIRED')
            if (!buildLegal(state, seat, card, action.clearing, ctx)) {
              throw new RuleError('CANNOT_DECREE_BUILD', { clearing: action.clearing })
            }
            return
        }
        return
      }
      case 'turmoil': {
        if (state.phase !== 'daylight' || state.step !== 'decree') {
          throw new RuleError('WRONG_STEP', { phase: state.phase, step: state.step })
        }
        const cursor = ensureDecreeCursor(state, seat)
        if (!cursor) throw new RuleError('NO_DECREE_TO_TURMOIL')
        const board = boardOf(state, seat)
        for (const cardId of cursor.remaining) {
          const card = findDecreeCard(board, cursor.column, cardId)
          if (card && cardResolvable(state, seat, cursor.column, card, ctx)) {
            throw new RuleError('DECREE_STILL_RESOLVABLE')
          }
        }
        return
      }
      case 'discard': {
        if (state.phase !== 'evening' || state.step !== 'discard') {
          throw new RuleError('WRONG_STEP', { phase: state.phase, step: state.step })
        }
        const hand = playerOf(state, seat).hand
        if (hand.length <= HAND_LIMIT) throw new RuleError('HAND_NOT_OVER_LIMIT')
        const ids = new Set(action.cardIds)
        if (ids.size !== action.cardIds.length) {
          throw new RuleError('DUPLICATE_DISCARD', { cardIds: action.cardIds })
        }
        for (const id of action.cardIds) {
          if (!hand.some((c) => c.id === id)) throw new RuleError('CARD_NOT_IN_HAND', { cardId: id })
        }
        if (hand.length - action.cardIds.length > HAND_LIMIT) {
          throw new RuleError('DISCARD_TOO_FEW', {
            hand: hand.length,
            discarded: action.cardIds.length,
          })
        }
        return
      }
      default:
        throw new RuleError('NOT_IMPLEMENTED', { action: action.type })
    }
  }

  apply(state: GameState, action: Action, ctx: Ctx): LogEntry[] {
    const seat = state.currentSeat
    const logs: LogEntry[] = []

    switch (action.type) {
      case 'endPhase':
        return [{ t: 'action', actor: seat, action }]
      case 'emergencyOrders': {
        // Rule: Eyrie > Birdsong 1 — empty hand → draw 1.
        const drawn = Deck.draw(state.deck, 1, {
          shuffle: (cards) => cards,
          onDominance: (card) => state.dominanceAvailable.push(card),
        })
        playerOf(state, seat).hand.push(...drawn)
        state.turnScratch.emergencyOrdersDone = true
        ctx.emit({ s: 'draw', actor: seat, count: drawn.length })
        logs.push({ t: 'action', actor: seat, action })
        return logs
      }
      case 'addToDecree': {
        const player = playerOf(state, seat)
        const board = boardOf(state, seat)
        for (const entry of action.cards) {
          const idx = player.hand.findIndex((c) => c.id === entry.cardId)
          const card = player.hand.splice(idx, 1)[0]!
          board.decree[entry.column].push(card)
        }
        logs.push({ t: 'action', actor: seat, action })
        return logs
      }
      case 'newRoost': {
        const board = boardOf(state, seat)
        board.roostTrack.placed -= 1
        placeUpTo(state, seat, action.clearing, { kind: 'building', type: 'roost' }, 1)
        placeUpTo(state, seat, action.clearing, { kind: 'warrior' }, 3)
        logs.push({ t: 'action', actor: seat, action })
        return logs
      }
      case 'craft':
        return craftCard(state, seat, action.cardId, ctx)
      case 'decree': {
        const board = boardOf(state, seat)
        const cursor = state.turnScratch.decree!
        const card = removeDecreeCard(board, action.column, action.cardId)
        cursor.remaining = cursor.remaining.filter((id) => id !== action.cardId)

        switch (action.column) {
          case 'recruit':
            placeUpTo(state, seat, action.clearing!, { kind: 'warrior' }, 1)
            break
          case 'move':
            for (const move of action.moves!) {
              logs.push(...moveWarriors(state, seat, move.from, move.to, move.count, ctx))
            }
            break
          case 'battle': {
            logs.push(
              ...openBattle(state, action.clearing!, seat, action.defender!, ctx),
            )
            break
          }
          case 'build': {
            board.roostTrack.placed -= 1
            placeUpTo(state, seat, action.clearing!, { kind: 'building', type: 'roost' }, 1)
            break
          }
        }

        // Viziers stay on decree (not discarded); hand cards leave column already via remove.
        // Loyal Viziers: remove from column when resolved? Law: resolve each card — viziers are
        // spent for the action but stay on decree until Purge. They remain on the board for the
        // turn after resolving? Physical game: you take the action for the card; viziers stay
        // in the column for the whole game until purge. So we should NOT remove viziers from
        // decree when resolving — only remove from remaining cursor.
        if (isVizier(card)) {
          board.decree[action.column].push(card)
        } else {
          Deck.discard(state.deck, card, {
            onDominance: (c) => state.dominanceAvailable.push(c),
          })
        }

        advanceDecreeCursor(state, seat)
        logs.push({ t: 'action', actor: seat, action })
        return logs
      }
      case 'turmoil': {
        const board = boardOf(state, seat)
        // Rule: 7.7.1 Humiliate — −1 VP per bird incl. viziers.
        let birds = 0
        for (const col of DECREE_COLUMNS) {
          for (const c of board.decree[col]) {
            if (defOf(c).suit === 'bird') birds += 1
          }
        }
        if (birds > 0) {
          playerOf(state, seat).vp -= birds
          logs.push({ t: 'vp', actor: seat, delta: -birds, reason: 'turmoil humiliate' })
        }
        // Rule: 7.7.2 Purge — discard non-viziers.
        for (const col of DECREE_COLUMNS) {
          const kept: Card[] = []
          for (const c of board.decree[col]) {
            if (isVizier(c)) kept.push(c)
            else {
              Deck.discard(state.deck, c, {
                onDominance: (x) => state.dominanceAvailable.push(x),
              })
            }
          }
          board.decree[col] = kept
        }
        // Rule: 7.7.3 Depose — Builder-only: retuck viziers Recruit+Move.
        retuckViziersAfterPurge(board)
        state.turnScratch.decree = null
        // Rule: 7.7.4 Rest — end Daylight → Evening score.
        state.phase = 'evening'
        state.step = 'score'
        logs.push({ t: 'action', actor: seat, action })
        logs.push({ t: 'phase', actor: seat, phase: 'evening', step: 'score' })
        return logs
      }
      case 'eveningScore': {
        const n = roostsOnMap(state, seat)
        const vp = EYRIE_ROOST_VP[Math.min(n, 7)] ?? 0
        if (vp > 0) {
          playerOf(state, seat).vp += vp
          logs.push({ t: 'vp', actor: seat, delta: vp, reason: 'roosts' })
          ctx.emit({ s: 'vp', actor: seat, delta: vp })
        }
        state.turnScratch.eveningScoreDone = true
        logs.push({ t: 'action', actor: seat, action })
        return logs
      }
      case 'eveningDraw': {
        const n = roostsOnMap(state, seat)
        const count = 1 + eveningDrawBonus(n)
        const drawn = Deck.draw(state.deck, count, {
          shuffle: (cards) => cards,
          onDominance: (card) => state.dominanceAvailable.push(card),
        })
        playerOf(state, seat).hand.push(...drawn)
        state.turnScratch.eveningDrawDone = true
        ctx.emit({ s: 'draw', actor: seat, count: drawn.length })
        logs.push({ t: 'action', actor: seat, action })
        return logs
      }
      case 'discard': {
        const player = playerOf(state, seat)
        for (const id of action.cardIds) {
          const idx = player.hand.findIndex((c) => c.id === id)
          const card = player.hand.splice(idx, 1)[0]!
          Deck.discard(state.deck, card, {
            onDominance: (c) => state.dominanceAvailable.push(c),
          })
        }
        logs.push({ t: 'action', actor: seat, action })
        return logs
      }
      default:
        throw new RuleError('NOT_IMPLEMENTED', { action: action.type })
    }
  }

  endTurn(state: GameState): void {
    for (const clearing of state.clearings) {
      for (const piece of clearing.pieces) {
        if (piece.kind === 'building' && piece.owner === state.currentSeat) {
          piece.used = false
        }
      }
    }
    state.turnScratch = {
      actionsLeft: 0,
      extraActions: 0,
      recruited: false,
      birdsongWoodDone: false,
      eveningDrawDone: false,
      swapMeetUsed: false,
      emergencyOrdersDone: false,
      eveningScoreDone: false,
      decree: null,
    }
  }
}

export const EYRIE = new Eyrie()
