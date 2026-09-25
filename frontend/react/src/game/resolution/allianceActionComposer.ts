import type { ActionSpec } from '#api/client.ts'
import {
  readChoiceParams,
  type ActionComposerHooks,
  type ComposerOutcome,
} from '#game/resolution/ActionComposer.ts'

type AllianceDraft =
  | { type: 'idle' }
  | { type: 'revolt'; clearings: number[] }
  | {
      type: 'spreadSympathy'
      clearings: number[]
      supporterIds: string[]
    }
  | { type: 'mobilize'; cardIds: string[] }
  | { type: 'train'; cardIds: string[] }
  | {
      type: 'militaryOp'
      ops: Array<'move' | 'battle' | 'recruit' | 'organize'>
      moves: Array<{ from: number; to: number; count: number }>
      targets: Array<{ clearing: number; defender: number }>
      clearings: number[]
      op: 'move' | 'battle' | 'recruit' | 'organize' | null
    }

function unique(values: number[]): number[] {
  return [...new Set(values)]
}

/** Alliance birdsong/daylight/evening choice flows. */
export function createAllianceComposerHooks(): {
  hooks: ActionComposerHooks
  getDraft: () => AllianceDraft
  getPromptOptions: () => Array<{ label: string; value: string }>
} {
  let draft: AllianceDraft = { type: 'idle' }
  let promptOptions: Array<{ label: string; value: string }> = []

  const hooks: ActionComposerHooks = {
    begin: (spec: ActionSpec): ComposerOutcome | null => {
      promptOptions = []
      const params = readChoiceParams(spec)
      if (spec.type === 'revolt') {
        const clearings = params.clearings ?? []
        if (clearings.length === 1) {
          return {
            kind: 'ready',
            action: { type: 'revolt', clearing: clearings[0]! },
          }
        }
        draft = { type: 'revolt', clearings }
        return {
          kind: 'incomplete',
          prompt: {
            message: 'Revolt — pick clearing',
            highlightClearings: clearings,
            enabledCardIds: null,
            canConfirm: false,
            canCancel: true,
          },
        }
      }
      if (spec.type === 'spreadSympathy') {
        const clearings = params.clearings ?? []
        const supporterIds = params.supporterIds ?? []
        if (clearings.length === 1 && supporterIds.length > 0) {
          return {
            kind: 'ready',
            action: {
              type: 'spreadSympathy',
              clearing: clearings[0]!,
              supporterIds,
            },
          }
        }
        draft = { type: 'spreadSympathy', clearings, supporterIds }
        return {
          kind: 'incomplete',
          prompt: {
            message: 'Spread Sympathy — pick clearing',
            highlightClearings: clearings,
            enabledCardIds: null,
            canConfirm: false,
            canCancel: true,
          },
        }
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
      if (draft.type === 'revolt' && draft.clearings.includes(clearingId)) {
        draft = { type: 'idle' }
        return { kind: 'ready', action: { type: 'revolt', clearing: clearingId } }
      }
      if (
        draft.type === 'spreadSympathy' &&
        draft.clearings.includes(clearingId)
      ) {
        const supporterIds = draft.supporterIds
        draft = { type: 'idle' }
        return {
          kind: 'ready',
          action: { type: 'spreadSympathy', clearing: clearingId, supporterIds },
        }
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
        }
        if (draft.op === 'move') {
          const fromMatches = draft.moves.filter((m) => m.from === clearingId)
          if (fromMatches.length > 0 && !('fromPicked' in draft)) {
            return {
              kind: 'incomplete',
              prompt: {
                message: 'Military move — pick destination',
                highlightClearings: unique(fromMatches.map((m) => m.to)),
                enabledCardIds: null,
                canConfirm: false,
                canCancel: true,
              },
            }
          }
        }
      }
      return null
    },

    chooseCard: (cardId: string): ComposerOutcome | null => {
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
      const match = draft.targets.find((t) => t.defender === defenderSeat)
      if (match === undefined) return null
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
