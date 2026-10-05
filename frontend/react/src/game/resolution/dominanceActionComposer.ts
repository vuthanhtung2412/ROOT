import type { ActionSpec } from '#api/client.ts'
import {
  type ActionComposerHooks,
  type ComposerOutcome,
  readChoiceParams,
} from '#game/resolution/ActionComposer.ts'

type DominanceDraft =
  | { type: 'idle' }
  | { type: 'takeDominance'; cardIds: string[] }
  | {
      type: 'activateDominance'
      cardIds: string[]
      targets: number[]
      cardId?: string
    }

/** Daylight take/activate dominance choice flows. */
export function createDominanceComposerHooks(): {
  hooks: ActionComposerHooks
  getDraft: () => DominanceDraft
  getPromptOptions: () => Array<{ label: string; value: string }>
} {
  let draft: DominanceDraft = { type: 'idle' }
  let promptOptions: Array<{ label: string; value: string }> = []

  const hooks: ActionComposerHooks = {
    begin: (spec: ActionSpec): ComposerOutcome | null => {
      promptOptions = []
      const params = readChoiceParams(spec)
      if (spec.type === 'takeDominance') {
        const cardIds = params.cardIds ?? []
        draft = { type: 'takeDominance', cardIds }
        if (cardIds.length === 1) {
          draft = { type: 'idle' }
          return {
            kind: 'ready',
            action: { type: 'takeDominance', cardId: cardIds[0]! },
          }
        }
        return {
          kind: 'incomplete',
          prompt: {
            message: 'Take dominance — spend matching card',
            highlightClearings: [],
            enabledCardIds: cardIds,
            canConfirm: false,
            canCancel: true,
          },
        }
      }
      if (spec.type === 'activateDominance') {
        const cardIds = params.cardIds ?? []
        const targets = params.defender ?? []
        draft = { type: 'activateDominance', cardIds, targets }
        if (cardIds.length === 1 && targets.length === 0) {
          draft = { type: 'idle' }
          return {
            kind: 'ready',
            action: { type: 'activateDominance', cardId: cardIds[0]! },
          }
        }
        if (cardIds.length === 1 && targets.length === 1) {
          draft = { type: 'idle' }
          return {
            kind: 'ready',
            action: {
              type: 'activateDominance',
              cardId: cardIds[0]!,
              coalitionTarget: targets[0]!,
            },
          }
        }
        if (cardIds.length === 1) {
          draft = {
            type: 'activateDominance',
            cardIds,
            targets,
            cardId: cardIds[0]!,
          }
          promptOptions = targets.map((seat) => ({
            label: `coalition seat ${String(seat)}`,
            value: String(seat),
          }))
          return {
            kind: 'incomplete',
            prompt: {
              message: 'Activate — pick coalition partner',
              highlightClearings: [],
              enabledCardIds: null,
              canConfirm: false,
              canCancel: true,
            },
          }
        }
        return {
          kind: 'incomplete',
          prompt: {
            message: 'Activate dominance — pick card',
            highlightClearings: [],
            enabledCardIds: cardIds,
            canConfirm: false,
            canCancel: true,
          },
        }
      }
      draft = { type: 'idle' }
      return null
    },

    chooseCard: (cardId: string): ComposerOutcome | null => {
      if (draft.type === 'takeDominance' && draft.cardIds.includes(cardId)) {
        draft = { type: 'idle' }
        promptOptions = []
        return {
          kind: 'ready',
          action: { type: 'takeDominance', cardId },
        }
      }
      if (
        draft.type === 'activateDominance' &&
        draft.cardIds.includes(cardId)
      ) {
        if (draft.targets.length === 0) {
          draft = { type: 'idle' }
          promptOptions = []
          return {
            kind: 'ready',
            action: { type: 'activateDominance', cardId },
          }
        }
        if (draft.targets.length === 1) {
          const outcome: ComposerOutcome = {
            kind: 'ready',
            action: {
              type: 'activateDominance',
              cardId,
              coalitionTarget: draft.targets[0]!,
            },
          }
          draft = { type: 'idle' }
          promptOptions = []
          return outcome
        }
        draft = {
          type: 'activateDominance',
          cardIds: draft.cardIds,
          targets: draft.targets,
          cardId,
        }
        promptOptions = draft.targets.map((seat) => ({
          label: `coalition seat ${String(seat)}`,
          value: String(seat),
        }))
        return {
          kind: 'incomplete',
          prompt: {
            message: 'Activate — pick coalition partner',
            highlightClearings: [],
            enabledCardIds: null,
            canConfirm: false,
            canCancel: true,
          },
        }
      }
      return null
    },

    chooseColumn: (column: string): ComposerOutcome | null => {
      if (draft.type !== 'activateDominance' || draft.cardId === undefined) {
        return null
      }
      const seat = Number(column)
      if (!Number.isInteger(seat) || !draft.targets.includes(seat)) {
        return null
      }
      const cardId = draft.cardId
      draft = { type: 'idle' }
      promptOptions = []
      return {
        kind: 'ready',
        action: {
          type: 'activateDominance',
          cardId,
          coalitionTarget: seat,
        },
      }
    },

    cancel: (): ComposerOutcome | null => {
      draft = { type: 'idle' }
      promptOptions = []
      return { kind: 'idle' }
    },
  }

  return {
    hooks,
    getDraft: (): DominanceDraft => draft,
    getPromptOptions: () => promptOptions,
  }
}
