import type { ActionSpec } from '#api/client.ts'
import {
  readChoiceParams,
  type ActionComposerHooks,
  type ClientAction,
  type ComposerOutcome,
} from '#game/resolution/ActionComposer.ts'

function unique(values: number[]): number[] {
  return [...new Set(values)]
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
            message: 'Discard down to 5 — pick cards, then Confirm',
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
        const selected = draft.selected.includes(cardId)
          ? draft.selected.filter((id) => id !== cardId)
          : [...draft.selected, cardId]
        draft = { ...draft, selected }
        return {
          kind: 'incomplete',
          prompt: {
            message: `Discard ${String(selected.length)} card(s) — Confirm when ready`,
            highlightClearings: [],
            enabledCardIds: draft.cardIds,
            canConfirm: selected.length > 0,
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
      if (draft.type !== 'discardMany' || draft.selected.length === 0) {
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

type BuildOption = { clearing: number; building: string }
type BattleTarget = { clearing: number; defender: number }

type BoardDraft =
  | { type: 'idle' }
  | { type: 'build'; options: BuildOption[]; clearing: number | null }
  | {
      type: 'battle'
      targets: BattleTarget[]
      clearing: number | null
    }

function isBuildOption(value: unknown): value is BuildOption {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const clearing = Reflect.get(value, 'clearing')
  const building = Reflect.get(value, 'building')
  return typeof clearing === 'number' && typeof building === 'string'
}

/**
 * Marquise board daylight: recruit (immediate), build (paired), battle.
 */
export function createMarquiseBoardComposerHooks(): {
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
        const options = (params.options ?? []).filter(isBuildOption)
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
          draft = { type: 'idle' }
          promptOptions = []
          return {
            kind: 'ready',
            action: {
              type: 'build',
              clearing: match.clearing,
              building: match.building,
            },
          }
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
          label: `seat ${String(target.defender)}`,
          value: String(target.defender),
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
        draft = { type: 'idle' }
        promptOptions = []
        return {
          kind: 'ready',
          action: {
            type: 'build',
            clearing: match.clearing,
            building: match.building,
          },
        }
      }

      if (draft.type === 'battle' && draft.clearing !== null) {
        const defender = Number(buildingOrSeat)
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
