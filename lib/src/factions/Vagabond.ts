import type { Action, ActionSpec } from '#actions/types.js'
import { QUEST_DECK, questDefOf } from '#cards/quests.js'
import { openBattle } from '#events/battle.js'
import { Faction } from '#factions/Faction.js'
import {
  applyDiscard,
  drawCards,
  validateDiscard,
  validateHandLimit,
} from '#factions/sharedTurn.js'
import {
  craftWithHammers,
  enforceCapacity,
  exhaustAnyItem,
  improveRelationship,
  maybeHostile,
  movePawn,
} from '#factions/vagabond/apply.js'
import { isAlliedWith } from '#factions/vagabond/allied.js'
import {
  boardOf,
  exhaustItem,
  faceUpCoinCount,
  faceUpTeaCount,
  pawnClearing,
  placeItemInSatchelOrTrack,
  refreshItems,
  restoreRepairedItem,
} from '#factions/vagabond/items.js'
import {
  destinationHasHostile,
  pushDaylightActions,
  slipDestinations,
} from '#factions/vagabond/legalActions.js'
import type { Ctx } from '#game/ctx.js'
import type { LogEntry } from '#log/types.js'
import { FALL } from '#map/fall.js'
import type { Seat } from '#pieces/types.js'
import { playerOf } from '#queries/seat.js'
import { warriors } from '#queries/pieces.js'
import { moveWarriors } from '#rules/move.js'
import { removePieces } from '#rules/remove.js'
import { RuleError } from '#rules/RuleError.js'
import { randomIndex } from '#rules/Rng.js'
import { addVictoryPoints } from '#rules/dominance.js'
import {
  FACE_UP_QUEST_COUNT,
  THIEF_START_ITEMS,
  VAGABOND_TRACK_ITEM_CAP,
} from '#state/boards.js'
import type { GameState, Phase, Step } from '#state/types.js'
import { createTurnScratch } from '#state/turnScratch.js'

function shuffleWithRng<T>(items: T[], rng: Ctx['rng']): T[] {
  const shuffled = [...items]
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swapIndex = randomIndex(rng, index + 1)
    ;[shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex]!,
      shuffled[index]!,
    ]
  }
  return shuffled
}

/** Rule: Vagabond > Setup 3 / Share Quests 9.7.2 — one shared 3 face-up. */
function ensureFaceUpQuests(state: GameState, context: Ctx): void {
  if (state.questsAvailable.length > 0) {
    return
  }
  if (state.questDeck.length === 0) {
    state.questDeck = shuffleWithRng([...QUEST_DECK], context.rng)
  }
  while (
    state.questsAvailable.length < FACE_UP_QUEST_COUNT &&
    state.questDeck.length > 0
  ) {
    const nextQuest = state.questDeck.pop()
    if (nextQuest === undefined) {
      break
    }
    state.questsAvailable.push(nextQuest)
  }
}

const STEPS: Record<Phase, Step[]> = {
  birdsong: ['refresh', 'slip'],
  daylight: ['actions'],
  evening: ['rest', 'draw', 'discard', 'capacity'],
}

export class Vagabond extends Faction {
  readonly id = 'vagabond' as const
  readonly steps = STEPS

  setup(state: GameState, seat: Seat, context: Ctx): void {
    // Rule: Vagabond > Setup 2, 5, 6 — pawn in forest; Thief items; relationships Indifferent.
    const board = boardOf(state, seat)
    board.forest = FALL.vagabondForest
    for (const type of THIEF_START_ITEMS) {
      placeItemInSatchelOrTrack(board, type)
    }
    // Rule: Vagabond > Setup 3 — shuffle quests; draw 3 face up (shared).
    ensureFaceUpQuests(state, context)
  }

  autoActions(state: GameState, phase: Phase, step: Step): Action[] {
    if (phase === 'birdsong' && step === 'refresh' && !state.turnScratch.birdsongWoodDone) {
      return [{ type: 'refresh' }]
    }
    if (phase === 'evening' && step === 'draw' && !state.turnScratch.eveningDrawDone) {
      return [{ type: 'eveningDraw' }]
    }
    if (phase === 'evening' && step === 'rest') {
      const board = boardOf(state, state.currentSeat)
      if (board.forest !== null && board.damaged.length > 0) {
        return [{ type: 'rest' }]
      }
    }
    return []
  }

  legalActions(state: GameState, ctx: Ctx): ActionSpec[] {
    const seat = state.currentSeat
    const board = boardOf(state, seat)
    const specs: ActionSpec[] = [...ctx.grantedActions()]

    if (state.phase === 'birdsong' && state.step === 'refresh') {
      if (!state.turnScratch.birdsongWoodDone) {
        specs.push({ type: 'refresh', actor: seat })
      }
      specs.push({ type: 'endPhase', actor: seat })
      return specs
    }

    if (state.phase === 'birdsong' && state.step === 'slip') {
      if (!state.turnScratch.slipDone) {
        const slip = slipDestinations(state, seat, board)
        if (slip.clearings.length > 0 || slip.forests.length > 0) {
          specs.push({
            type: 'slip',
            actor: seat,
            params: {
              clearings: slip.clearings,
              forests: slip.forests,
            },
          })
        }
      }
      specs.push({ type: 'endPhase', actor: seat })
      return specs
    }

    if (state.phase === 'daylight' && state.step === 'actions') {
      pushDaylightActions(state, seat, board, specs)
      specs.push({ type: 'endPhase', actor: seat })
      return specs
    }

    if (state.phase === 'evening' && state.step === 'rest') {
      // Rule: Evening Rest — optional; only meaningful with damaged items in forest.
      if (board.forest !== null && board.damaged.length > 0) {
        specs.push({ type: 'rest', actor: seat })
      }
      specs.push({ type: 'endPhase', actor: seat })
      return specs
    }

    if (state.phase === 'evening' && state.step === 'draw') {
      if (!state.turnScratch.eveningDrawDone) {
        specs.push({ type: 'eveningDraw', actor: seat })
        return specs
      }
      specs.push({ type: 'endPhase', actor: seat })
      return specs
    }

    if (state.phase === 'evening' && state.step === 'discard') {
      const hand = playerOf(state, seat).hand
      specs.push(
        hand.length > 5
          ? {
              type: 'discard',
              actor: seat,
              params: { cardIds: hand.map((card) => card.id) },
            }
          : { type: 'endPhase', actor: seat },
      )
      return specs
    }

    if (state.phase === 'evening' && state.step === 'capacity') {
      specs.push({ type: 'endPhase', actor: seat })
      return specs
    }

    return specs
  }

  validate(state: GameState, action: Action, _ctx: Ctx): void {
    if (action.type === 'discard') {
      validateDiscard(state, state.currentSeat, action.cardIds)
    }
    if (action.type === 'endPhase' && state.phase === 'evening' && state.step === 'discard') {
      validateHandLimit(state, state.currentSeat)
    }
  }

  apply(state: GameState, action: Action, ctx: Ctx): LogEntry[] {
    const seat = state.currentSeat
    const board = boardOf(state, seat)
    const logs: LogEntry[] = []

    switch (action.type) {
      case 'endPhase': {
        if (state.phase === 'evening' && state.step === 'capacity') {
          enforceCapacity(board)
        }
        return []
      }
      case 'refresh': {
        state.turnScratch.birdsongWoodDone = true
        const count = 3 + 2 * faceUpTeaCount(board)
        refreshItems(board, count)
        return [{ t: 'action', actor: seat, action: { type: 'refresh' } }]
      }
      case 'slip': {
        state.turnScratch.slipDone = true
        movePawn(state, seat, action.to)
        return [{ t: 'action', actor: seat, action }]
      }
      case 'vbMove': {
        if (exhaustItem(board, 'boot') === null) throw new RuleError('NO_BOOT')
        if (destinationHasHostile(state, seat, action.to)) {
          if (exhaustItem(board, 'boot') === null) {
            throw new RuleError('NO_BOOT_HOSTILE')
          }
        }
        const origin = pawnClearing(state, seat)
        if (origin === null && board.forest === null) {
          throw new RuleError('PAWN_MISSING')
        }
        movePawn(state, seat, action.to)
        if (
          action.allySeat !== undefined &&
          action.allyCount !== undefined &&
          action.allyCount > 0
        ) {
          if (origin === null) throw new RuleError('ALLY_MOVE_FROM_FOREST')
          if (!isAlliedWith(board, action.allySeat, state)) {
            throw new RuleError('NOT_ALLIED', { seat: action.allySeat })
          }
          if (warriors(state, origin, action.allySeat) < action.allyCount) {
            throw new RuleError('NOT_ENOUGH_ALLY_WARRIORS')
          }
          logs.push(
            ...moveWarriors(
              state,
              {
                seat: action.allySeat,
                from: origin,
                to: action.to,
                count: action.allyCount,
              },
              ctx,
            ),
          )
        }
        logs.push({ t: 'action', actor: seat, action })
        return logs
      }
      case 'vbBattle': {
        if (exhaustItem(board, 'sword') === null) throw new RuleError('NO_SWORD')
        const clearing = pawnClearing(state, seat)
        if (clearing === null) throw new RuleError('PAWN_IN_FOREST')
        if (action.alliedSeat !== undefined) {
          if (!isAlliedWith(board, action.alliedSeat, state)) {
            throw new RuleError('NOT_ALLIED', { seat: action.alliedSeat })
          }
          if (action.alliedSeat === action.defender) {
            throw new RuleError('CANNOT_ALLY_SAME_DEFENDER')
          }
          if (warriors(state, clearing, action.alliedSeat) < 1) {
            throw new RuleError('NO_ALLY_WARRIORS')
          }
        }
        return openBattle(
          state,
          {
            clearing,
            attacker: seat,
            defender: action.defender,
            ...(action.alliedSeat !== undefined
              ? { alliedSeat: action.alliedSeat }
              : {}),
          },
          ctx,
        )
      }
      case 'vbRearrange': {
        // Rule: 9.2.5.III — face-up undamaged T/X/B between track and satchel.
        if (action.from === 'track') {
          const track = board.tracks[action.itemType]
          const index = track.findIndex((item) => !item.exhausted)
          if (index < 0) throw new RuleError('NO_TRACK_ITEM')
          const [item] = track.splice(index, 1)
          if (item === undefined) throw new RuleError('NO_TRACK_ITEM')
          board.satchel.push(item)
        } else {
          const index = board.satchel.findIndex(
            (item) => item.type === action.itemType && !item.exhausted,
          )
          if (index < 0) throw new RuleError('NO_SATCHEL_ITEM')
          if (board.tracks[action.itemType].length >= VAGABOND_TRACK_ITEM_CAP) {
            throw new RuleError('TRACK_FULL')
          }
          const [item] = board.satchel.splice(index, 1)
          if (item === undefined) throw new RuleError('NO_SATCHEL_ITEM')
          board.tracks[action.itemType].push(item)
        }
        return [{ t: 'action', actor: seat, action }]
      }
      case 'explore': {
        if (exhaustItem(board, 'torch') === null) throw new RuleError('NO_TORCH')
        const clearing = pawnClearing(state, seat)
        if (clearing === null) throw new RuleError('PAWN_IN_FOREST')
        const ruin = state.clearings[clearing]?.ruin
        if (ruin === undefined || ruin.items.length === 0) {
          throw new RuleError('NO_RUIN_ITEMS')
        }
        const item = ruin.items.pop()!
        placeItemInSatchelOrTrack(board, item)
        const exploreDelta = addVictoryPoints(state, seat, 1)
        if (exploreDelta > 0) {
          logs.push({ t: 'vp', actor: seat, delta: exploreDelta, reason: 'explore' })
        }
        if (ruin.items.length === 0) {
          delete state.clearings[clearing]!.ruin
        }
        logs.push({ t: 'action', actor: seat, action: { type: 'explore' } })
        return logs
      }
      case 'quest': {
        const clearing = pawnClearing(state, seat)
        if (clearing === null) throw new RuleError('PAWN_IN_FOREST')
        const questIndex = state.questsAvailable.findIndex(
          (quest) => quest.id === action.questId,
        )
        if (questIndex < 0) throw new RuleError('QUEST_NOT_AVAILABLE')
        const quest = state.questsAvailable[questIndex]!
        const definition = questDefOf(quest)
        if (definition.suit !== FALL.clearings[clearing]!.suit) {
          throw new RuleError('QUEST_SUIT_MISMATCH')
        }
        for (const itemType of definition.items) {
          if (exhaustItem(board, itemType) === null) {
            throw new RuleError('NO_QUEST_ITEM', { item: itemType })
          }
        }
        state.questsAvailable = state.questsAvailable.filter(
          (_, index) => index !== questIndex,
        )
        board.completedQuests.push(quest)
        const replacement = state.questDeck.pop()
        if (replacement !== undefined) {
          state.questsAvailable.push(replacement)
        }
        if (action.reward === 'vp') {
          const matchingCompleted = board.completedQuests.filter(
            (completed) => questDefOf(completed).suit === definition.suit,
          ).length
          const questDelta = addVictoryPoints(state, seat, matchingCompleted)
          if (questDelta > 0) {
            logs.push({
              t: 'vp',
              actor: seat,
              delta: questDelta,
              reason: 'quest',
            })
          }
        } else {
          drawCards(state, { seat, count: 2 }, ctx)
        }
        logs.push({ t: 'action', actor: seat, action })
        return logs
      }
      case 'aid': {
        if (!exhaustAnyItem(board)) throw new RuleError('NO_ITEM')
        const hand = playerOf(state, seat).hand
        const index = hand.findIndex((card) => card.id === action.cardId)
        if (index < 0) throw new RuleError('CARD_NOT_IN_HAND')
        const [card] = hand.splice(index, 1)
        if (card === undefined) throw new RuleError('CARD_NOT_IN_HAND')
        playerOf(state, action.target).hand.push(card)
        improveRelationship(state, seat, action.target, ctx, logs)
        if (action.takeItem !== undefined) {
          const target = playerOf(state, action.target)
          const craftedIndex = target.craftedItems.findIndex(
            (item) => item.type === action.takeItem,
          )
          if (craftedIndex >= 0) {
            target.craftedItems.splice(craftedIndex, 1)
            placeItemInSatchelOrTrack(board, action.takeItem)
          }
        }
        logs.push({ t: 'action', actor: seat, action })
        return logs
      }
      case 'strike': {
        if (exhaustItem(board, 'crossbow') === null) {
          throw new RuleError('NO_CROSSBOW')
        }
        const clearing = pawnClearing(state, seat)
        if (clearing === null) throw new RuleError('PAWN_IN_FOREST')
        const pieces = state.clearings[clearing]!.pieces.filter(
          (piece) => piece.owner === action.defender && piece.kind !== 'pawn',
        )
        const warrior = pieces.find((piece) => piece.kind === 'warrior')
        const target = warrior ?? pieces[0]
        if (target === undefined) throw new RuleError('NO_STRIKE_TARGET')
        logs.push(
          ...removePieces(
            state,
            {
              clearing,
              pieceIds: [target.id],
              scorer: seat,
            },
            ctx,
          ),
        )
        maybeHostile(
          state,
          seat,
          action.defender,
          target.kind === 'warrior',
          ctx,
          logs,
        )
        logs.push({ t: 'action', actor: seat, action })
        return logs
      }
      case 'repair': {
        if (exhaustItem(board, 'hammer') === null) throw new RuleError('NO_HAMMER')
        const item = board.damaged[action.itemIndex]
        if (item === undefined) throw new RuleError('NO_DAMAGED_ITEM')
        board.damaged = board.damaged.filter((_, index) => index !== action.itemIndex)
        restoreRepairedItem(board, item)
        return [{ t: 'action', actor: seat, action }]
      }
      case 'vbCraft': {
        return craftWithHammers(state, seat, action.cardId, ctx)
      }
      case 'steal': {
        if (exhaustItem(board, 'torch') === null) throw new RuleError('NO_TORCH')
        const targetHand = playerOf(state, action.target).hand
        if (targetHand.length === 0) throw new RuleError('EMPTY_HAND')
        const index = randomIndex(ctx.rng, targetHand.length)
        const [stolen] = targetHand.splice(index, 1)
        if (stolen === undefined) throw new RuleError('EMPTY_HAND')
        playerOf(state, seat).hand.push(stolen)
        return [{ t: 'action', actor: seat, action }]
      }
      case 'rest': {
        while (board.damaged.length > 0) {
          const item = board.damaged.pop()!
          placeItemInSatchelOrTrack(board, item.type)
        }
        return [{ t: 'action', actor: seat, action: { type: 'rest' } }]
      }
      case 'eveningDraw': {
        state.turnScratch.eveningDrawDone = true
        const count = 1 + faceUpCoinCount(board)
        drawCards(state, { seat, count }, ctx)
        return [{ t: 'action', actor: seat, action: { type: 'eveningDraw' } }]
      }
      case 'discard':
        validateDiscard(state, seat, action.cardIds)
        applyDiscard(state, seat, action.cardIds)
        return [{ t: 'action', actor: seat, action }]
      default:
        throw new RuleError('UNSUPPORTED_ACTION', { type: action.type })
    }
  }

  endTurn(state: GameState): void {
    state.turnScratch = createTurnScratch()
  }
}

export const VAGABOND = new Vagabond()
