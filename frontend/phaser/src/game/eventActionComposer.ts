import type { ActionSpec } from '../api/client.ts'
import {
  readChoiceParams,
  type ActionComposerHooks,
  type ClientAction,
  type ComposerOutcome,
} from './ActionComposer.ts'

type EventDraft =
  | { type: 'idle' }
  | { type: 'pickCard'; cardIds: string[]; kind: 'fieldHospital' | 'battle' }
  | { type: 'pickOrder'; orders: number[][] }
  | { type: 'pickEffect' }
  | { type: 'pickPieces'; pieceIds: string[] }

/**
 * Pending resolveEvent composers (Field Hospitals + battle stages).
 */
export function createEventComposerHooks(): {
  hooks: ActionComposerHooks
  getDraft: () => EventDraft
  getPromptOptions: () => Array<{ label: string; value: string }>
  getOverlayKind: () => 'fieldHospital' | 'battle' | null
} {
  let draft: EventDraft = { type: 'idle' }
  let promptOptions: Array<{ label: string; value: string }> = []
  let overlayKind: 'fieldHospital' | 'battle' | null = null

  const clear = (): void => {
    draft = { type: 'idle' }
    promptOptions = []
    overlayKind = null
  }

  const hooks: ActionComposerHooks = {
    begin: (spec: ActionSpec): ComposerOutcome | null => {
      if (spec.type !== 'resolveEvent') {
        clear()
        return null
      }

      const params = readChoiceParams(spec)

      if (params.decline !== undefined && params.cardIds === undefined) {
        overlayKind = 'fieldHospital'
        const action: ClientAction = { type: 'resolveEvent', decline: true }
        clear()
        return { kind: 'ready', action }
      }

      if (params.cardIds !== undefined) {
        const kind =
          params.cardIds.length === 1 && params.decline === undefined
            ? 'battle'
            : 'fieldHospital'
        overlayKind = kind
        if (params.cardIds.length === 1) {
          const cardId = params.cardIds[0]
          if (cardId === undefined) {
            return null
          }
          clear()
          return {
            kind: 'ready',
            action: { type: 'resolveEvent', cardId },
          }
        }
        draft = { type: 'pickCard', cardIds: params.cardIds, kind }
        return {
          kind: 'incomplete',
          prompt: {
            message:
              kind === 'fieldHospital'
                ? 'Field Hospitals — pick matching card'
                : 'Pick ambush card',
            highlightClearings: [],
            enabledCardIds: params.cardIds,
            canConfirm: false,
            canCancel: true,
          },
        }
      }

      if (params.useEffect !== undefined) {
        overlayKind = 'battle'
        draft = { type: 'pickEffect' }
        promptOptions = params.useEffect.map((value) => ({
          label: value ? 'Use effect' : 'Skip effect',
          value: value ? 'true' : 'false',
        }))
        return {
          kind: 'incomplete',
          prompt: {
            message: 'Battle card effect?',
            highlightClearings: [],
            enabledCardIds: null,
            canConfirm: false,
            canCancel: true,
          },
        }
      }

      if (params.order !== undefined) {
        overlayKind = 'battle'
        draft = { type: 'pickOrder', orders: params.order }
        promptOptions = params.order.map((order, index) => ({
          label: order.map(String).join('→'),
          value: String(index),
        }))
        return {
          kind: 'incomplete',
          prompt: {
            message: 'Choose effects order',
            highlightClearings: [],
            enabledCardIds: null,
            canConfirm: false,
            canCancel: true,
          },
        }
      }

      if (params.pieceIds !== undefined) {
        overlayKind = 'battle'
        draft = { type: 'pickPieces', pieceIds: params.pieceIds }
        promptOptions = params.pieceIds.map((pieceId) => ({
          label: pieceId.slice(0, 10),
          value: pieceId,
        }))
        return {
          kind: 'incomplete',
          prompt: {
            message: 'Choose piece to remove',
            highlightClearings: [],
            enabledCardIds: null,
            canConfirm: false,
            canCancel: true,
          },
        }
      }

      return null
    },

    chooseCard: (cardId: string): ComposerOutcome | null => {
      if (draft.type !== 'pickCard' || !draft.cardIds.includes(cardId)) {
        return null
      }
      clear()
      return { kind: 'ready', action: { type: 'resolveEvent', cardId } }
    },

    chooseColumn: (value: string): ComposerOutcome | null => {
      if (draft.type === 'pickEffect') {
        clear()
        return {
          kind: 'ready',
          action: { type: 'resolveEvent', useEffect: value === 'true' },
        }
      }
      if (draft.type === 'pickOrder') {
        const index = Number(value)
        const order = draft.orders[index]
        if (order === undefined) {
          return null
        }
        clear()
        return { kind: 'ready', action: { type: 'resolveEvent', order } }
      }
      if (draft.type === 'pickPieces') {
        if (!draft.pieceIds.includes(value)) {
          return null
        }
        clear()
        return {
          kind: 'ready',
          action: { type: 'resolveEvent', pieceIds: [value] },
        }
      }
      return null
    },

    cancel: (): ComposerOutcome | null => {
      if (draft.type === 'idle' && overlayKind === null) {
        return null
      }
      clear()
      return { kind: 'idle' }
    },
  }

  return {
    hooks,
    getDraft: () => draft,
    getPromptOptions: () => promptOptions,
    getOverlayKind: () => overlayKind,
  }
}
