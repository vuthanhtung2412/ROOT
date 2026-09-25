import type { ActionSpec } from '#api/client.ts'
import {
  type ActionComposerHooks,
  type ComposerOutcome,
  readChoiceParams,
} from '#game/resolution/ActionComposer.ts'

type VagabondDraft =
  | { type: 'idle' }
  | { type: 'slip'; clearings: number[]; forests: number[] }
  | { type: 'vbMove'; clearings: number[] }
  | { type: 'vbBattle'; targets: Array<{ clearing: number; defender: number }> }
  | { type: 'aid'; cardIds: string[]; defenders: number[] }
  | { type: 'strike'; targets: Array<{ clearing: number; defender: number }> }
  | { type: 'repair'; indexes: number[] }
  | { type: 'vbCraft'; cardIds: string[] }
  | { type: 'steal'; defenders: number[] }

function unique(values: number[]): number[] {
  return [...new Set(values)]
}

/** Vagabond daylight / birdsong choice flows. */
export function createVagabondComposerHooks(): {
  hooks: ActionComposerHooks
  getDraft: () => VagabondDraft
} {
  let draft: VagabondDraft = { type: 'idle' }

  const hooks: ActionComposerHooks = {
    begin: (spec: ActionSpec): ComposerOutcome | null => {
      const params = readChoiceParams(spec)
      if (spec.type === 'slip') {
        const clearings = params.clearings ?? []
        const forests = params.forests ?? []
        draft = { type: 'slip', clearings, forests }
        return {
          kind: 'incomplete',
          prompt: {
            message: 'Slip — pick clearing (or forest via options)',
            highlightClearings: clearings,
            enabledCardIds: null,
            canConfirm: forests.length > 0,
            canCancel: true,
          },
        }
      }
      if (spec.type === 'vbMove') {
        const clearings = params.clearings ?? []
        draft = { type: 'vbMove', clearings }
        return {
          kind: 'incomplete',
          prompt: {
            message: 'Move — pick clearing',
            highlightClearings: clearings,
            enabledCardIds: null,
            canConfirm: false,
            canCancel: true,
          },
        }
      }
      if (spec.type === 'vbBattle' || spec.type === 'strike') {
        const targets = params.targets ?? []
        draft = {
          type: spec.type === 'vbBattle' ? 'vbBattle' : 'strike',
          targets,
        }
        return {
          kind: 'incomplete',
          prompt: {
            message: `${spec.type === 'vbBattle' ? 'Battle' : 'Strike'} — pick clearing`,
            highlightClearings: unique(targets.map((target) => target.clearing)),
            enabledCardIds: null,
            canConfirm: false,
            canCancel: true,
          },
        }
      }
      if (spec.type === 'aid') {
        draft = {
          type: 'aid',
          cardIds: params.cardIds ?? [],
          defenders: params.defender ?? [],
        }
        return {
          kind: 'incomplete',
          prompt: {
            message: 'Aid — pick card',
            highlightClearings: [],
            enabledCardIds: params.cardIds ?? [],
            canConfirm: false,
            canCancel: true,
          },
        }
      }
      if (spec.type === 'repair') {
        const indexes = params.clearings ?? []
        draft = { type: 'repair', indexes }
        if (indexes.length === 1) {
          return {
            kind: 'ready',
            action: { type: 'repair', itemIndex: indexes[0]! },
          }
        }
        return {
          kind: 'incomplete',
          prompt: {
            message: 'Repair — pick damaged item index via clearing click',
            highlightClearings: indexes,
            enabledCardIds: null,
            canConfirm: false,
            canCancel: true,
          },
        }
      }
      if (spec.type === 'vbCraft') {
        draft = { type: 'vbCraft', cardIds: params.cardIds ?? [] }
        return {
          kind: 'incomplete',
          prompt: {
            message: 'Craft — pick card',
            highlightClearings: [],
            enabledCardIds: params.cardIds ?? [],
            canConfirm: false,
            canCancel: true,
          },
        }
      }
      if (spec.type === 'steal') {
        const defenders = params.defender ?? []
        draft = { type: 'steal', defenders }
        if (defenders.length === 1) {
          return {
            kind: 'ready',
            action: { type: 'steal', target: defenders[0]! },
          }
        }
        return {
          kind: 'incomplete',
          prompt: {
            message: 'Steal — pick target seat via defender',
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
      if (draft.type === 'slip') {
        if (!draft.clearings.includes(clearingId)) return null
        draft = { type: 'idle' }
        return { kind: 'ready', action: { type: 'slip', to: clearingId } }
      }
      if (draft.type === 'vbMove') {
        if (!draft.clearings.includes(clearingId)) return null
        draft = { type: 'idle' }
        return { kind: 'ready', action: { type: 'vbMove', to: clearingId } }
      }
      if (draft.type === 'vbBattle' || draft.type === 'strike') {
        const matches = draft.targets.filter(
          (target) => target.clearing === clearingId,
        )
        if (matches.length === 0) return null
        if (matches.length === 1) {
          const match = matches[0]!
          const type = draft.type === 'vbBattle' ? 'vbBattle' : 'strike'
          draft = { type: 'idle' }
          return {
            kind: 'ready',
            action: { type, defender: match.defender },
          }
        }
        return {
          kind: 'incomplete',
          prompt: {
            message: 'Pick defender seat',
            highlightClearings: [clearingId],
            enabledCardIds: null,
            canConfirm: false,
            canCancel: true,
          },
        }
      }
      if (draft.type === 'repair' && draft.indexes.includes(clearingId)) {
        draft = { type: 'idle' }
        return { kind: 'ready', action: { type: 'repair', itemIndex: clearingId } }
      }
      return null
    },

    chooseCard: (cardId: string): ComposerOutcome | null => {
      if (draft.type === 'aid' && draft.cardIds.includes(cardId)) {
        const target = draft.defenders[0]
        if (target === undefined) return null
        draft = { type: 'idle' }
        return { kind: 'ready', action: { type: 'aid', cardId, target } }
      }
      if (draft.type === 'vbCraft' && draft.cardIds.includes(cardId)) {
        draft = { type: 'idle' }
        return { kind: 'ready', action: { type: 'vbCraft', cardId } }
      }
      return null
    },

    chooseDefender: (defenderSeat: number): ComposerOutcome | null => {
      if (draft.type === 'steal' && draft.defenders.includes(defenderSeat)) {
        draft = { type: 'idle' }
        return { kind: 'ready', action: { type: 'steal', target: defenderSeat } }
      }
      if (draft.type === 'vbBattle' || draft.type === 'strike') {
        const match = draft.targets.find(
          (target) => target.defender === defenderSeat,
        )
        if (match === undefined) return null
        const type = draft.type === 'vbBattle' ? 'vbBattle' : 'strike'
        draft = { type: 'idle' }
        return { kind: 'ready', action: { type, defender: match.defender } }
      }
      return null
    },

    confirm: (): ComposerOutcome | null => {
      if (draft.type === 'slip' && draft.forests.length > 0) {
        const forest = draft.forests[0]!
        draft = { type: 'idle' }
        return { kind: 'ready', action: { type: 'slip', to: `forest:${forest}` } }
      }
      return null
    },

    cancel: (): ComposerOutcome | null => {
      draft = { type: 'idle' }
      return { kind: 'idle' }
    },
  }

  return {
    hooks,
    getDraft: (): VagabondDraft => draft,
  }
}
