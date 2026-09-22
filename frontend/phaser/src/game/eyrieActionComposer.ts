import type { ActionSpec } from '#api/client.ts'
import {
  readChoiceParams,
  type ActionComposerHooks,
  type ClientAction,
  type ComposerOutcome,
} from '#game/ActionComposer.ts'

type DecreeCardOption = { cardId: string; column: string }
type MarchMove = { from: number; to: number; count: number }
type BattleTarget = { clearing: number; defender: number }

type EyrieDraft =
  | { type: 'idle' }
  | {
      type: 'addToDecree'
      options: DecreeCardOption[]
      birdCardIds: Set<string>
      selected: DecreeCardOption[]
      pendingCardId: string | null
    }
  | { type: 'newRoost'; clearings: number[] }
  | {
      type: 'decree'
      column: string
      cardId: string
      clearings: number[]
      targets: BattleTarget[]
      moves: MarchMove[]
      from: number | null
      to: number | null
      picking:
        | 'clearing'
        | 'defender'
        | 'moveFrom'
        | 'moveTo'
        | 'moveCount'
        | 'done'
    }

function isDecreeCardOption(value: unknown): value is DecreeCardOption {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const cardId = Reflect.get(value, 'cardId')
  const column = Reflect.get(value, 'column')
  return typeof cardId === 'string' && typeof column === 'string'
}

function unique(values: number[]): number[] {
  return [...new Set(values)]
}

/**
 * Eyrie birdsong + decree: forced addToDecree, newRoost, decree L→R, turmoil.
 */
export function createEyrieComposerHooks(): {
  hooks: ActionComposerHooks
  getDraft: () => EyrieDraft
  getPromptOptions: () => Array<{ label: string; value: string }>
} {
  let draft: EyrieDraft = { type: 'idle' }
  let promptOptions: Array<{ label: string; value: string }> = []

  const hooks: ActionComposerHooks = {
    begin: (spec: ActionSpec): ComposerOutcome | null => {
      promptOptions = []
      if (spec.type === 'addToDecree') {
        const params = readChoiceParams(spec)
        const options = (params.options ?? []).filter(isDecreeCardOption)
        draft = {
          type: 'addToDecree',
          options,
          birdCardIds: new Set(params.birdCardIds ?? []),
          selected: [],
          pendingCardId: null,
        }
        return {
          kind: 'incomplete',
          prompt: {
            message: 'Add to Decree — pick 1–2 cards (≤1 bird)',
            highlightClearings: [],
            enabledCardIds: uniqueCardIds(options),
            canConfirm: false,
            canCancel: false,
          },
        }
      }

      if (spec.type === 'newRoost') {
        const params = readChoiceParams(spec)
        const clearings = params.clearings ?? []
        draft = { type: 'newRoost', clearings }
        return {
          kind: 'incomplete',
          prompt: {
            message: 'A New Roost — pick clearing',
            highlightClearings: clearings,
            enabledCardIds: null,
            canConfirm: false,
            canCancel: true,
          },
        }
      }

      if (spec.type === 'decree') {
        const params = readChoiceParams(spec)
        const column = params.column?.[0]
        const cardId = params.cardIds?.[0]
        if (column === undefined || cardId === undefined) {
          return null
        }
        const clearings = params.clearings ?? []
        const targets = params.targets ?? []
        const moves = params.moves ?? []

        if (column === 'recruit' || column === 'build') {
          draft = {
            type: 'decree',
            column,
            cardId,
            clearings,
            targets,
            moves,
            from: null,
            to: null,
            picking: 'clearing',
          }
          return {
            kind: 'incomplete',
            prompt: {
              message: `Decree ${column} — pick clearing`,
              highlightClearings: clearings,
              enabledCardIds: null,
              canConfirm: false,
              canCancel: true,
            },
          }
        }

        if (column === 'battle') {
          draft = {
            type: 'decree',
            column,
            cardId,
            clearings,
            targets,
            moves,
            from: null,
            to: null,
            picking: 'clearing',
          }
          return {
            kind: 'incomplete',
            prompt: {
              message: 'Decree battle — pick clearing',
              highlightClearings: unique(targets.map((target) => target.clearing)),
              enabledCardIds: null,
              canConfirm: false,
              canCancel: true,
            },
          }
        }

        if (column === 'move') {
          draft = {
            type: 'decree',
            column,
            cardId,
            clearings,
            targets,
            moves,
            from: null,
            to: null,
            picking: 'moveFrom',
          }
          return {
            kind: 'incomplete',
            prompt: {
              message: 'Decree move — pick origin',
              highlightClearings: unique(moves.map((move) => move.from)),
              enabledCardIds: null,
              canConfirm: false,
              canCancel: true,
            },
          }
        }

        // No extra params
        draft = { type: 'idle' }
        return {
          kind: 'ready',
          action: { type: 'decree', column, cardId },
        }
      }

      draft = { type: 'idle' }
      return null
    },

    chooseCard: (cardId: string): ComposerOutcome | null => {
      if (draft.type !== 'addToDecree') {
        return null
      }
      const columns = draft.options
        .filter((option) => option.cardId === cardId)
        .map((option) => option.column)
      if (columns.length === 0) {
        return null
      }
      draft = { ...draft, pendingCardId: cardId }
      promptOptions = columns.map((column) => ({
        label: column,
        value: column,
      }))
      return {
        kind: 'incomplete',
        prompt: {
          message: 'Pick decree column',
          highlightClearings: [],
          enabledCardIds: [cardId],
          canConfirm: false,
          canCancel: draft.selected.length > 0,
        },
      }
    },

    chooseColumn: (column: string): ComposerOutcome | null => {
      if (draft.type === 'addToDecree' && draft.pendingCardId !== null) {
        const cardId = draft.pendingCardId
        const birdCardIds = draft.birdCardIds
        const priorSelected = draft.selected
        const birdCount =
          priorSelected.filter((entry) => birdCardIds.has(entry.cardId))
            .length + (birdCardIds.has(cardId) ? 1 : 0)
        if (birdCount > 1) {
          return {
            kind: 'incomplete',
            prompt: {
              message: 'At most one bird card',
              highlightClearings: [],
              enabledCardIds: uniqueCardIds(draft.options),
              canConfirm: priorSelected.length >= 1,
              canCancel: false,
            },
          }
        }
        const selected = [...priorSelected, { cardId, column }]
        const options = draft.options
        draft = {
          type: 'addToDecree',
          options,
          birdCardIds,
          selected,
          pendingCardId: null,
        }
        promptOptions = []
        if (selected.length >= 2) {
          draft = { type: 'idle' }
          return {
            kind: 'ready',
            action: { type: 'addToDecree', cards: selected },
          }
        }
        return {
          kind: 'incomplete',
          prompt: {
            message: 'Added 1 — pick 2nd card or Confirm',
            highlightClearings: [],
            enabledCardIds: uniqueCardIds(options).filter(
              (id) => id !== cardId,
            ),
            canConfirm: true,
            canCancel: false,
          },
        }
      }

      // Defender seat for decree battle (same channel as Marquise)
      if (
        draft.type === 'decree' &&
        draft.picking === 'defender' &&
        draft.from !== null
      ) {
        const defender = Number(column)
        const clearing = draft.from
        const match = draft.targets.find(
          (target) =>
            target.clearing === clearing && target.defender === defender,
        )
        if (match === undefined) {
          return null
        }
        const action: ClientAction = {
          type: 'decree',
          column: draft.column,
          cardId: draft.cardId,
          clearing: match.clearing,
          defender: match.defender,
        }
        draft = { type: 'idle' }
        promptOptions = []
        return { kind: 'ready', action }
      }

      // Warrior count for decree move
      if (
        draft.type === 'decree' &&
        draft.picking === 'moveCount' &&
        draft.from !== null &&
        draft.to !== null
      ) {
        const count = Number(column)
        if (!Number.isInteger(count) || count < 1) {
          return null
        }
        const origin = draft.from
        const destination = draft.to
        const match = draft.moves.find(
          (move) =>
            move.from === origin &&
            move.to === destination &&
            move.count === count,
        )
        if (match === undefined) {
          return null
        }
        const action: ClientAction = {
          type: 'decree',
          column: draft.column,
          cardId: draft.cardId,
          moves: [match],
        }
        draft = { type: 'idle' }
        promptOptions = []
        return { kind: 'ready', action }
      }

      return null
    },

    chooseClearing: (clearingId: number): ComposerOutcome | null => {
      if (draft.type === 'newRoost') {
        if (!draft.clearings.includes(clearingId)) {
          return null
        }
        draft = { type: 'idle' }
        return {
          kind: 'ready',
          action: { type: 'newRoost', clearing: clearingId },
        }
      }

      if (draft.type !== 'decree') {
        return null
      }

      if (
        (draft.column === 'recruit' || draft.column === 'build') &&
        draft.picking === 'clearing'
      ) {
        if (!draft.clearings.includes(clearingId)) {
          return null
        }
        const action: ClientAction = {
          type: 'decree',
          column: draft.column,
          cardId: draft.cardId,
          clearing: clearingId,
        }
        draft = { type: 'idle' }
        return { kind: 'ready', action }
      }

      if (draft.column === 'battle' && draft.picking === 'clearing') {
        const matches = draft.targets.filter(
          (target) => target.clearing === clearingId,
        )
        if (matches.length === 0) {
          return null
        }
        if (matches.length === 1) {
          const match = matches[0]
          if (match === undefined) {
            return null
          }
          const action: ClientAction = {
            type: 'decree',
            column: draft.column,
            cardId: draft.cardId,
            clearing: match.clearing,
            defender: match.defender,
          }
          draft = { type: 'idle' }
          return { kind: 'ready', action }
        }
        draft = { ...draft, from: clearingId, picking: 'defender' }
        promptOptions = matches.map((target) => ({
          label: `seat ${String(target.defender)}`,
          value: String(target.defender),
        }))
        return {
          kind: 'incomplete',
          prompt: {
            message: 'Decree battle — pick defender',
            highlightClearings: [clearingId],
            enabledCardIds: null,
            canConfirm: false,
            canCancel: true,
          },
        }
      }

      if (draft.column === 'move' && draft.picking === 'moveFrom') {
        const fromMoves = draft.moves.filter((move) => move.from === clearingId)
        if (fromMoves.length === 0) {
          return null
        }
        draft = { ...draft, from: clearingId, to: null, picking: 'moveTo' }
        promptOptions = []
        return {
          kind: 'incomplete',
          prompt: {
            message: 'Decree move — pick destination',
            highlightClearings: unique(fromMoves.map((move) => move.to)),
            enabledCardIds: null,
            canConfirm: false,
            canCancel: true,
          },
        }
      }

      if (
        draft.column === 'move' &&
        draft.picking === 'moveTo' &&
        draft.from !== null
      ) {
        const origin = draft.from
        const candidates = draft.moves.filter(
          (move) => move.from === origin && move.to === clearingId,
        )
        if (candidates.length === 0) {
          return null
        }
        const counts = unique(candidates.map((move) => move.count)).sort(
          (left, right) => left - right,
        )
        promptOptions = counts.map((count) => ({
          label: `${String(count)} warrior${count === 1 ? '' : 's'}`,
          value: String(count),
        }))
        draft = {
          ...draft,
          to: clearingId,
          picking: 'moveCount',
        }
        return {
          kind: 'incomplete',
          prompt: {
            message: 'Decree move — how many warriors?',
            highlightClearings: [origin, clearingId],
            enabledCardIds: null,
            canConfirm: false,
            canCancel: true,
          },
        }
      }

      return null
    },

    confirm: (): ComposerOutcome | null => {
      if (draft.type !== 'addToDecree' || draft.selected.length === 0) {
        return null
      }
      const action: ClientAction = {
        type: 'addToDecree',
        cards: draft.selected,
      }
      draft = { type: 'idle' }
      promptOptions = []
      return { kind: 'ready', action }
    },

    cancel: (): ComposerOutcome | null => {
      if (draft.type === 'idle') {
        return null
      }
      // Forced addToDecree: cancel only clears pending second pick
      if (draft.type === 'addToDecree') {
        if (draft.pendingCardId !== null) {
          draft = { ...draft, pendingCardId: null }
          promptOptions = []
          return {
            kind: 'incomplete',
            prompt: {
              message: 'Add to Decree — pick card',
              highlightClearings: [],
              enabledCardIds: uniqueCardIds(draft.options),
              canConfirm: draft.selected.length >= 1,
              canCancel: false,
            },
          }
        }
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

function uniqueCardIds(options: DecreeCardOption[]): string[] {
  return [...new Set(options.map((option) => option.cardId))]
}
