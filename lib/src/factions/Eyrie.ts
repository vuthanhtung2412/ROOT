import type { Action, ActionSpec } from '#actions/types.js'
import { defOf } from '#cards/Deck.js'
import { Deck } from '#cards/Deck.js'
import type { Card } from '#cards/types.js'
import { openBattle } from '#events/battle.js'
import {
  advanceDecreeCursor,
  battleLegal,
  buildLegal,
  cardResolvable,
  ensureDecreeCursor,
  findDecreeCard,
  moveLegal,
  recruitLegal,
  recruitWarriorCount,
  removeDecreeCard,
} from '#factions/eyrie/decree.js'
import { eyrieLegalActions } from '#factions/eyrie/legalActions.js'
import {
  boardOf,
  eveningDrawBonus,
  fewestWarriorClearings,
  roostsOnMap,
} from '#factions/eyrie/rules.js'
import {
  placeEyrieRoostSetup,
  tuckViziersFor,
} from '#factions/eyrie/setup.js'
import { isVizier } from '#factions/eyrie/viziers.js'
import { Faction } from '#factions/Faction.js'
import type { Ctx } from '#game/ctx.js'
import type { LogEntry } from '#log/types.js'
import { canCraft } from '#queries/craft.js'
import { playerOf } from '#queries/seat.js'
import { craftCard, resetCraftingBuildingUsed } from '#rules/craft.js'
import { moveWarriors } from '#rules/move.js'
import { placeUpTo } from '#rules/place.js'
import { RuleError } from '#rules/RuleError.js'
import { addVictoryPoints } from '#rules/dominance.js'
import {
  DECREE_COLUMNS,
  EYRIE_ROOST_VP,
  eyrieLeaderPools,
} from '#state/boards.js'
import type { GameState, Phase, Step } from '#state/types.js'
import { createTurnScratch } from '#state/turnScratch.js'
import type { Seat } from '#pieces/types.js'
import {
  applyDiscard,
  drawCards,
  validateDiscard,
  validateHandLimit,
} from '#factions/sharedTurn.js'

export {
  assignEyrieLeader,
  eyrieStartClearing,
  LEADER_VIZIER_COLUMNS,
  placeEyrieRoostSetup,
  tuckViziersFor,
} from '#factions/eyrie/setup.js'

const STEPS: Record<Phase, Step[]> = {
  birdsong: ['emergency', 'decreeAdd', 'newRoost'],
  daylight: ['craft', 'decree'],
  evening: ['score', 'draw', 'discard'],
}

export class Eyrie extends Faction {
  readonly id = 'eyrie' as const
  readonly steps = STEPS

  setup(state: GameState, seat: Seat, _ctx: Ctx): void {
    // Direct-call path (unit tests): roost + Builder. Game.start uses chooseLeader.
    placeEyrieRoostSetup(state, seat)
    const board = boardOf(state, seat)
    const pools = eyrieLeaderPools('builder')
    board.leader = 'builder'
    board.leadersFaceUp = pools.leadersFaceUp
    board.leadersFaceDown = pools.leadersFaceDown
    tuckViziersFor(board, 'builder')
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
    return eyrieLegalActions(state, ctx)
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
        if (state.phase === 'evening' && state.step === 'discard') {
          validateHandLimit(state, seat)
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
            if (!action.moves || !moveLegal(state, { seat, card, moves: action.moves }, ctx)) {
              throw new RuleError('CANNOT_DECREE_MOVE', { moves: action.moves })
            }
            return
          case 'battle':
            if (action.clearing === undefined || action.defender === undefined) {
              throw new RuleError('BATTLE_PARAMS_REQUIRED')
            }
            if (!battleLegal(state, { seat, card, clearing: action.clearing, defender: action.defender })) {
              throw new RuleError('CANNOT_DECREE_BATTLE', {
                clearing: action.clearing,
                defender: action.defender,
              })
            }
            return
          case 'build':
            if (action.clearing === undefined) throw new RuleError('CLEARING_REQUIRED')
            if (!buildLegal(state, { seat, card, clearing: action.clearing }, ctx)) {
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
          if (card && cardResolvable(state, { seat, column: cursor.column, card }, ctx)) {
            throw new RuleError('DECREE_STILL_RESOLVABLE')
          }
        }
        return
      }
      case 'discard': {
        if (state.phase !== 'evening' || state.step !== 'discard') {
          throw new RuleError('WRONG_STEP', { phase: state.phase, step: state.step })
        }
        validateDiscard(state, seat, action.cardIds)
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
        drawCards(state, { seat, count: 1 }, ctx)
        state.turnScratch.emergencyOrdersDone = true
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
        placeUpTo(state, { seat, clearing: action.clearing, spec: { kind: 'building', type: 'roost' }, count: 1 })
        placeUpTo(state, { seat, clearing: action.clearing, spec: { kind: 'warrior' }, count: 3 })
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
            placeUpTo(state, {
              seat,
              clearing: action.clearing!,
              spec: { kind: 'warrior' },
              count: recruitWarriorCount(state, seat),
            })
            break
          case 'move':
            for (const move of action.moves!) {
              logs.push(...moveWarriors(state, { seat, from: move.from, to: move.to, count: move.count }, ctx))
            }
            break
          case 'battle': {
            logs.push(
              ...openBattle(
                state,
                {
                  clearing: action.clearing!,
                  attacker: seat,
                  defender: action.defender!,
                },
                ctx,
              ),
            )
            break
          }
          case 'build': {
            board.roostTrack.placed -= 1
            placeUpTo(state, { seat, clearing: action.clearing!, spec: { kind: 'building', type: 'roost' }, count: 1 })
            break
          }
        }

        // Rule: 7.5.2 / 7.7.2 — resolve removes card from turn cursor only.
        // All decree cards (hand + Loyal Viziers) stay until Purge (7.7.2).
        board.decree[action.column].push(card)

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
          // Rule: 7.7.1 Humiliate — score track starts at 0 (Setup); no space below 0.
          const player = playerOf(state, seat)
          const nextVictoryPoints = Math.max(0, player.vp - birds)
          const delta = nextVictoryPoints - player.vp
          player.vp = nextVictoryPoints
          if (delta !== 0) {
            logs.push({ t: 'vp', actor: seat, delta, reason: 'turmoil humiliate' })
          }
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
        // Rule: 7.7.3 Depose — flip current face down; choose from face-up (New Clutch if none).
        if (board.leader !== null) {
          board.leadersFaceDown = [...board.leadersFaceDown, board.leader]
          board.leader = null
        }
        if (board.leadersFaceUp.length === 0) {
          board.leadersFaceUp = [...board.leadersFaceDown]
          board.leadersFaceDown = []
        }
        state.turnScratch.decree = null
        state.turnScratch.decreeDone = true
        state.pending.push({ type: 'chooseLeader', seat, reason: 'depose' })
        logs.push({ t: 'action', actor: seat, action })
        return logs
      }
      case 'eveningScore': {
        const n = roostsOnMap(state, seat)
        const vp = EYRIE_ROOST_VP[Math.min(n, 7)] ?? 0
        if (vp > 0) {
          const scored = addVictoryPoints(state, seat, vp)
          if (scored > 0) {
            logs.push({ t: 'vp', actor: seat, delta: scored, reason: 'roosts' })
            ctx.emit({ s: 'vp', actor: seat, delta: scored })
          }
        }
        state.turnScratch.eveningScoreDone = true
        logs.push({ t: 'action', actor: seat, action })
        return logs
      }
      case 'eveningDraw': {
        const n = roostsOnMap(state, seat)
        const count = 1 + eveningDrawBonus(n)
        drawCards(state, { seat, count }, ctx)
        state.turnScratch.eveningDrawDone = true
        logs.push({ t: 'action', actor: seat, action })
        return logs
      }
      case 'discard': {
        applyDiscard(state, seat, action.cardIds)
        logs.push({ t: 'action', actor: seat, action })
        return logs
      }
      default:
        throw new RuleError('NOT_IMPLEMENTED', { action: action.type })
    }
  }

  endTurn(state: GameState): void {
    resetCraftingBuildingUsed(state, state.currentSeat)
    state.turnScratch = createTurnScratch()
  }
}

export const EYRIE = new Eyrie()
