import type { ActionSpec } from '../api/client.ts'
import {
  readChoiceParams,
  type ActionComposerHooks,
  type ClientAction,
  type ComposerOutcome,
} from './ActionComposer.ts'

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
      draft = { type: 'idle' }
      return { kind: 'idle' }
    },
  }

  return {
    hooks,
    getDraft: () => draft,
  }
}
