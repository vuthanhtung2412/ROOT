import type { ActionSpec } from '#api/client.ts'
import {
  fallbackSeatLabel,
  type ActionComposerHooks,
  type ComposerOutcome,
  type SeatLabelOptions,
} from '#game/resolution/ActionComposer.ts'
import {
  cardFaceFromId,
  type AllianceSupporterPilePick,
} from '#game/resolution/allianceActionComposer.ts'
import {
  optionFlowForSpec,
  type ActionOptionView,
  type OptionFlow,
  type OptionLabels,
  type OptionStep,
  type OptionValue,
} from '#game/resolution/optionActionFlows.ts'
import type { TurnBannerOption } from '#ui/TurnBanner.ts'

/** Banner value prefix that keeps a choice off the numeric count stepper. */
const CHOICE_VALUE_PREFIX = 'choice:'

type OptionDraft =
  | { type: 'idle' }
  | {
      type: 'optionAction'
      flow: OptionFlow
      /** Options still matching every field picked so far. */
      remaining: ActionOptionView[]
      chosen: ActionOptionView
      stepIndex: number
    }

type ActiveDraft = Extract<OptionDraft, { type: 'optionAction' }>

export type OptionComposerOptions = SeatLabelOptions & {
  /** Type of the pending event at the head of the queue, if any. */
  pendingType?: () => string | null
}

function distinctValues(
  options: readonly ActionOptionView[],
  field: string,
): OptionValue[] {
  const values: OptionValue[] = []
  for (const option of options) {
    const value = option[field]
    if (value !== undefined && !values.includes(value)) {
      values.push(value)
    }
  }
  return values
}

function formatWarriorCountLabel(count: number): string {
  return count === 1 ? '1 warrior' : `${String(count)} warriors`
}

/**
 * One composer for every action whose spec lists complete legal payloads in
 * `params.options`: the player picks one field at a time and the remaining
 * options narrow until a single payload is left.
 */
export function createOptionComposerHooks(options?: OptionComposerOptions): {
  hooks: ActionComposerHooks
  getDraft: () => OptionDraft
  getPromptOptions: () => TurnBannerOption[]
  getCardPilePick: () => AllianceSupporterPilePick | null
} {
  let draft: OptionDraft = { type: 'idle' }
  let promptOptions: TurnBannerOption[] = []
  let cardPilePick: AllianceSupporterPilePick | null = null

  const labels: OptionLabels = {
    seatName: (seat: number): string =>
      options?.factionNameForSeat?.(seat) ?? fallbackSeatLabel(seat),
  }

  const clear = (): void => {
    draft = { type: 'idle' }
    promptOptions = []
    cardPilePick = null
  }

  const promptFor = (
    active: ActiveDraft,
    step: OptionStep,
    values: readonly OptionValue[],
  ): ComposerOutcome => {
    promptOptions = []
    cardPilePick = null
    const message = `${active.flow.title} — ${step.prompt}`
    const cardIds = values.filter(
      (value: OptionValue): value is string => typeof value === 'string',
    )
    if (step.kind === 'pileCard') {
      cardPilePick = {
        title: step.prompt,
        cards: cardIds.map(cardFaceFromId),
        selectedCardIds: [],
      }
    }
    if (step.kind === 'count') {
      promptOptions = values.map(
        (value: OptionValue): TurnBannerOption => ({
          label: formatWarriorCountLabel(Number(value)),
          value: String(value),
        }),
      )
    }
    if (step.kind === 'choice') {
      promptOptions = values.map(
        (value: OptionValue, index: number): TurnBannerOption => ({
          label: step.label?.(value, labels) ?? String(value),
          value: `${CHOICE_VALUE_PREFIX}${String(index)}`,
        }),
      )
    }
    return {
      kind: 'incomplete',
      prompt: {
        message,
        highlightClearings:
          step.kind === 'clearing'
            ? values.filter(
                (value: OptionValue): value is number =>
                  typeof value === 'number',
              )
            : [],
        enabledCardIds: step.kind === 'card' ? cardIds : null,
        canConfirm: false,
        canCancel: active.flow.cancellable,
      },
    }
  }

  /** Move to the next field that still needs a pick, or finish. */
  const advance = (active: ActiveDraft): ComposerOutcome => {
    let current = active
    while (current.stepIndex < current.flow.steps.length) {
      const step = current.flow.steps[current.stepIndex]!
      const values = distinctValues(current.remaining, step.field)
      const onlyValue = values.length === 1 ? values[0] : undefined
      if (values.length === 0) {
        current = { ...current, stepIndex: current.stepIndex + 1 }
        continue
      }
      if (onlyValue !== undefined && current.flow.autoPickSingle) {
        current = {
          ...current,
          chosen: { ...current.chosen, [step.field]: onlyValue },
          stepIndex: current.stepIndex + 1,
        }
        continue
      }
      draft = current
      return promptFor(current, step, values)
    }
    const action = { type: current.flow.actionType, ...current.chosen }
    clear()
    return { kind: 'ready', action }
  }

  const choose = (
    kind: OptionStep['kind'],
    value: OptionValue,
  ): ComposerOutcome | null => {
    if (draft.type !== 'optionAction') return null
    const step = draft.flow.steps[draft.stepIndex]
    if (step === undefined || step.kind !== kind) return null
    const remaining = draft.remaining.filter(
      (option: ActionOptionView): boolean => option[step.field] === value,
    )
    if (remaining.length === 0) return null
    return advance({
      ...draft,
      remaining,
      chosen: { ...draft.chosen, [step.field]: value },
      stepIndex: draft.stepIndex + 1,
    })
  }

  const hooks: ActionComposerHooks = {
    begin: (spec: ActionSpec): ComposerOutcome | null => {
      const flow = optionFlowForSpec(spec, options?.pendingType?.() ?? null)
      if (flow === null || flow.options.length === 0) {
        clear()
        return null
      }
      return advance({
        type: 'optionAction',
        flow,
        remaining: flow.options,
        chosen: {},
        stepIndex: 0,
      })
    },

    chooseCard: (cardId: string): ComposerOutcome | null =>
      choose('card', cardId) ?? choose('pileCard', cardId),

    chooseClearing: (clearingId: number): ComposerOutcome | null =>
      choose('clearing', clearingId),

    chooseColumn: (value: string): ComposerOutcome | null => {
      if (draft.type !== 'optionAction') return null
      const step = draft.flow.steps[draft.stepIndex]
      if (step === undefined) return null
      if (step.kind === 'count') {
        const count = Number(value)
        return Number.isInteger(count) ? choose('count', count) : null
      }
      if (step.kind !== 'choice' || !value.startsWith(CHOICE_VALUE_PREFIX)) {
        return null
      }
      const index = Number(value.slice(CHOICE_VALUE_PREFIX.length))
      const picked = distinctValues(draft.remaining, step.field)[index]
      return picked === undefined ? null : choose('choice', picked)
    },

    cancel: (): ComposerOutcome | null => {
      if (draft.type !== 'optionAction') return null
      if (!draft.flow.cancellable) {
        const step = draft.flow.steps[draft.stepIndex]
        return step === undefined
          ? null
          : promptFor(draft, step, distinctValues(draft.remaining, step.field))
      }
      clear()
      return { kind: 'idle' }
    },
  }

  return {
    hooks,
    getDraft: (): OptionDraft => draft,
    getPromptOptions: (): TurnBannerOption[] => promptOptions,
    getCardPilePick: (): AllianceSupporterPilePick | null => cardPilePick,
  }
}
