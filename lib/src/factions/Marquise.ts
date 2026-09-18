import type { Action, ActionSpec } from '../actions/types.js'
import { defOf } from '../cards/Deck.js'
import { Deck } from '../cards/Deck.js'
import { matchesSuit } from '../cards/suit.js'
import { FALL } from '../map/fall.js'
import type { ClearingId } from '../map/types.js'
import { canCraft } from '../queries/craft.js'
import { canMove } from '../queries/move.js'
import { canPlace } from '../queries/place.js'
import { warriors } from '../queries/pieces.js'
import { rules } from '../queries/ruler.js'
import { playerOf } from '../queries/seat.js'
import { openSlots } from '../queries/slots.js'
import { woodReachable } from '../queries/wood.js'
import { craftCard } from '../rules/craft.js'
import { moveWarriors } from '../rules/move.js'
import { placeUpTo } from '../rules/place.js'
import { RuleError } from '../rules/RuleError.js'
import {
  MARQUISE_BUILD_COST,
  MARQUISE_RECRUITER_DRAW_BONUS_INDICES,
  MARQUISE_RECRUITER_VP,
  MARQUISE_SAWMILL_VP,
  MARQUISE_WORKSHOP_VP,
  type MarquiseBoard,
} from '../state/boards.js'
import { HAND_LIMIT } from '../state/constants.js'
import type { GameState, Phase, Step } from '../state/types.js'
import type { Ctx } from '../game/ctx.js'
import type { LogEntry } from '../log/types.js'
import type { BuildingType, Seat } from '../pieces/types.js'
import { connectedRuled } from '../queries/connected.js'
import { openBattle } from '../events/battle.js'
import { Faction } from './Faction.js'

const STEPS: Record<Phase, Step[]> = {
  birdsong: ['wood'],
  daylight: ['craft', 'actions'],
  evening: ['draw', 'discard'],
}

const MARQUISE_BUILDINGS = ['sawmill', 'workshop', 'recruiter'] as const
type MarquiseBuilding = (typeof MARQUISE_BUILDINGS)[number]

function isMarquiseBuilding(type: BuildingType): type is MarquiseBuilding {
  for (const building of MARQUISE_BUILDINGS) {
    if (building === type) return true
  }
  return false
}

/** Rule: Marquise > Setup 1–2 — keep at FALL.corners[0]. */
export function keepCornerFor(state: GameState, seat: Seat): ClearingId {
  if (playerOf(state, seat).faction !== 'marquise') {
    throw new RuleError('NOT_MARQUISE', { seat })
  }
  return FALL.corners[0]
}

function garrisonClearings(_state: GameState, keep: ClearingId): ClearingId[] {
  // Rule: Marquise > Setup 3 — Garrison — all clearings except diagonally opposite corner.
  const opposite = FALL.opposite(keep)
  return Array.from({ length: 12 }, (_, id) => id).filter((id) => id !== opposite)
}

function placeStartingBuildings(state: GameState, seat: Seat, keep: ClearingId): void {
  const targets = [keep, ...FALL.adjacent(keep).sort((a, b) => a - b)]
  for (const type of MARQUISE_BUILDINGS) {
    for (const clearing of targets) {
      if (placeUpTo(state, { seat, clearing, spec: { kind: 'building', type }, count: 1 }) > 0) break
    }
  }
}

function fillTracks(board: MarquiseBoard): void {
  board.tracks.sawmill.placed = 5
  board.tracks.workshop.placed = 5
  board.tracks.recruiter.placed = 5
}

function boardOf(state: GameState, seat: Seat): MarquiseBoard {
  const board = playerOf(state, seat).board
  if (board.kind !== 'marquise') throw new RuleError('NOT_MARQUISE', { seat })
  return board
}

function actionBudget(state: GameState): number {
  return state.turnScratch.actionsLeft + state.turnScratch.extraActions
}

function consumeAction(state: GameState): void {
  if (state.turnScratch.extraActions > 0) {
    state.turnScratch.extraActions -= 1
    return
  }
  if (state.turnScratch.actionsLeft > 0) {
    state.turnScratch.actionsLeft -= 1
    return
  }
  throw new RuleError('NO_ACTIONS_LEFT')
}

export function buildColumn(placed: number): number {
  return 6 - placed
}

export function trackColumnOccupied(placed: number, column: number): boolean {
  if (placed <= 0) return false
  return column >= buildColumn(placed) && column <= 5
}

export function recruiterDrawBonus(board: MarquiseBoard): number {
  const placed = board.tracks.recruiter.placed
  let bonus = 0
  for (const idx of MARQUISE_RECRUITER_DRAW_BONUS_INDICES) {
    if (!trackColumnOccupied(placed, idx)) bonus += 1
  }
  return bonus
}

function buildVp(type: BuildingType, column: number): number {
  switch (type) {
    case 'sawmill':
      return MARQUISE_SAWMILL_VP[column]!
    case 'workshop':
      return MARQUISE_WORKSHOP_VP[column]!
    case 'recruiter':
      return MARQUISE_RECRUITER_VP[column]!
    default:
      throw new RuleError('INVALID_BUILDING', { type })
  }
}

type WoodPayment = {
  seat: Seat
  buildClearing: ClearingId
  amount: number
}

function payWood(state: GameState, payment: WoodPayment, ctx: Ctx): void {
  const { seat, buildClearing, amount } = payment
  if (amount <= 0) return
  const board = boardOf(state, seat)
  const region = connectedRuled(state, seat, buildClearing, ctx.hooks)
  let remaining = amount
  for (const id of [...region].sort((a, b) => a - b)) {
    const clearingState = state.clearings[id]!
    clearingState.pieces = clearingState.pieces.filter((piece) => {
      if (remaining <= 0) return true
      if (piece.kind === 'token' && piece.type === 'wood' && piece.owner === seat) {
        remaining -= 1
        // Rule: Glossary > Return — wood goes back to Marquise supply.
        board.supply.wood += 1
        return false
      }
      return true
    })
  }
  if (remaining > 0) throw new RuleError('NOT_ENOUGH_WOOD', { amount, remaining })
}

function sawmillClearings(state: GameState, seat: Seat): ClearingId[] {
  const out: ClearingId[] = []
  for (let id = 0; id < state.clearings.length; id++) {
    const has = state.clearings[id]!.pieces.some(
      (p) => p.kind === 'building' && p.type === 'sawmill' && p.owner === seat,
    )
    if (has) out.push(id)
  }
  return out
}

function recruiterClearings(state: GameState, seat: Seat): ClearingId[] {
  const out: ClearingId[] = []
  for (let id = 0; id < state.clearings.length; id++) {
    const has = state.clearings[id]!.pieces.some(
      (p) => p.kind === 'building' && p.type === 'recruiter' && p.owner === seat,
    )
    if (has) out.push(id)
  }
  return out
}

function canRecruit(state: GameState, seat: Seat): boolean {
  if (state.turnScratch.recruited) return false
  const board = boardOf(state, seat)
  if (board.supply.warriors < 1) return false
  return recruiterClearings(state, seat).length > 0
}

type BuildSite = {
  seat: Seat
  clearing: ClearingId
  building: MarquiseBuilding
}

function canBuildAt(state: GameState, site: BuildSite, ctx: Ctx): boolean {
  const { seat, clearing, building } = site
  if (!rules(state, clearing, seat, ctx.hooks)) return false
  if (!canPlace(state, seat, clearing)) return false
  if (openSlots(state, clearing) < 1) return false

  const board = boardOf(state, seat)
  const track = board.tracks[building]
  if (track.placed < 1) return false

  const column = buildColumn(track.placed)
  const cost = MARQUISE_BUILD_COST[column]!
  return woodReachable(state, seat, clearing, ctx.hooks) >= cost
}

function canOverwork(
  state: GameState,
  seat: Seat,
  clearing: ClearingId,
  cardId: string,
): boolean {
  const board = boardOf(state, seat)
  if (board.supply.wood < 1) return false
  const hasSawmill = state.clearings[clearing]!.pieces.some(
    (p) => p.kind === 'building' && p.type === 'sawmill' && p.owner === seat,
  )
  if (!hasSawmill) return false
  const card = playerOf(state, seat).hand.find((c) => c.id === cardId)
  if (!card) return false
  return matchesSuit(card, FALL.clearings[clearing]!.suit)
}

type MarchPath = {
  seat: Seat
  from: ClearingId
  to: ClearingId
}

function canMarchMove(state: GameState, path: MarchPath, ctx: Ctx): boolean {
  const { seat, from, to } = path
  return warriors(state, from, seat) > 0 && canMove(state, { seat, from, to }, ctx.hooks)
}

function hasLegalMarch(state: GameState, seat: Seat, ctx: Ctx): boolean {
  for (let from = 0; from < 12; from++) {
    for (let to = 0; to < 12; to++) {
      if (canMarchMove(state, { seat, from: from, to: to }, ctx)) return true
    }
  }
  return false
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

function canBattle(
  state: GameState,
  seat: Seat,
  clearing: ClearingId,
  defender: Seat,
): boolean {
  if (defender === seat) return false
  if (warriors(state, clearing, seat) < 1) return false
  return enemySeatsInClearing(state, clearing, seat).includes(defender)
}

function hasLegalBattle(state: GameState, seat: Seat): boolean {
  for (let clearing = 0; clearing < 12; clearing++) {
    const enemies = enemySeatsInClearing(state, clearing, seat)
    for (const defender of enemies) {
      if (canBattle(state, seat, clearing, defender)) return true
    }
  }
  return false
}

function placeBirdsongWood(state: GameState, seat: Seat): LogEntry[] {
  const board = boardOf(state, seat)
  const logs: LogEntry[] = []
  for (const clearing of sawmillClearings(state, seat)) {
    if (board.supply.wood < 1) break
    const placed = placeUpTo(state, { seat, clearing, spec: { kind: 'token', type: 'wood' }, count: 1 })
    if (placed > 0) {
      logs.push({
        t: 'pieces',
        clearing,
        placed: state.clearings[clearing]!.pieces.slice(-placed),
      })
    }
  }
  return logs
}

function eveningDrawCards(state: GameState, seat: Seat, ctx: Ctx): LogEntry[] {
  const board = boardOf(state, seat)
  const bonus = recruiterDrawBonus(board)
  const count = Math.min(3, 1 + bonus)
  const drawn = Deck.draw(state.deck, count, {
    shuffle: (cards) => cards,
    onDominance: (card) => state.dominanceAvailable.push(card),
  })
  playerOf(state, seat).hand.push(...drawn)
  ctx.emit({ s: 'draw', actor: seat, count: drawn.length })
  return [{ t: 'action', actor: seat, action: { type: 'eveningDraw' } }]
}

export class Marquise extends Faction {
  readonly id = 'marquise' as const
  readonly steps = STEPS

  setup(state: GameState, seat: Seat, _ctx: Ctx): void {
    const keep = keepCornerFor(state, seat)
    placeUpTo(state, { seat, clearing: keep, spec: { kind: 'token', type: 'keep' }, count: 1 })

    for (const clearing of garrisonClearings(state, keep)) {
      placeUpTo(state, { seat, clearing, spec: { kind: 'warrior' }, count: 1 })
    }

    placeStartingBuildings(state, seat, keep)

    const board = playerOf(state, seat).board
    if (board.kind !== 'marquise') throw new RuleError('NOT_MARQUISE', { seat })
    fillTracks(board)
  }

  autoActions(state: GameState, phase: Phase, step: Step): Action[] {
    const seat = state.currentSeat
    if (phase === 'birdsong' && step === 'wood') {
      if (state.turnScratch.birdsongWoodDone) return []
      if (sawmillClearings(state, seat).length === 0) return []
      if (boardOf(state, seat).supply.wood < 1) return []
      return [{ type: 'birdsongWood' }]
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

    if (state.phase === 'birdsong' && state.step === 'wood') {
      specs.push({ type: 'endPhase', actor: seat })
      return specs
    }

    if (state.phase === 'daylight' && state.step === 'craft') {
      for (const card of playerOf(state, seat).hand) {
        if (canCraft(state, seat, card)) {
          specs.push({ type: 'craft', actor: seat })
          break
        }
      }
      specs.push({ type: 'endPhase', actor: seat })
      return specs
    }

    if (state.phase === 'daylight' && state.step === 'actions') {
      for (const card of playerOf(state, seat).hand) {
        if (defOf(card).suit === 'bird') {
          specs.push({ type: 'spendBird', actor: seat })
          break
        }
      }

      if (actionBudget(state) > 0) {
        if (canRecruit(state, seat)) specs.push({ type: 'recruit', actor: seat })
        if (hasLegalMarch(state, seat, ctx)) specs.push({ type: 'march', actor: seat })

        for (let clearing = 0; clearing < 12; clearing++) {
          for (const building of MARQUISE_BUILDINGS) {
            if (canBuildAt(state, { seat, clearing: clearing, building }, ctx)) {
              specs.push({ type: 'build', actor: seat })
              break
            }
          }
        }

        for (const clearing of sawmillClearings(state, seat)) {
          for (const card of playerOf(state, seat).hand) {
            if (canOverwork(state, seat, clearing, card.id)) {
              specs.push({ type: 'overwork', actor: seat })
              break
            }
          }
        }

        if (hasLegalBattle(state, seat)) specs.push({ type: 'battle', actor: seat })
      }

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
          state.phase === 'evening' &&
          state.step === 'discard' &&
          playerOf(state, seat).hand.length > HAND_LIMIT
        ) {
          throw new RuleError('HAND_OVER_LIMIT', {
            hand: playerOf(state, seat).hand.length,
          })
        }
        return
      }
      case 'birdsongWood':
        if (state.phase !== 'birdsong' || state.step !== 'wood') {
          throw new RuleError('WRONG_STEP', { phase: state.phase, step: state.step })
        }
        return
      case 'eveningDraw':
        if (state.phase !== 'evening' || state.step !== 'draw') {
          throw new RuleError('WRONG_STEP', { phase: state.phase, step: state.step })
        }
        return
      case 'spendBird': {
        if (state.phase !== 'daylight' || state.step !== 'actions') {
          throw new RuleError('WRONG_STEP', { phase: state.phase, step: state.step })
        }
        const card = playerOf(state, seat).hand.find((c) => c.id === action.cardId)
        if (!card || defOf(card).suit !== 'bird') {
          throw new RuleError('NOT_A_BIRD', { cardId: action.cardId })
        }
        return
      }
      case 'recruit': {
        if (state.phase !== 'daylight' || state.step !== 'actions') {
          throw new RuleError('WRONG_STEP', { phase: state.phase, step: state.step })
        }
        if (actionBudget(state) < 1) throw new RuleError('NO_ACTIONS_LEFT')
        if (!canRecruit(state, seat)) throw new RuleError('CANNOT_RECRUIT')
        return
      }
      case 'march': {
        if (state.phase !== 'daylight' || state.step !== 'actions') {
          throw new RuleError('WRONG_STEP', { phase: state.phase, step: state.step })
        }
        if (actionBudget(state) < 1) throw new RuleError('NO_ACTIONS_LEFT')
        if (action.moves.length < 1 || action.moves.length > 2) {
          throw new RuleError('INVALID_MARCH', { count: action.moves.length })
        }
        for (const move of action.moves) {
          if (move.count < 1) throw new RuleError('INVALID_MOVE_COUNT', { move })
          if (!canMarchMove(state, { seat, from: move.from, to: move.to }, ctx)) {
            throw new RuleError('CANNOT_MOVE', { move })
          }
          if (move.count > warriors(state, move.from, seat)) {
            throw new RuleError('NOT_ENOUGH_WARRIORS', { move })
          }
        }
        return
      }
      case 'build': {
        if (state.phase !== 'daylight' || state.step !== 'actions') {
          throw new RuleError('WRONG_STEP', { phase: state.phase, step: state.step })
        }
        if (actionBudget(state) < 1) throw new RuleError('NO_ACTIONS_LEFT')
        if (!isMarquiseBuilding(action.building)) {
          throw new RuleError('INVALID_BUILDING', { building: action.building })
        }
        if (!canBuildAt(state, { seat, clearing: action.clearing, building: action.building }, ctx)) {
          throw new RuleError('CANNOT_BUILD', { clearing: action.clearing, building: action.building })
        }
        return
      }
      case 'overwork': {
        if (state.phase !== 'daylight' || state.step !== 'actions') {
          throw new RuleError('WRONG_STEP', { phase: state.phase, step: state.step })
        }
        if (actionBudget(state) < 1) throw new RuleError('NO_ACTIONS_LEFT')
        if (!canOverwork(state, seat, action.clearing, action.cardId)) {
          throw new RuleError('CANNOT_OVERWORK', { clearing: action.clearing, cardId: action.cardId })
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
      case 'battle': {
        if (state.phase !== 'daylight' || state.step !== 'actions') {
          throw new RuleError('WRONG_STEP', { phase: state.phase, step: state.step })
        }
        if (actionBudget(state) < 1) throw new RuleError('NO_ACTIONS_LEFT')
        if (!canBattle(state, seat, action.clearing, action.defender)) {
          throw new RuleError('CANNOT_BATTLE', {
            clearing: action.clearing,
            defender: action.defender,
          })
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
      case 'birdsongWood':
        logs.push(...placeBirdsongWood(state, seat))
        state.turnScratch.birdsongWoodDone = true
        logs.push({ t: 'action', actor: seat, action })
        return logs
      case 'eveningDraw':
        logs.push(...eveningDrawCards(state, seat, ctx))
        state.turnScratch.eveningDrawDone = true
        return logs
      case 'spendBird': {
        const player = playerOf(state, seat)
        const idx = player.hand.findIndex((c) => c.id === action.cardId)
        const card = player.hand.splice(idx, 1)[0]!
        Deck.discard(state.deck, card, {
          onDominance: (c) => state.dominanceAvailable.push(c),
        })
        state.turnScratch.extraActions += 1
        logs.push({ t: 'action', actor: seat, action })
        return logs
      }
      case 'recruit': {
        consumeAction(state)
        state.turnScratch.recruited = true
        for (const clearing of recruiterClearings(state, seat)) {
          placeUpTo(state, { seat, clearing, spec: { kind: 'warrior' }, count: 1 })
        }
        logs.push({ t: 'action', actor: seat, action })
        return logs
      }
      case 'march': {
        consumeAction(state)
        for (const move of action.moves) {
          logs.push(...moveWarriors(state, { seat, from: move.from, to: move.to, count: move.count }, ctx))
        }
        logs.push({ t: 'action', actor: seat, action })
        return logs
      }
      case 'build': {
        if (!isMarquiseBuilding(action.building)) {
          throw new RuleError('INVALID_BUILDING', { building: action.building })
        }
        consumeAction(state)
        const board = boardOf(state, seat)
        const track = board.tracks[action.building]
        const column = buildColumn(track.placed)
        const cost = MARQUISE_BUILD_COST[column]!
        payWood(state, { seat, buildClearing: action.clearing, amount: cost }, ctx)
        track.placed -= 1
        placeUpTo(state, { seat, clearing: action.clearing, spec: { kind: 'building', type: action.building }, count: 1 })
        const vp = buildVp(action.building, column)
        if (vp > 0) {
          playerOf(state, seat).vp += vp
          logs.push({ t: 'vp', actor: seat, delta: vp, reason: 'build' })
          ctx.emit({ s: 'vp', actor: seat, delta: vp })
        }
        logs.push({ t: 'action', actor: seat, action })
        return logs
      }
      case 'overwork': {
        consumeAction(state)
        const player = playerOf(state, seat)
        const idx = player.hand.findIndex((c) => c.id === action.cardId)
        const card = player.hand.splice(idx, 1)[0]!
        Deck.discard(state.deck, card, {
          onDominance: (c) => state.dominanceAvailable.push(c),
        })
        placeUpTo(state, { seat, clearing: action.clearing, spec: { kind: 'token', type: 'wood' }, count: 1 })
        logs.push({ t: 'action', actor: seat, action })
        return logs
      }
      case 'craft':
        return craftCard(state, seat, action.cardId, ctx)
      case 'battle': {
        consumeAction(state)
        const logs = openBattle(
          state,
          { clearing: action.clearing, attacker: seat, defender: action.defender },
          ctx,
        )
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
      actionsLeft: 3,
      extraActions: 0,
      recruited: false,
      birdsongWoodDone: false,
      eveningDrawDone: false,
      swapMeetUsed: false,
      emergencyOrdersDone: false,
      eveningScoreDone: false,
      decree: null,
      decreeDone: false,
    }
  }
}

export const MARQUISE = new Marquise()
