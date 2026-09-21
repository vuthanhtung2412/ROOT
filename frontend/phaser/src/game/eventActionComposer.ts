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
  | { type: 'pickKeep'; clearings: number[] }
  | { type: 'pickLeader'; leaders: string[] }

/**
 * Pending resolveEvent composers (Field Hospitals + battle + setup picks).
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

      if (params.clearing !== undefined) {
        draft = { type: 'pickKeep', clearings: params.clearing }
        return {
          kind: 'incomplete',
          prompt: {
            message: 'Choose keep corner',
            highlightClearings: params.clearing,
            enabledCardIds: null,
            canConfirm: false,
            canCancel: false,
          },
        }
      }

      if (params.leaders !== undefined) {
        draft = { type: 'pickLeader', leaders: params.leaders }
        promptOptions = params.leaders.map((leader) => ({
          label: leader,
          value: leader,
        }))
        return {
          kind: 'incomplete',
          prompt: {
            message: 'Choose Eyrie leader',
            highlightClearings: [],
            enabledCardIds: null,
            canConfirm: false,
            canCancel: false,
          },
        }
      }

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
        if (params.useEffect.length === 1) {
          const only = params.useEffect[0]
          if (only === undefined) {
            return null
          }
          clear()
          return {
            kind: 'ready',
            action: { type: 'resolveEvent', useEffect: only },
          }
        }
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
        clear()
        return {
          kind: 'ready',
          action: { type: 'resolveEvent', pieceIds: params.pieceIds },
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

    chooseClearing: (clearingId: number): ComposerOutcome | null => {
      if (draft.type !== 'pickKeep' || !draft.clearings.includes(clearingId)) {
        return null
      }
      clear()
      return {
        kind: 'ready',
        action: { type: 'resolveEvent', clearing: clearingId },
      }
    },

    chooseColumn: (value: string): ComposerOutcome | null => {
      if (draft.type === 'pickLeader') {
        if (!draft.leaders.includes(value)) {
          return null
        }
        clear()
        return { kind: 'ready', action: { type: 'resolveEvent', leader: value } }
      }
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
      return null
    },

    cancel: (): ComposerOutcome | null => {
      if (draft.type === 'idle' && overlayKind === null) {
        return null
      }
      if (draft.type === 'pickKeep' || draft.type === 'pickLeader') {
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
