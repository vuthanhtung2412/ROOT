import type { ActionSpec } from '#api/client.ts'
import { readChoiceParams } from '#game/resolution/ActionComposer.ts'

/** One complete legal payload of an action (every field but `type`). */
export type ActionOptionView = Record<string, string | number | boolean>

export type OptionValue = ActionOptionView[string]

/**
 * How the player picks one field of the payload:
 * hand card, card from a shown pile, clearing on the map, warrior count on
 * the stepper, or a labelled button. A `grid` step picks several fields at
 * once in one modal: a row of values per field, then Confirm.
 */
export type OptionStepKind =
  | 'card'
  | 'pileCard'
  | 'clearing'
  | 'count'
  | 'choice'
  | 'grid'

export type OptionStep = {
  field: string
  kind: OptionStepKind
  prompt: string
  /** Button text for a `choice` value; defaults to the value itself. */
  label?: (value: OptionValue, labels: OptionLabels) => string
  /** `grid`: the payload fields picked together, one row each. */
  gridFields?: readonly string[]
  /** `grid`: title of a field's row; defaults to the field name. */
  groupLabel?: (field: string) => string
  /** `grid`: value a row starts on; null starts on the row's first value. */
  initialValue?: (field: string, labels: OptionLabels) => OptionValue | null
}

export type OptionLabels = {
  seatName: (seat: number) => string
  /** Cost a Riverfolk service marker stands on; null when not known. */
  currentServiceCost: (service: string) => number | null
}

/** A staged action: its legal payloads and the order their fields are picked. */
export type OptionFlow = {
  actionType: string
  title: string
  steps: readonly OptionStep[]
  options: ActionOptionView[]
  cancellable: boolean
  /** Skip a step with a single possible value (off for setup placements). */
  autoPickSingle: boolean
}

type FlowDefinition = {
  title: string
  steps: readonly OptionStep[]
}

function seatLabel(value: OptionValue, labels: OptionLabels): string {
  return typeof value === 'number' ? labels.seatName(value) : String(value)
}

function fundLabel(value: OptionValue, labels: OptionLabels): string {
  return `${seatLabel(value, labels)} fund`
}

const SERVICE_LABELS: Readonly<Record<string, string>> = {
  handCard: 'Hand Card',
  riverboats: 'Riverboats',
  mercenaries: 'Mercenaries',
}

function serviceLabel(value: OptionValue): string {
  return SERVICE_LABELS[String(value)] ?? String(value)
}

/**
 * Rule: 11.6.2 Set Costs — one modal shows the Services track: a row of costs
 * per service, each starting on the cost its marker stands on.
 */
const SERVICE_COSTS_STEP: OptionStep = {
  field: 'serviceCosts',
  kind: 'grid',
  prompt: 'pick the cost of each service',
  gridFields: Object.keys(SERVICE_LABELS),
  groupLabel: serviceLabel,
  initialValue: (service: string, labels: OptionLabels): OptionValue | null =>
    labels.currentServiceCost(service),
}

const FROM_STEP: OptionStep = {
  field: 'from',
  kind: 'clearing',
  prompt: 'pick origin',
}
const TO_STEP: OptionStep = {
  field: 'to',
  kind: 'clearing',
  prompt: 'pick destination',
}
const COUNT_STEP: OptionStep = {
  field: 'count',
  kind: 'count',
  prompt: 'how many warriors?',
}
const CLEARING_STEP: OptionStep = {
  field: 'clearing',
  kind: 'clearing',
  prompt: 'pick clearing',
}
const CARD_STEP: OptionStep = {
  field: 'cardId',
  kind: 'card',
  prompt: 'pick card to reveal',
}
const DEFENDER_STEP: OptionStep = {
  field: 'defender',
  kind: 'choice',
  prompt: 'pick defender',
  label: seatLabel,
}
const TARGET_STEP: OptionStep = {
  field: 'target',
  kind: 'choice',
  prompt: 'pick enemy',
  label: seatLabel,
}
const FUND_STEP: OptionStep = {
  field: 'fundOwner',
  kind: 'choice',
  prompt: 'pick fund',
  label: fundLabel,
}

/** Turn actions of the Lizard Cult and the Riverfolk Company. */
const TURN_ACTION_FLOWS: Readonly<Record<string, FlowDefinition>> = {
  crusadeBattle: {
    title: 'Crusade battle',
    steps: [CLEARING_STEP, DEFENDER_STEP],
  },
  crusadeMove: {
    title: 'Crusade move',
    steps: [FROM_STEP, TO_STEP, COUNT_STEP],
  },
  convert: { title: 'Convert', steps: [CLEARING_STEP, TARGET_STEP] },
  sanctify: {
    title: 'Sanctify',
    steps: [
      CLEARING_STEP,
      TARGET_STEP,
      { field: 'building', kind: 'choice', prompt: 'pick building' },
    ],
  },
  ritualBuild: { title: 'Build garden', steps: [CARD_STEP, CLEARING_STEP] },
  ritualRecruit: { title: 'Recruit', steps: [CARD_STEP, CLEARING_STEP] },
  ritualScore: {
    title: 'Score',
    steps: [{ field: 'cardId', kind: 'card', prompt: 'pick card to spend' }],
  },
  ritualSacrifice: {
    title: 'Sacrifice',
    steps: [{ field: 'cardId', kind: 'card', prompt: 'pick bird card' }],
  },
  riverfolkMove: {
    title: 'Move',
    steps: [FROM_STEP, TO_STEP, COUNT_STEP, FUND_STEP],
  },
  riverfolkBattle: {
    title: 'Battle',
    steps: [CLEARING_STEP, DEFENDER_STEP, FUND_STEP],
  },
  riverfolkCraft: {
    title: 'Craft',
    steps: [
      { field: 'cardId', kind: 'card', prompt: 'pick card' },
      {
        field: 'exportCard',
        kind: 'choice',
        prompt: 'craft or export?',
        label: (value: OptionValue): string =>
          value === true ? 'Export (warrior to Payments)' : 'Craft',
      },
    ],
  },
  riverfolkDraw: { title: 'Draw', steps: [FUND_STEP] },
  riverfolkRecruit: { title: 'Recruit', steps: [CLEARING_STEP, FUND_STEP] },
  establishTradePost: { title: 'Trade post', steps: [CLEARING_STEP] },
  setServiceCosts: {
    title: 'Set costs',
    steps: [SERVICE_COSTS_STEP],
  },
}

export const OPTION_ACTION_TYPES: readonly string[] =
  Object.keys(TURN_ACTION_FLOWS)

const RESOLVE_EVENT_TYPE = 'resolveEvent'

function isActionOptionView(value: unknown): value is ActionOptionView {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }
  return Object.values(value).every(
    (entry: unknown): boolean =>
      typeof entry === 'string' ||
      typeof entry === 'number' ||
      typeof entry === 'boolean',
  )
}

function optionsOf(spec: ActionSpec): ActionOptionView[] {
  return (readChoiceParams(spec).options ?? []).filter(isActionOptionView)
}

function rawList(spec: ActionSpec, field: string): unknown[] {
  const raw: unknown = spec.params === undefined ? undefined : spec.params[field]
  return Array.isArray(raw) ? raw : []
}

function isOptionValue(value: unknown): value is OptionValue {
  return (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  )
}

function singleFieldOptions(
  spec: ActionSpec,
  paramField: string,
  actionField: string,
): ActionOptionView[] {
  return rawList(spec, paramField)
    .filter(isOptionValue)
    .map((value: OptionValue): ActionOptionView => ({ [actionField]: value }))
}

function setupFlow(
  title: string,
  step: OptionStep,
  options: ActionOptionView[],
): OptionFlow {
  return {
    actionType: RESOLVE_EVENT_TYPE,
    title,
    steps: [step],
    options,
    cancellable: false,
    autoPickSingle: false,
  }
}

/** Pending events of the two factions, answered with a `resolveEvent`. */
function resolveEventFlow(
  spec: ActionSpec,
  pendingType: string | null,
): OptionFlow | null {
  if (pendingType === 'chooseCultCorner') {
    return setupFlow(
      'Lizard Cult',
      { field: 'clearing', kind: 'clearing', prompt: 'choose starting corner' },
      singleFieldOptions(spec, 'clearing', 'clearing'),
    )
  }
  if (pendingType === 'placeRiverfolkWarrior') {
    return setupFlow(
      'Riverfolk Company',
      {
        field: 'clearing',
        kind: 'clearing',
        prompt: 'place a warrior on the river',
      },
      singleFieldOptions(spec, 'clearing', 'clearing'),
    )
  }
  if (pendingType === 'chooseOutcast') {
    return setupFlow(
      'Lizard Cult',
      { field: 'suit', kind: 'choice', prompt: 'choose the Outcast suit' },
      singleFieldOptions(spec, 'suits', 'suit'),
    )
  }
  if (pendingType === 'setStartingCost') {
    const service = rawList(spec, 'services')[0]
    return setupFlow(
      'Riverfolk Company',
      {
        field: 'cost',
        kind: 'choice',
        prompt: `starting cost of ${serviceLabel(String(service))}`,
        label: (value: OptionValue): string => `Cost ${String(value)}`,
      },
      singleFieldOptions(spec, 'costs', 'cost'),
    )
  }
  if (pendingType === 'buyServices') {
    const options = optionsOf(spec)
    if (options.length === 0) return null
    return {
      actionType: RESOLVE_EVENT_TYPE,
      title: 'Riverfolk services',
      steps: [
        {
          field: 'service',
          kind: 'choice',
          prompt: 'pick a service to buy',
          label: serviceLabel,
        },
        {
          field: 'cardId',
          kind: 'pileCard',
          prompt: 'Take a card from the Riverfolk hand',
        },
      ],
      options,
      cancellable: true,
      autoPickSingle: false,
    }
  }
  return null
}

/** The staged flow for a spec, or null when another composer owns it. */
export function optionFlowForSpec(
  spec: ActionSpec,
  pendingType: string | null,
): OptionFlow | null {
  if (spec.type === RESOLVE_EVENT_TYPE) {
    return resolveEventFlow(spec, pendingType)
  }
  const definition = TURN_ACTION_FLOWS[spec.type]
  if (definition === undefined) return null
  const options = optionsOf(spec)
  if (options.length === 0) return null
  return {
    actionType: spec.type,
    title: definition.title,
    steps: definition.steps,
    options,
    cancellable: true,
    autoPickSingle: true,
  }
}
