import type { ActionSpec } from '#api/client.ts'
import { fallClearingSuit } from '#game/boardLayout.ts'
import {
  fallbackSeatLabel,
  readChoiceParams,
  type ActionComposerHooks,
  type ComposerOutcome,
  type SeatLabelOptions,
} from '#game/resolution/ActionComposer.ts'
import type { CardGalleryFace } from '#ui/cardGalleryTypes.ts'

type SupporterSpendChoice = {
  clearing: number
  supporterIds: string[]
}

type SupporterSpendDraft = {
  type: 'revolt' | 'spreadSympathy'
  allOptions: SupporterSpendChoice[]
  clearing: number | null
  eligibleIds: string[]
  cost: number
  selected: string[]
}

type AllianceDraft =
  | { type: 'idle' }
  | SupporterSpendDraft
  | { type: 'mobilize'; cardIds: string[] }
  | { type: 'train'; cardIds: string[] }
  | {
      type: 'militaryOp'
      ops: Array<'move' | 'battle' | 'recruit' | 'organize'>
      moves: Array<{ from: number; to: number; count: number }>
      targets: Array<{ clearing: number; defender: number }>
      clearings: number[]
      op: 'move' | 'battle' | 'recruit' | 'organize' | null
      moveOrigin: number | null
      moveDestination: number | null
      battleClearing: number | null
    }

export type AllianceSupporterPilePick = {
  title: string
  cards: CardGalleryFace[]
  selectedCardIds: readonly string[]
}

function parseDefIdFromCardId(cardId: string): string | null {
  const hashIndex = cardId.indexOf('#')
  if (hashIndex <= 0) {
    return cardId.length > 0 ? cardId : null
  }
  return cardId.slice(0, hashIndex)
}

export function cardFaceFromId(cardId: string): CardGalleryFace {
  const defId = parseDefIdFromCardId(cardId)
  return { id: cardId, defId: defId ?? cardId }
}

/** e.g. "Choose 1 mouse supporter to discard" / "Choose 2 fox supporters to discard". */
export function formatChooseSupportersToDiscardTitle(
  clearingId: number,
  supporterCount: number,
): string {
  const suit = fallClearingSuit(clearingId) ?? 'matching'
  const noun = supporterCount === 1 ? 'supporter' : 'supporters'
  return `Choose ${String(supporterCount)} ${suit} ${noun} to discard`
}

const DEFENDER_VALUE_PREFIX = 'seat:'

function formatWarriorCountLabel(count: number): string {
  return count === 1 ? '1 warrior' : `${String(count)} warriors`
}

function unique(values: number[]): number[] {
  return [...new Set(values)]
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values)]
}

function isSupporterSpendChoice(value: unknown): value is SupporterSpendChoice {
  if (typeof value !== 'object' || value === null) return false
  const supporterIds: unknown = Reflect.get(value, 'supporterIds')
  return (
    typeof Reflect.get(value, 'clearing') === 'number' &&
    Array.isArray(supporterIds) &&
    supporterIds.every((id) => typeof id === 'string')
  )
}

function eligibleIdsForClearing(
  options: readonly SupporterSpendChoice[],
  clearingId: number,
): { eligibleIds: string[]; cost: number } | null {
  const matches = options.filter((choice) => choice.clearing === clearingId)
  if (matches.length === 0) {
    return null
  }
  const cost = matches[0]!.supporterIds.length
  const eligibleIds = uniqueStrings(
    matches.flatMap((choice) => choice.supporterIds),
  )
  return { eligibleIds, cost }
}

function supporterPickPrompt(
  clearingId: number,
  cost: number,
  selectedCount: number,
): ComposerOutcome {
  const baseMessage = formatChooseSupportersToDiscardTitle(clearingId, cost)
  const message =
    selectedCount === cost
      ? `${baseMessage} — Confirm when ready`
      : baseMessage
  return {
    kind: 'incomplete',
    prompt: {
      message,
      highlightClearings: [clearingId],
      enabledCardIds: null,
      canConfirm: selectedCount === cost,
      canCancel: true,
    },
  }
}

function beginSupporterSpendAtClearing(
  actionType: 'revolt' | 'spreadSympathy',
  allOptions: SupporterSpendChoice[],
  clearingId: number,
): { draft: SupporterSpendDraft; outcome: ComposerOutcome } | null {
  const eligible = eligibleIdsForClearing(allOptions, clearingId)
  if (eligible === null) {
    return null
  }
  const draft: SupporterSpendDraft = {
    type: actionType,
    allOptions,
    clearing: clearingId,
    eligibleIds: eligible.eligibleIds,
    cost: eligible.cost,
    selected: [],
  }
  return {
    draft,
    outcome: supporterPickPrompt(clearingId, eligible.cost, 0),
  }
}

function beginSupporterSpendPick(
  actionType: 'revolt' | 'spreadSympathy',
  options: SupporterSpendChoice[],
): { draft: AllianceDraft; outcome: ComposerOutcome } {
  const clearings = unique(options.map((choice) => choice.clearing))
  if (clearings.length === 1) {
    const started = beginSupporterSpendAtClearing(
      actionType,
      options,
      clearings[0]!,
    )
    if (started !== null) {
      return started
    }
  }
  return {
    draft: {
      type: actionType,
      allOptions: options,
      clearing: null,
      eligibleIds: [],
      cost: 0,
      selected: [],
    },
    outcome: {
      kind: 'incomplete',
      prompt: {
        message:
          actionType === 'revolt'
            ? 'Revolt — pick clearing'
            : 'Spread Sympathy — pick clearing',
        highlightClearings: clearings,
        enabledCardIds: null,
        canConfirm: false,
        canCancel: true,
      },
    },
  }
}

function isSupporterSpendDraft(
  draft: AllianceDraft,
): draft is SupporterSpendDraft {
  return draft.type === 'revolt' || draft.type === 'spreadSympathy'
}

/** Alliance birdsong/daylight/evening choice flows. */
export function createAllianceComposerHooks(
  options?: SeatLabelOptions,
): {
  hooks: ActionComposerHooks
  getDraft: () => AllianceDraft
  getPromptOptions: () => Array<{ label: string; value: string }>
  getSupporterPilePick: () => AllianceSupporterPilePick | null
} {
  let draft: AllianceDraft = { type: 'idle' }
  let promptOptions: Array<{ label: string; value: string }> = []

  const hooks: ActionComposerHooks = {
    begin: (spec: ActionSpec): ComposerOutcome | null => {
      promptOptions = []
      const params = readChoiceParams(spec)
      if (spec.type === 'revolt' || spec.type === 'spreadSympathy') {
        const rawOptions = params.options ?? []
        const options = rawOptions.filter(isSupporterSpendChoice)
        if (options.length === 0) {
          draft = { type: 'idle' }
          return null
        }
        const started = beginSupporterSpendPick(spec.type, options)
        draft = started.draft
        return started.outcome
      }
      if (spec.type === 'mobilize' || spec.type === 'train') {
        const cardIds = params.cardIds ?? []
        draft = { type: spec.type, cardIds }
        return {
          kind: 'incomplete',
          prompt: {
            message: `${spec.type === 'mobilize' ? 'Mobilize' : 'Train'} — pick card`,
            highlightClearings: [],
            enabledCardIds: cardIds,
            canConfirm: false,
            canCancel: true,
          },
        }
      }
      if (spec.type === 'militaryOp') {
        const ops = params.op ?? []
        draft = {
          type: 'militaryOp',
          ops,
          moves: params.moves ?? [],
          targets: params.targets ?? [],
          clearings: params.clearings ?? [],
          op: ops.length === 1 ? ops[0]! : null,
          moveOrigin: null,
          moveDestination: null,
          battleClearing: null,
        }
        if (ops.length === 1) {
          return beginMilitaryOpChoice(draft)
        }
        promptOptions = ops.map((op) => ({ label: op, value: op }))
        return {
          kind: 'incomplete',
          prompt: {
            message: 'Military op — pick type',
            highlightClearings: [],
            enabledCardIds: null,
            canConfirm: false,
            canCancel: true,
          },
        }
      }
      draft = { type: 'idle' }
      return null
    },

    chooseClearing: (clearingId: number): ComposerOutcome | null => {
      if (isSupporterSpendDraft(draft) && draft.clearing === null) {
        const started = beginSupporterSpendAtClearing(
          draft.type,
          draft.allOptions,
          clearingId,
        )
        if (started === null) {
          return null
        }
        draft = started.draft
        return started.outcome
      }
      if (draft.type === 'militaryOp' && draft.op !== null) {
        if (draft.op === 'recruit' || draft.op === 'organize') {
          if (!draft.clearings.includes(clearingId)) return null
          const op = draft.op
          draft = { type: 'idle' }
          return { kind: 'ready', action: { type: 'militaryOp', op, clearing: clearingId } }
        }
        if (draft.op === 'battle') {
          const matches = draft.targets.filter((t) => t.clearing === clearingId)
          if (matches.length === 0) return null
          if (matches.length === 1) {
            const match = matches[0]!
            draft = { type: 'idle' }
            return {
              kind: 'ready',
              action: {
                type: 'militaryOp',
                op: 'battle',
                clearing: match.clearing,
                defender: match.defender,
              },
            }
          }
          // Rule: 4.3 Battle — attacker chooses which enemy in the clearing defends.
          draft = { ...draft, battleClearing: clearingId }
          promptOptions = matches.map((match) => ({
            label:
              options?.factionNameForSeat?.(match.defender) ??
              fallbackSeatLabel(match.defender),
            // Prefixed so the banner shows buttons, not a numeric count stepper.
            value: `${DEFENDER_VALUE_PREFIX}${String(match.defender)}`,
          }))
          return {
            kind: 'incomplete',
            prompt: {
              message: 'Military battle — pick defender',
              highlightClearings: [clearingId],
              enabledCardIds: null,
              canConfirm: false,
              canCancel: true,
            },
          }
        }
        if (draft.op === 'move') {
          if (draft.moveOrigin === null) {
            const originMoves = draft.moves.filter(
              (move) => move.from === clearingId,
            )
            if (originMoves.length === 0) return null
            draft = { ...draft, moveOrigin: clearingId }
            return {
              kind: 'incomplete',
              prompt: {
                message: 'Military move — pick destination',
                highlightClearings: unique(originMoves.map((move) => move.to)),
                enabledCardIds: null,
                canConfirm: false,
                canCancel: true,
              },
            }
          }
          const origin = draft.moveOrigin
          const routeMoves = draft.moves.filter(
            (move) => move.from === origin && move.to === clearingId,
          )
          if (routeMoves.length === 0) return null
          if (routeMoves.length === 1) {
            const move = routeMoves[0]!
            draft = { type: 'idle' }
            return {
              kind: 'ready',
              action: {
                type: 'militaryOp',
                op: 'move',
                from: move.from,
                to: move.to,
                count: move.count,
              },
            }
          }
          draft = { ...draft, moveDestination: clearingId }
          promptOptions = routeMoves.map((move) => ({
            label: formatWarriorCountLabel(move.count),
            value: String(move.count),
          }))
          return {
            kind: 'incomplete',
            prompt: {
              message: 'Military move — how many warriors?',
              highlightClearings: [clearingId],
              enabledCardIds: null,
              canConfirm: false,
              canCancel: true,
            },
          }
        }
      }
      return null
    },

    chooseCard: (cardId: string): ComposerOutcome | null => {
      if (isSupporterSpendDraft(draft) && draft.clearing !== null) {
        const clearingId = draft.clearing
        if (!draft.eligibleIds.includes(cardId)) {
          return null
        }
        const alreadySelected = draft.selected.includes(cardId)
        let selected: string[]
        if (alreadySelected) {
          selected = draft.selected.filter((id) => id !== cardId)
        } else if (draft.selected.length >= draft.cost) {
          return null
        } else {
          selected = [...draft.selected, cardId]
        }
        draft = { ...draft, selected }
        return supporterPickPrompt(clearingId, draft.cost, selected.length)
      }
      if (
        (draft.type === 'mobilize' || draft.type === 'train') &&
        draft.cardIds.includes(cardId)
      ) {
        const type = draft.type
        draft = { type: 'idle' }
        return { kind: 'ready', action: { type, cardId } }
      }
      return null
    },

    chooseColumn: (value: string): ComposerOutcome | null => {
      if (draft.type !== 'militaryOp') return null
      if (
        draft.op === 'move' &&
        draft.moveOrigin !== null &&
        draft.moveDestination !== null
      ) {
        const origin = draft.moveOrigin
        const destination = draft.moveDestination
        const move = draft.moves.find(
          (candidate) =>
            candidate.from === origin &&
            candidate.to === destination &&
            String(candidate.count) === value,
        )
        if (move === undefined) return null
        draft = { type: 'idle' }
        promptOptions = []
        return {
          kind: 'ready',
          action: {
            type: 'militaryOp',
            op: 'move',
            from: move.from,
            to: move.to,
            count: move.count,
          },
        }
      }
      if (draft.op === 'battle' && draft.battleClearing !== null) {
        if (!value.startsWith(DEFENDER_VALUE_PREFIX)) return null
        const defenderSeat = Number(value.slice(DEFENDER_VALUE_PREFIX.length))
        if (!Number.isInteger(defenderSeat)) return null
        return hooks.chooseDefender?.(defenderSeat) ?? null
      }
      if (
        value !== 'move' &&
        value !== 'battle' &&
        value !== 'recruit' &&
        value !== 'organize'
      ) {
        return null
      }
      if (!draft.ops.includes(value)) return null
      draft = { ...draft, op: value }
      return beginMilitaryOpChoice(draft)
    },

    chooseDefender: (defenderSeat: number): ComposerOutcome | null => {
      if (draft.type !== 'militaryOp' || draft.op !== 'battle') return null
      const battleClearing = draft.battleClearing
      const match = draft.targets.find(
        (target) =>
          target.defender === defenderSeat &&
          (battleClearing === null || target.clearing === battleClearing),
      )
      if (match === undefined) return null
      draft = { type: 'idle' }
      promptOptions = []
      return {
        kind: 'ready',
        action: {
          type: 'militaryOp',
          op: 'battle',
          clearing: match.clearing,
          defender: match.defender,
        },
      }
    },

    confirm: (): ComposerOutcome | null => {
      if (
        !isSupporterSpendDraft(draft) ||
        draft.clearing === null ||
        draft.selected.length !== draft.cost
      ) {
        return null
      }
      const actionType = draft.type
      const clearing = draft.clearing
      const supporterIds = draft.selected
      draft = { type: 'idle' }
      return {
        kind: 'ready',
        action: {
          type: actionType,
          clearing,
          supporterIds,
        },
      }
    },

    cancel: (): ComposerOutcome | null => {
      draft = { type: 'idle' }
      return { kind: 'idle' }
    },
  }

  return {
    hooks,
    getDraft: (): AllianceDraft => draft,
    getPromptOptions: (): Array<{ label: string; value: string }> => promptOptions,
    getSupporterPilePick: (): AllianceSupporterPilePick | null => {
      if (!isSupporterSpendDraft(draft) || draft.clearing === null) {
        return null
      }
      return {
        title: formatChooseSupportersToDiscardTitle(draft.clearing, draft.cost),
        cards: draft.eligibleIds.map(cardFaceFromId),
        selectedCardIds: draft.selected,
      }
    },
  }
}

function beginMilitaryOpChoice(draft: AllianceDraft): ComposerOutcome {
  if (draft.type !== 'militaryOp' || draft.op === null) {
    return { kind: 'idle' }
  }
  if (draft.op === 'move') {
    if (draft.moves.length === 1) {
      const move = draft.moves[0]!
      return {
        kind: 'ready',
        action: {
          type: 'militaryOp',
          op: 'move',
          from: move.from,
          to: move.to,
          count: move.count,
        },
      }
    }
    return {
      kind: 'incomplete',
      prompt: {
        message: 'Military move — pick origin',
        highlightClearings: unique(draft.moves.map((move) => move.from)),
        enabledCardIds: null,
        canConfirm: false,
        canCancel: true,
      },
    }
  }
  if (draft.op === 'battle') {
    return {
      kind: 'incomplete',
      prompt: {
        message: 'Military battle — pick clearing',
        highlightClearings: unique(draft.targets.map((t) => t.clearing)),
        enabledCardIds: null,
        canConfirm: false,
        canCancel: true,
      },
    }
  }
  return {
    kind: 'incomplete',
    prompt: {
      message: `Military ${draft.op} — pick clearing`,
      highlightClearings: draft.clearings,
      enabledCardIds: null,
      canConfirm: false,
      canCancel: true,
    },
  }
}
