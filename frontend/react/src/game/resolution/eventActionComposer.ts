import type { ActionSpec } from '#api/client.ts'
import {
  formatEyrieLeaderOptionLabel,
} from '#assets/eyrieLeaderCatalog.ts'
import {
  CHOOSE_CHARACTER_PROMPT,
  formatVagabondCharacterOptionLabel,
} from '#assets/vagabondBoardCatalog.ts'
import {
  readChoiceParams,
  type ActionComposerHooks,
  type ClientAction,
  type ComposerOutcome,
  type VagabondItemChoiceView,
} from '#game/resolution/ActionComposer.ts'
import type { BattleRemovalStepperChoice } from '#game/battleRemovalStepper.ts'
import { countedNounText } from '#ui/BattleOverlay.ts'
import type { TurnBannerOption } from '#ui/TurnBanner.ts'

export {
  battleAmbushRole,
  fieldHospitalCardIdsFromSpecs,
  isBattleRemovalPending,
  isFieldHospitalPending,
} from '#game/eventAutoPromptSelectors.ts'

const FIELD_HOSPITAL_DECLINE_VALUE = 'decline'
const SELECTED_OPTION_PREFIX = '✓ '
const REMOVED_PIECE_NOUN = 'piece'
const PICKED_ITEM_NOUN = 'item'

/**
 * `damage`: hits / full removal. `remove`: evening item limit (9.6.4).
 * `repair`: Ranger Hideout (D.3.2) — optional, so it can be cancelled.
 */
type ItemPickPurpose = 'damage' | 'remove' | 'repair'

/** Turn actions (not pending events) that carry chosen Vagabond items. */
const ITEM_ACTION_PURPOSES: Readonly<Record<string, ItemPickPurpose>> = {
  vbRemoveItems: 'remove',
  hideout: 'repair',
}

const ITEM_PICK_ACTION_TYPES: Readonly<Record<ItemPickPurpose, string>> = {
  damage: 'resolveEvent',
  remove: 'vbRemoveItems',
  repair: 'hideout',
}

const ITEM_PICK_VERBS: Readonly<Record<ItemPickPurpose, string>> = {
  damage: 'to damage',
  remove: 'to remove (over item limit)',
  repair: 'to repair (Hideout ends Daylight)',
}

function formatItemDamageLabel(
  item: VagabondItemChoiceView,
  isSelected: boolean,
): string {
  const notes: string[] = []
  if (item.exhausted) notes.push('exhausted')
  if (item.damaged === true) notes.push('damaged')
  const face =
    notes.length > 0 ? `${item.type} (${notes.join(', ')})` : item.type
  return isSelected ? `${SELECTED_OPTION_PREFIX}${face}` : face
}

function formatItemDamageMessage(
  purpose: ItemPickPurpose,
  count: number,
  selectedCount: number,
): string {
  const verb = ITEM_PICK_VERBS[purpose]
  const base = `Vagabond — choose ${countedNounText(count, PICKED_ITEM_NOUN)} ${verb}`
  if (selectedCount === count) {
    return `${base} — Confirm when ready`
  }
  return `${base} (${String(selectedCount)}/${String(count)})`
}

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
  | { type: 'pickCharacter'; characters: string[] }
  | { type: 'pickForest'; forests: number[] }
  | { type: 'pickRemoval'; choices: BattleRemovalStepperChoice[] }
  | {
      type: 'pickItemDamage'
      purpose: ItemPickPurpose
      items: VagabondItemChoiceView[]
      count: number
      selectedIndexes: number[]
    }

/**
 * Pending resolveEvent composers (Field Hospitals + battle + setup picks).
 */
export function createEventComposerHooks(): {
  hooks: ActionComposerHooks
  getDraft: () => EventDraft
  getPromptOptions: () => TurnBannerOption[]
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
  let promptOptions: TurnBannerOption[] = []
  let optionPresentation: 'stepper' | 'buttons' | undefined
  let overlayKind: 'fieldHospital' | 'battle' | null = null

  const clear = (): void => {
    draft = { type: 'idle' }
    promptOptions = []
    optionPresentation = undefined
    overlayKind = null
  }

  /** Rule: 9.2.6 — Vagabond toggles items until exactly `count` are chosen. */
  const itemDamagePrompt = (
    pick: {
      purpose: ItemPickPurpose
      items: VagabondItemChoiceView[]
      count: number
    },
    selectedIndexes: number[],
  ): ComposerOutcome => {
    const { purpose, items, count } = pick
    draft = { type: 'pickItemDamage', purpose, items, count, selectedIndexes }
    optionPresentation = 'buttons'
    promptOptions = items.map((item, index) => {
      const isSelected = selectedIndexes.includes(index)
      return {
        label: formatItemDamageLabel(item, isSelected),
        value: String(index),
        item: {
          type: item.type,
          exhausted: item.exhausted,
          damaged: item.damaged === true,
          selected: isSelected,
        },
      }
    })
    return {
      kind: 'incomplete',
      prompt: {
        message: formatItemDamageMessage(purpose, count, selectedIndexes.length),
        highlightClearings: [],
        enabledCardIds: null,
        canConfirm: selectedIndexes.length === count,
        canCancel: purpose === 'repair',
      },
    }
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
    // Every legal removal takes the same number of pieces.
    const removedPieceCount: number = choices[0]?.pieceIds.length ?? 0
    return {
      kind: 'incomplete',
      prompt: {
        message: `Remove hits — choose ${countedNounText(removedPieceCount, REMOVED_PIECE_NOUN)}`,
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
        canCancel: false,
      },
    }
  }

  const beginAmbush = (
    cardIds: readonly string[],
    role: 'ambush' | 'foil',
  ): ComposerOutcome => {
    overlayKind = 'battle'
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
        canCancel: false,
      },
    }
  }

  const hooks: ActionComposerHooks = {
    begin: (spec: ActionSpec): ComposerOutcome | null => {
      const itemActionPurpose = ITEM_ACTION_PURPOSES[spec.type]
      if (itemActionPurpose !== undefined) {
        const removalParams = readChoiceParams(spec)
        const removalCount = removalParams.itemCount?.[0]
        if (
          removalParams.vagabondItems === undefined ||
          removalCount === undefined
        ) {
          clear()
          return null
        }
        return itemDamagePrompt(
          {
            purpose: itemActionPurpose,
            items: removalParams.vagabondItems,
            count: removalCount,
          },
          [],
        )
      }
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

      if (params.forests !== undefined) {
        draft = { type: 'pickForest', forests: params.forests }
        return {
          kind: 'incomplete',
          prompt: {
            message: 'Choose starting forest',
            highlightClearings: [],
            highlightForests: params.forests,
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

      if (params.characters !== undefined) {
        draft = { type: 'pickCharacter', characters: params.characters }
        optionPresentation = 'buttons'
        promptOptions = params.characters.map((character) => ({
          label: formatVagabondCharacterOptionLabel(character),
          value: character,
        }))
        return {
          kind: 'incomplete',
          prompt: {
            message: CHOOSE_CHARACTER_PROMPT,
            highlightClearings: [],
            enabledCardIds: null,
            canConfirm: false,
            canCancel: false,
          },
        }
      }

      const itemDamageCount = params.itemCount?.[0]
      if (params.vagabondItems !== undefined && itemDamageCount !== undefined) {
        return itemDamagePrompt(
          {
            purpose: 'damage',
            items: params.vagabondItems,
            count: itemDamageCount,
          },
          [],
        )
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

    chooseForest: (forestIndex: number): ComposerOutcome | null => {
      if (draft.type !== 'pickForest' || !draft.forests.includes(forestIndex)) {
        return null
      }
      clear()
      return {
        kind: 'ready',
        action: { type: 'resolveEvent', forest: forestIndex },
      }
    },

    chooseColumn: (value: string): ComposerOutcome | null => {
      if (draft.type === 'pickItemDamage') {
        const index = Number(value)
        if (!Number.isInteger(index) || draft.items[index] === undefined) {
          return null
        }
        if (draft.selectedIndexes.includes(index)) {
          return itemDamagePrompt(
            draft,
            draft.selectedIndexes.filter((selected) => selected !== index),
          )
        }
        if (draft.selectedIndexes.length >= draft.count) {
          return itemDamagePrompt(draft, draft.selectedIndexes)
        }
        return itemDamagePrompt(draft, [...draft.selectedIndexes, index])
      }
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
      if (draft.type === 'pickCharacter') {
        if (!draft.characters.includes(value)) {
          return null
        }
        clear()
        return {
          kind: 'ready',
          action: { type: 'resolveEvent', character: value },
        }
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

    confirm: (): ComposerOutcome | null => {
      if (
        draft.type !== 'pickItemDamage' ||
        draft.selectedIndexes.length !== draft.count
      ) {
        return null
      }
      const chosenItems = draft.selectedIndexes.flatMap((index) => {
        const item = draft.type === 'pickItemDamage' ? draft.items[index] : undefined
        return item === undefined ? [] : [item]
      })
      const actionType = ITEM_PICK_ACTION_TYPES[draft.purpose]
      clear()
      return { kind: 'ready', action: { type: actionType, items: chosenItems } }
    },

    cancel: (): ComposerOutcome | null => {
      if (draft.type === 'idle' && overlayKind === null) {
        return null
      }
      // Non-skippable: hits must be assigned to items. Hideout is optional.
      if (draft.type === 'pickItemDamage' && draft.purpose !== 'repair') {
        return itemDamagePrompt(draft, draft.selectedIndexes)
      }
      if (
        draft.type === 'pickKeep' ||
        draft.type === 'pickLeader' ||
        draft.type === 'pickCharacter' ||
        draft.type === 'pickStartingBuilding'
      ) {
        return null
      }
      // Non-skippable: Decline/Skip is a banner option, not corner X.
      if (draft.type === 'pickAmbush') {
        return {
          kind: 'incomplete',
          prompt: {
            message:
              draft.role === 'foil'
                ? 'Foil ambush — play matching Ambush or Skip'
                : 'Ambush? — play matching Ambush or Skip',
            highlightClearings: [],
            enabledCardIds: draft.cardIds,
            canConfirm: false,
            canCancel: false,
          },
        }
      }
      if (draft.type === 'pickFieldHospital') {
        return {
          kind: 'incomplete',
          prompt: {
            message: 'Field Hospitals — pay matching suit or Decline',
            highlightClearings: [],
            enabledCardIds: draft.cardIds,
            canConfirm: false,
            canCancel: false,
          },
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
