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
  addToDecreeOutcome,
  withDecreeCardPicked,
  withDecreeCardStaged,
  withDecreeCardTakenBack,
  withDecreeStagingCleared,
} from '#game/resolution/addToDecreeStaging.ts'
import {
  isDecreeCardOption,
  type AddToDecreeDraft,
  type DecreeCardOption,
  type EyrieDraft,
  uniqueNumbers,
} from '#game/eyrieActionComposerModels.ts'
import {
  soleDecreeBattleAction,
  soleDecreeClearingAction,
  soleDecreeMoveAction,
  soleNewRoostAction,
} from '#game/resolution/eyrieDecreeSoleOption.ts'

/** Each is null when no Add to Decree is being staged. */
export type DecreeStaging = {
  stage: (option: DecreeCardOption) => ComposerOutcome | null
  takeBack: (cardId: string) => ComposerOutcome | null
  clear: () => ComposerOutcome | null
}

/**
 * Eyrie birdsong + decree: forced addToDecree, newRoost, decree L→R, turmoil.
 */
export function createEyrieComposerHooks(options?: SeatLabelOptions): {
  hooks: ActionComposerHooks
  getDraft: () => EyrieDraft
  getPromptOptions: () => Array<{ label: string; value: string }>
  decreeStaging: DecreeStaging
} {
  let draft: EyrieDraft = { type: 'idle' }
  let promptOptions: Array<{ label: string; value: string }> = []

  function restage(staged: AddToDecreeDraft): ComposerOutcome {
    draft = staged
    return addToDecreeOutcome(staged)
  }

  /** Decree panel: staged cards laid, moved and taken back without a pick first. */
  const decreeStaging: DecreeStaging = {
    stage: (option: DecreeCardOption): ComposerOutcome | null =>
      draft.type === 'addToDecree'
        ? restage(withDecreeCardStaged(draft, option))
        : null,
    takeBack: (cardId: string): ComposerOutcome | null =>
      draft.type === 'addToDecree'
        ? restage(withDecreeCardTakenBack(draft, cardId))
        : null,
    clear: (): ComposerOutcome | null =>
      draft.type === 'addToDecree'
        ? restage(withDecreeStagingCleared(draft))
        : null,
  }

  const hooks: ActionComposerHooks = {
    begin: (spec: ActionSpec): ComposerOutcome | null => {
      promptOptions = []
      if (spec.type === 'addToDecree') {
        const params = readChoiceParams(spec)
        const options = (params.options ?? []).filter(isDecreeCardOption)
        const begun: AddToDecreeDraft = {
          type: 'addToDecree',
          options,
          birdCardIds: new Set(params.birdCardIds ?? []),
          selected: [],
          pendingCardId: null,
        }
        draft = begun
        return addToDecreeOutcome(begun)
      }

      if (spec.type === 'newRoost') {
        const params = readChoiceParams(spec)
        const clearings = params.clearings ?? []
        const sole = soleNewRoostAction(clearings)
        if (sole !== null) {
          draft = { type: 'idle' }
          return { kind: 'ready', action: sole }
        }
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
          const sole = soleDecreeClearingAction({ column, cardId, clearings })
          if (sole !== null) {
            draft = { type: 'idle' }
            return { kind: 'ready', action: sole }
          }
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
          const sole = soleDecreeBattleAction({ column, cardId, targets })
          if (sole !== null) {
            draft = { type: 'idle' }
            return { kind: 'ready', action: sole }
          }
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
              highlightClearings: uniqueNumbers(
                targets.map((target) => target.clearing),
              ),
              enabledCardIds: null,
              canConfirm: false,
              canCancel: true,
            },
          }
        }

        if (column === 'move') {
          const sole = soleDecreeMoveAction({ column, cardId, moves })
          if (sole !== null) {
            draft = { type: 'idle' }
            return { kind: 'ready', action: sole }
          }
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
              highlightClearings: uniqueNumbers(
                moves.map((move) => move.from),
              ),
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
      return restage(withDecreeCardPicked(draft, cardId))
    },

    chooseColumn: (column: string): ComposerOutcome | null => {
      if (draft.type === 'addToDecree' && draft.pendingCardId !== null) {
        // The column is a slot of the Decree panel; nothing is sent before Confirm.
        return restage(
          withDecreeCardStaged(draft, { cardId: draft.pendingCardId, column }),
        )
      }

      // Defender seat for decree battle (same channel as Marquise)
      if (
        draft.type === 'decree' &&
        draft.picking === 'defender' &&
        draft.from !== null
      ) {
        if (!column.startsWith(SEAT_VALUE_PREFIX)) {
          return null
        }
        const defender = Number(column.slice(SEAT_VALUE_PREFIX.length))
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
          label:
            options?.factionNameForSeat?.(target.defender) ??
            fallbackSeatLabel(target.defender),
          // Prefixed so the banner shows buttons, not a numeric count stepper.
          value: `${SEAT_VALUE_PREFIX}${String(target.defender)}`,
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
        const destinations = uniqueNumbers(fromMoves.map((move) => move.to))
        // One destination and one warrior count: finish the move.
        if (destinations.length === 1 && fromMoves.length === 1) {
          const match = fromMoves[0]
          if (match !== undefined) {
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
        }
        draft = { ...draft, from: clearingId, to: null, picking: 'moveTo' }
        promptOptions = []
        return {
          kind: 'incomplete',
          prompt: {
            message: 'Decree move — pick destination',
            highlightClearings: destinations,
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
        if (candidates.length === 1) {
          const match = candidates[0]
          if (match !== undefined) {
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
        }
        const counts = uniqueNumbers(candidates.map((move) => move.count)).sort(
          (left, right) => left - right,
        )
        promptOptions = counts.map((count) => ({
          label: `${String(count)} x warriors`,
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
      // Nothing is sent before confirm: cancel drops the whole staged draft.
      draft = { type: 'idle' }
      promptOptions = []
      return { kind: 'idle' }
    },
  }

  return {
    hooks,
    getDraft: () => draft,
    getPromptOptions: () => promptOptions,
    decreeStaging,
  }
}
