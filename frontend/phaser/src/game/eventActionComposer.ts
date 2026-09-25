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

const FIELD_HOSPITAL_DECLINE_VALUE = 'decline'

type EventDraft =
  | { type: 'idle' }
  | { type: 'pickCard'; cardIds: string[]; kind: 'fieldHospital' | 'battle' }
  | { type: 'pickFieldHospital'; cardIds: string[] }
  | { type: 'pickAmbush'; cardIds: string[]; role: 'ambush' | 'foil' }
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
  beginFieldHospital: (cardIds: readonly string[]) => ComposerOutcome
  beginAmbush: (
    cardIds: readonly string[],
    role: 'ambush' | 'foil',
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
    // Single legal combo (typical warrior-only): submit without prompt.
    if (choices.length === 1) {
      const only = choices[0]
      if (only === undefined) {
        clear()
        return { kind: 'idle' }
      }
      clear()
      return {
        kind: 'ready',
        action: { type: 'resolveEvent', pieceIds: only.pieceIds },
      }
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

  const beginFieldHospital = (
    cardIds: readonly string[],
  ): ComposerOutcome => {
    overlayKind = 'fieldHospital'
    if (cardIds.length === 0) {
      clear()
      return {
        kind: 'ready',
        action: { type: 'resolveEvent', decline: true },
      }
    }
    const uniqueCardIds = [...new Set(cardIds)]
    draft = { type: 'pickFieldHospital', cardIds: uniqueCardIds }
    optionPresentation = 'buttons'
    promptOptions = [
      {
        label: 'Decline Field Hospitals',
        value: FIELD_HOSPITAL_DECLINE_VALUE,
      },
    ]
    return {
      kind: 'incomplete',
      prompt: {
        message: 'Field Hospitals — pay matching suit or Decline',
        highlightClearings: [],
        enabledCardIds: uniqueCardIds,
        canConfirm: false,
        canCancel: true,
      },
    }
  }

  const beginAmbush = (
    cardIds: readonly string[],
    role: 'ambush' | 'foil',
  ): ComposerOutcome => {
    overlayKind = 'battle'
    if (cardIds.length === 0) {
      clear()
      return {
        kind: 'ready',
        action: { type: 'resolveEvent', decline: true },
      }
    }
    const uniqueCardIds = [...new Set(cardIds)]
    draft = { type: 'pickAmbush', cardIds: uniqueCardIds, role }
    optionPresentation = 'buttons'
    promptOptions = [
      {
        label: role === 'foil' ? 'Skip foil' : 'Skip ambush',
        value: FIELD_HOSPITAL_DECLINE_VALUE,
      },
    ]
    return {
      kind: 'incomplete',
      prompt: {
        message:
          role === 'foil'
            ? 'Foil ambush — play matching Ambush or Skip'
            : 'Ambush? — play matching Ambush or Skip',
        highlightClearings: [],
        enabledCardIds: uniqueCardIds,
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

      // Ambush/foil skip: decline alone auto-submits.
      if (params.decline !== undefined && params.cardIds === undefined) {
        overlayKind = 'battle'
        const action: ClientAction = { type: 'resolveEvent', decline: true }
        clear()
        return { kind: 'ready', action }
      }

      if (params.cardIds !== undefined) {
        overlayKind = 'battle'
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
        draft = { type: 'pickCard', cardIds: params.cardIds, kind: 'battle' }
        return {
          kind: 'incomplete',
          prompt: {
            message: 'Pick ambush card',
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
      if (draft.type === 'pickAmbush' && draft.cardIds.includes(cardId)) {
        clear()
        return { kind: 'ready', action: { type: 'resolveEvent', cardId } }
      }
      if (
        draft.type === 'pickFieldHospital' &&
        draft.cardIds.includes(cardId)
      ) {
        clear()
        return { kind: 'ready', action: { type: 'resolveEvent', cardId } }
      }
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
      if (draft.type === 'pickAmbush') {
        if (value !== FIELD_HOSPITAL_DECLINE_VALUE) {
          return null
        }
        clear()
        return { kind: 'ready', action: { type: 'resolveEvent', decline: true } }
      }
      if (draft.type === 'pickFieldHospital') {
        if (value !== FIELD_HOSPITAL_DECLINE_VALUE) {
          return null
        }
        clear()
        return { kind: 'ready', action: { type: 'resolveEvent', decline: true } }
      }
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
      // Ambush/foil must resolve — cancel = skip.
      if (draft.type === 'pickAmbush') {
        clear()
        return {
          kind: 'ready',
          action: { type: 'resolveEvent', decline: true },
        }
      }
      // Field Hospitals must resolve — cancel = decline.
      if (draft.type === 'pickFieldHospital') {
        clear()
        return {
          kind: 'ready',
          action: { type: 'resolveEvent', decline: true },
        }
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
    beginFieldHospital,
    beginAmbush,
  }
}

/** Collect pay-card ids from Field Hospital legal resolveEvent specs. */
export function fieldHospitalCardIdsFromSpecs(
  specs: readonly ActionSpec[],
): string[] {
  const cardIds: string[] = []
  for (const spec of specs) {
    if (spec.type !== 'resolveEvent') {
      continue
    }
    const params = readChoiceParams(spec)
    if (params.cardIds === undefined) {
      continue
    }
    for (const cardId of params.cardIds) {
      cardIds.push(cardId)
    }
  }
  return cardIds
}

export function isFieldHospitalPending(pending: unknown): boolean {
  if (typeof pending !== 'object' || pending === null) {
    return false
  }
  return Reflect.get(pending, 'type') === 'fieldHospital'
}

export function battleAmbushRole(
  pending: unknown,
): 'ambush' | 'foil' | null {
  if (typeof pending !== 'object' || pending === null) {
    return null
  }
  if (Reflect.get(pending, 'type') !== 'battle') {
    return null
  }
  const stage = Reflect.get(pending, 'stage')
  if (stage === 'ambush' || stage === 'foil') {
    return stage
  }
  return null
}

export function isBattleRemovalPending(pending: unknown): boolean {
  if (typeof pending !== 'object' || pending === null) {
    return false
  }
  if (Reflect.get(pending, 'type') !== 'battle') {
    return false
  }
  const stage = Reflect.get(pending, 'stage')
  return stage === 'removeDefender' || stage === 'removeAttacker'
}
