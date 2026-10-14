import type {
  ClearingStepperView,
  ComposerOutcome,
} from '#game/resolution/ActionComposer.ts'

export type MarquiseBuildOption = {
  clearing: number
  building: string
  woodCost: number
  availableWoodClearings: number[]
  suggestedWoodClearings: number[]
}

export type MarquiseBuildWoodDraft = {
  type: 'buildWood'
  clearing: number
  building: string
  woodCost: number
  availableWoodClearings: number[]
  selectedWoodClearings: number[]
}

function isNumberList(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'number')
}

export function readMarquiseBuildOption(value: unknown): MarquiseBuildOption | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }
  const clearing = Reflect.get(value, 'clearing')
  const building = Reflect.get(value, 'building')
  if (typeof clearing !== 'number' || typeof building !== 'string') {
    return null
  }
  const woodCostValue = Reflect.get(value, 'woodCost')
  const woodCost = typeof woodCostValue === 'number' ? woodCostValue : 0
  const availableValue = Reflect.get(value, 'availableWoodClearings')
  const suggestedValue = Reflect.get(value, 'suggestedWoodClearings')
  return {
    clearing,
    building,
    woodCost,
    availableWoodClearings: isNumberList(availableValue) ? availableValue : [],
    suggestedWoodClearings: isNumberList(suggestedValue) ? suggestedValue : [],
  }
}

export function countClearing(
  clearings: readonly number[],
  clearingId: number,
): number {
  return clearings.filter((clearing) => clearing === clearingId).length
}

/** Add one wood from the clearing, or remove one when full / no spare. */
export function adjustWoodSelection(
  selected: readonly number[],
  clearingId: number,
  available: readonly number[],
  woodCost: number,
): number[] {
  const availableAtClearing = countClearing(available, clearingId)
  if (availableAtClearing < 1) {
    return [...selected]
  }
  const selectedAtClearing = countClearing(selected, clearingId)
  if (selected.length < woodCost && selectedAtClearing < availableAtClearing) {
    return [...selected, clearingId]
  }
  const removeIndex = selected.lastIndexOf(clearingId)
  if (removeIndex < 0) {
    return [...selected]
  }
  return selected.filter((_clearing, index) => index !== removeIndex)
}

/**
 * Set how many wood tokens to take from one clearing (stepper).
 * Other clearings keep their picks; total never exceeds woodCost.
 */
export function setWoodCountAtClearing(
  selected: readonly number[],
  clearingId: number,
  count: number,
  available: readonly number[],
  woodCost: number,
): number[] {
  const availableAtClearing = countClearing(available, clearingId)
  if (availableAtClearing < 1) {
    return [...selected]
  }
  const withoutClearing = selected.filter((clearing) => clearing !== clearingId)
  const roomLeft = Math.max(0, woodCost - withoutClearing.length)
  const clampedCount = Math.max(
    0,
    Math.min(count, availableAtClearing, roomLeft),
  )
  const takenFromClearing: number[] = Array.from(
    { length: clampedCount },
    (): number => clearingId,
  )
  return [...withoutClearing, ...takenFromClearing]
}

function unique(values: number[]): number[] {
  return [...new Set(values)]
}

export function woodClearingSteppers(
  draft: MarquiseBuildWoodDraft,
): ClearingStepperView[] {
  return unique(draft.availableWoodClearings).map(
    (clearingId: number): ClearingStepperView => ({
      clearingId,
      selected: countClearing(draft.selectedWoodClearings, clearingId),
      maximum: countClearing(draft.availableWoodClearings, clearingId),
    }),
  )
}

export function woodSpendPrompt(draft: MarquiseBuildWoodDraft): ComposerOutcome {
  return {
    kind: 'incomplete',
    prompt: {
      message: `Build — spend wood (${String(draft.selectedWoodClearings.length)}/${String(draft.woodCost)})`,
      highlightClearings: unique(draft.availableWoodClearings),
      clearingSteppers: woodClearingSteppers(draft),
      clearingStepperBudget: draft.woodCost,
      enabledCardIds: null,
      canConfirm: draft.selectedWoodClearings.length === draft.woodCost,
      canCancel: true,
    },
  }
}

export function readyBuildAction(option: {
  clearing: number
  building: string
  woodClearings: number[]
}): ComposerOutcome {
  return {
    kind: 'ready',
    action: {
      type: 'build',
      clearing: option.clearing,
      building: option.building,
      woodClearings: option.woodClearings,
    },
  }
}

export function beginWoodSpend(option: MarquiseBuildOption): {
  draft: MarquiseBuildWoodDraft
  outcome: ComposerOutcome
} {
  const draft: MarquiseBuildWoodDraft = {
    type: 'buildWood',
    clearing: option.clearing,
    building: option.building,
    woodCost: option.woodCost,
    availableWoodClearings: option.availableWoodClearings,
    selectedWoodClearings: [...option.suggestedWoodClearings],
  }
  return { draft, outcome: woodSpendPrompt(draft) }
}

export function finishBuildChoice(option: MarquiseBuildOption): {
  draft: MarquiseBuildWoodDraft | { type: 'idle' }
  outcome: ComposerOutcome
} {
  if (option.woodCost <= 0) {
    return {
      draft: { type: 'idle' },
      outcome: readyBuildAction({
        clearing: option.clearing,
        building: option.building,
        woodClearings: [],
      }),
    }
  }
  const wood = beginWoodSpend(option)
  return { draft: wood.draft, outcome: wood.outcome }
}
