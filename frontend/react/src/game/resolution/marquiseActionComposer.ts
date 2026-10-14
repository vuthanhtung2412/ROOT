import type { ActionSpec } from '#api/client.ts'
import {
  SEAT_VALUE_PREFIX,
  fallbackSeatLabel,
  readChoiceParams,
  type ActionComposerHooks,
  type ClientAction,
  type ComposerOutcome,
  type SeatLabelOptions,
} from '#game/resolution/ActionComposer.ts'
import {
  adjustWoodSelection,
  countClearing,
  finishBuildChoice,
  readMarquiseBuildOption,
  readyBuildAction,
  setWoodCountAtClearing,
  woodSpendPrompt,
  type MarquiseBuildOption,
  type MarquiseBuildWoodDraft,
} from '#game/resolution/marquiseBuildWood.ts'

/** Law Evening: "discard cards of your choice until you have five". */
const HAND_LIMIT = 5

function unique(values: number[]): number[] {
  return [...new Set(values)]
}

/** Exact number of cards to discard; `handCardIds` is the whole hand. */
function requiredDiscardCount(handCardIds: readonly string[]): number {
  return Math.max(0, handCardIds.length - HAND_LIMIT)
}

type OverworkOption = { cardId: string; clearing: number }

type MarquiseCardDraft =
  | { type: 'idle' }
  | {
      type: 'overwork'
      options: OverworkOption[]
      cardId: string | null
    }
  | {
      type: 'discardMany'
      cardIds: string[]
      selected: string[]
    }

function isOverworkOption(value: unknown): value is OverworkOption {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const cardId = Reflect.get(value, 'cardId')
  const clearing = Reflect.get(value, 'clearing')
  return typeof cardId === 'string' && typeof clearing === 'number'
}

/**
 * Marquise card flows: craft / spendBird / discard / overwork (paired).
 * Shared craft/discard paths also usable when Eyrie seat has those specs.
 */
export function createMarquiseCardComposerHooks(): {
  hooks: ActionComposerHooks
  getDraft: () => MarquiseCardDraft
} {
  let draft: MarquiseCardDraft = { type: 'idle' }

  const hooks: ActionComposerHooks = {
    begin: (spec: ActionSpec): ComposerOutcome | null => {
      if (spec.type === 'overwork') {
        const params = readChoiceParams(spec)
        const options = (params.options ?? []).filter(isOverworkOption)
        draft = { type: 'overwork', options, cardId: null }
        return {
          kind: 'incomplete',
          prompt: {
            message: 'Overwork — pick matching card',
            highlightClearings: [],
            enabledCardIds: options.map((option) => option.cardId),
            canConfirm: false,
            canCancel: true,
          },
        }
      }

      if (spec.type === 'discard') {
        const params = readChoiceParams(spec)
        const cardIds = params.cardIds ?? []
        draft = { type: 'discardMany', cardIds, selected: [] }
        return {
          kind: 'incomplete',
          prompt: {
            message: `Discard down to 5 — pick ${String(requiredDiscardCount(cardIds))} card(s), then Confirm`,
            highlightClearings: [],
            enabledCardIds: cardIds,
            canConfirm: false,
            canCancel: true,
          },
        }
      }

      // craft / spendBird fall through to ActionComposer core
      draft = { type: 'idle' }
      return null
    },

    chooseCard: (cardId: string): ComposerOutcome | null => {
      if (draft.type === 'overwork') {
        const matches = draft.options.filter((option) => option.cardId === cardId)
        if (matches.length === 0) {
          return null
        }
        draft = { ...draft, cardId }
        return {
          kind: 'incomplete',
          prompt: {
            message: 'Overwork — pick sawmill clearing',
            highlightClearings: matches.map((option) => option.clearing),
            enabledCardIds: [cardId],
            canConfirm: false,
            canCancel: true,
          },
        }
      }

      if (draft.type === 'discardMany') {
        const required = requiredDiscardCount(draft.cardIds)
        const isSelected = draft.selected.includes(cardId)
        // Law Evening: discard until five — never below.
        const isFull = draft.selected.length >= required
        const selected = isSelected
          ? draft.selected.filter((id) => id !== cardId)
          : isFull
            ? draft.selected
            : [...draft.selected, cardId]
        draft = { ...draft, selected }
        return {
          kind: 'incomplete',
          prompt: {
            message: `Discard ${String(selected.length)}/${String(required)} card(s) — Confirm when ready`,
            highlightClearings: [],
            // Enough picked: the other cards dim; a picked one can be put back.
            enabledCardIds:
              selected.length === required ? selected : draft.cardIds,
            canConfirm: selected.length === required,
            canCancel: true,
          },
        }
      }

      return null
    },

    chooseClearing: (clearingId: number): ComposerOutcome | null => {
      if (draft.type !== 'overwork' || draft.cardId === null) {
        return null
      }
      const selectedCardId = draft.cardId
      const match = draft.options.find(
        (option) =>
          option.cardId === selectedCardId && option.clearing === clearingId,
      )
      if (match === undefined) {
        return null
      }
      const action: ClientAction = {
        type: 'overwork',
        cardId: match.cardId,
        clearing: match.clearing,
      }
      draft = { type: 'idle' }
      return { kind: 'ready', action }
    },

    confirm: (): ComposerOutcome | null => {
      if (
        draft.type !== 'discardMany' ||
        draft.selected.length !== requiredDiscardCount(draft.cardIds)
      ) {
        return null
      }
      const action: ClientAction = {
        type: 'discard',
        cardIds: draft.selected,
      }
      draft = { type: 'idle' }
      return { kind: 'ready', action }
    },

    cancel: (): ComposerOutcome | null => {
      if (draft.type === 'idle') {
        return null
      }
      draft = { type: 'idle' }
      return { kind: 'idle' }
    },
  }

  return {
    hooks,
    getDraft: () => draft,
  }
}

type BattleTarget = { clearing: number; defender: number }

type BoardDraft =
  | { type: 'idle' }
  | {
      type: 'build'
      options: MarquiseBuildOption[]
      clearing: number | null
    }
  | MarquiseBuildWoodDraft
  | {
      type: 'battle'
      targets: BattleTarget[]
      clearing: number | null
    }

/**
 * Marquise board daylight: recruit (immediate), build (paired), battle.
 */
export function createMarquiseBoardComposerHooks(options?: SeatLabelOptions): {
  hooks: ActionComposerHooks
  getDraft: () => BoardDraft
  getPromptOptions: () => Array<{ label: string; value: string }>
} {
  let draft: BoardDraft = { type: 'idle' }
  let promptOptions: Array<{ label: string; value: string }> = []

  const hooks: ActionComposerHooks = {
    begin: (spec: ActionSpec): ComposerOutcome | null => {
      promptOptions = []
      if (spec.type === 'build') {
        const params = readChoiceParams(spec)
        const options = (params.options ?? [])
          .map(readMarquiseBuildOption)
          .filter((option): option is MarquiseBuildOption => option !== null)
        draft = { type: 'build', options, clearing: null }
        return {
          kind: 'incomplete',
          prompt: {
            message: 'Build — pick clearing',
            highlightClearings: unique(options.map((option) => option.clearing)),
            enabledCardIds: null,
            canConfirm: false,
            canCancel: true,
          },
        }
      }
      if (spec.type === 'battle') {
        const params = readChoiceParams(spec)
        const targets = params.targets ?? []
        draft = { type: 'battle', targets, clearing: null }
        return {
          kind: 'incomplete',
          prompt: {
            message: 'Battle — pick clearing',
            highlightClearings: unique(targets.map((target) => target.clearing)),
            enabledCardIds: null,
            canConfirm: false,
            canCancel: true,
          },
        }
      }
      // recruit handled by ImmediateTypes in core
      draft = { type: 'idle' }
      return null
    },

    chooseClearing: (clearingId: number): ComposerOutcome | null => {
      if (draft.type === 'buildWood') {
        if (countClearing(draft.availableWoodClearings, clearingId) < 1) {
          return null
        }
        const selectedWoodClearings = adjustWoodSelection(
          draft.selectedWoodClearings,
          clearingId,
          draft.availableWoodClearings,
          draft.woodCost,
        )
        draft = { ...draft, selectedWoodClearings }
        return woodSpendPrompt(draft)
      }

      if (draft.type === 'build') {
        const matches = draft.options.filter(
          (option) => option.clearing === clearingId,
        )
        if (matches.length === 0) {
          return null
        }
        if (matches.length === 1) {
          const match = matches[0]
          if (match === undefined) {
            return null
          }
          promptOptions = []
          const finished = finishBuildChoice(match)
          draft = finished.draft
          return finished.outcome
        }
        draft = { ...draft, clearing: clearingId }
        promptOptions = matches.map((option) => ({
          label: option.building,
          value: option.building,
        }))
        return {
          kind: 'incomplete',
          prompt: {
            message: 'Build — pick building type',
            highlightClearings: [clearingId],
            enabledCardIds: null,
            canConfirm: false,
            canCancel: true,
          },
        }
      }

      if (draft.type === 'battle') {
        const matches = draft.targets.filter(
          (target) => target.clearing === clearingId,
        )
        if (matches.length === 0) {
          return null
        }
        draft = { ...draft, clearing: clearingId }
        if (matches.length === 1) {
          const match = matches[0]
          if (match === undefined) {
            return null
          }
          draft = { type: 'idle' }
          promptOptions = []
          return {
            kind: 'ready',
            action: {
              type: 'battle',
              clearing: match.clearing,
              defender: match.defender,
            },
          }
        }
        promptOptions = matches.map((target) => ({
          label:
            options?.factionNameForSeat?.(target.defender) ??
            fallbackSeatLabel(target.defender),
          // Prefixed so the banner shows buttons, not a numeric count stepper.
          value: `${SEAT_VALUE_PREFIX}${String(target.defender)}`,
        }))
        return {
          kind: 'incomplete',
          prompt: {
            message: 'Battle — pick defender',
            highlightClearings: [clearingId],
            enabledCardIds: null,
            canConfirm: false,
            canCancel: true,
          },
        }
      }

      return null
    },

    setClearingCount: (
      clearingId: number,
      count: number,
    ): ComposerOutcome | null => {
      if (draft.type !== 'buildWood') {
        return null
      }
      if (countClearing(draft.availableWoodClearings, clearingId) < 1) {
        return null
      }
      const selectedWoodClearings = setWoodCountAtClearing(
        draft.selectedWoodClearings,
        clearingId,
        count,
        draft.availableWoodClearings,
        draft.woodCost,
      )
      draft = { ...draft, selectedWoodClearings }
      return woodSpendPrompt(draft)
    },

    chooseColumn: (buildingOrSeat: string): ComposerOutcome | null => {
      if (draft.type === 'build' && draft.clearing !== null) {
        const clearing = draft.clearing
        const match = draft.options.find(
          (option) =>
            option.clearing === clearing && option.building === buildingOrSeat,
        )
        if (match === undefined) {
          return null
        }
        promptOptions = []
        const finished = finishBuildChoice(match)
        draft = finished.draft
        return finished.outcome
      }

      if (draft.type === 'battle' && draft.clearing !== null) {
        if (!buildingOrSeat.startsWith(SEAT_VALUE_PREFIX)) {
          return null
        }
        const defender = Number(buildingOrSeat.slice(SEAT_VALUE_PREFIX.length))
        if (!Number.isInteger(defender)) {
          return null
        }
        const clearing = draft.clearing
        const match = draft.targets.find(
          (target) =>
            target.clearing === clearing && target.defender === defender,
        )
        if (match === undefined) {
          return null
        }
        draft = { type: 'idle' }
        promptOptions = []
        return {
          kind: 'ready',
          action: {
            type: 'battle',
            clearing: match.clearing,
            defender: match.defender,
          },
        }
      }

      return null
    },

    confirm: (): ComposerOutcome | null => {
      if (
        draft.type !== 'buildWood' ||
        draft.selectedWoodClearings.length !== draft.woodCost
      ) {
        return null
      }
      const action = readyBuildAction({
        clearing: draft.clearing,
        building: draft.building,
        woodClearings: [...draft.selectedWoodClearings],
      })
      draft = { type: 'idle' }
      promptOptions = []
      return action
    },

    cancel: (): ComposerOutcome | null => {
      if (draft.type === 'idle') {
        return null
      }
      draft = { type: 'idle' }
      promptOptions = []
      return { kind: 'idle' }
    },
  }

  return {
    hooks,
    getDraft: () => draft,
    getPromptOptions: () => promptOptions,
  }
}
