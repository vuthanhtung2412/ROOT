import type { ActionSpec } from '#api/client.ts'
import {
  formatEyrieLeaderOptionLabel,
} from '#assets/eyrieLeaderCatalog.ts'
import {
  readChoiceParams,
  type ActionComposerHooks,
  type ClientAction,
  type ComposerOutcome,
} from '#game/ActionComposer.ts'
import type { BattleRemovalStepperChoice } from '#game/battleRemovalStepper.ts'

type EventDraft =
  | { type: 'idle' }
  | { type: 'pickCard'; cardIds: string[]; kind: 'fieldHospital' | 'battle' }
  | { type: 'pickOrder'; orders: number[][] }
  | { type: 'pickEffect' }
  | { type: 'pickKeep'; clearings: number[] }
  | {
      type: 'pickStartingBuilding'
      clearings: number[]
      building: string
    }
  | { type: 'pickLeader'; leaders: string[] }
  | { type: 'pickRemoval'; choices: BattleRemovalStepperChoice[] }

/**
 * Pending resolveEvent composers (Field Hospitals + battle + setup picks).
 */
export function createEventComposerHooks(): {
  hooks: ActionComposerHooks
  getDraft: () => EventDraft
  getPromptOptions: () => Array<{ label: string; value: string }>
  getOptionPresentation: () => 'stepper' | 'buttons' | undefined
  getOverlayKind: () => 'fieldHospital' | 'battle' | null
  beginBattleRemoval: (
    choices: BattleRemovalStepperChoice[],
  ) => ComposerOutcome
} {
  let draft: EventDraft = { type: 'idle' }
  let promptOptions: Array<{ label: string; value: string }> = []
  let optionPresentation: 'stepper' | 'buttons' | undefined
  let overlayKind: 'fieldHospital' | 'battle' | null = null

  const clear = (): void => {
    draft = { type: 'idle' }
    promptOptions = []
    optionPresentation = undefined
    overlayKind = null
  }

  const beginBattleRemoval = (
    choices: BattleRemovalStepperChoice[],
  ): ComposerOutcome => {
    if (choices.length === 0) {
      clear()
      return { kind: 'idle' }
    }
    overlayKind = 'battle'
    draft = { type: 'pickRemoval', choices }
    optionPresentation = 'stepper'
    promptOptions = choices.map((choice) => ({
      label: choice.label,
      value: choice.value,
    }))
    return {
      kind: 'incomplete',
      prompt: {
        message: 'Remove hits — choose pieces',
        highlightClearings: [],
        enabledCardIds: null,
        canConfirm: false,
        canCancel: true,
      },
    }
  }

  const hooks: ActionComposerHooks = {
    begin: (spec: ActionSpec): ComposerOutcome | null => {
      if (spec.type !== 'resolveEvent') {
        clear()
        return null
      }

      const params = readChoiceParams(spec)

      if (
        params.clearing !== undefined &&
        params.building !== undefined &&
        params.building[0] !== undefined
      ) {
        const building = params.building[0]
        draft = {
          type: 'pickStartingBuilding',
          clearings: params.clearing,
          building,
        }
        return {
          kind: 'incomplete',
          prompt: {
            message: `Place ${building}`,
            highlightClearings: params.clearing,
            enabledCardIds: null,
            canConfirm: false,
            canCancel: false,
          },
        }
      }

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
          label: formatEyrieLeaderOptionLabel(leader),
          value: leader,
        }))
        return {
          kind: 'incomplete',
          prompt: {
            message: 'Choose Eyrie leader — see cards below',
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

      // pieceIds: GameScene batches legal combos via beginBattleRemoval
      if (params.pieceIds !== undefined) {
        return null
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
      if (
        draft.type === 'pickStartingBuilding' &&
        draft.clearings.includes(clearingId)
      ) {
        clear()
        return {
          kind: 'ready',
          action: { type: 'resolveEvent', clearing: clearingId },
        }
      }
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
      if (draft.type === 'pickRemoval') {
        const choice = draft.choices.find((entry) => entry.value === value)
        if (choice === undefined) {
          return null
        }
        clear()
        return {
          kind: 'ready',
          action: { type: 'resolveEvent', pieceIds: choice.pieceIds },
        }
      }
      return null
    },

    cancel: (): ComposerOutcome | null => {
      if (draft.type === 'idle' && overlayKind === null) {
        return null
      }
      if (
        draft.type === 'pickKeep' ||
        draft.type === 'pickLeader' ||
        draft.type === 'pickStartingBuilding'
      ) {
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
    getOptionPresentation: () => optionPresentation,
    getOverlayKind: () => overlayKind,
    beginBattleRemoval,
  }
}
