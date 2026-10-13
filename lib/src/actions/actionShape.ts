import type { Action } from '#actions/types.js'
import { RuleError } from '#rules/RuleError.js'

/** What an action field may hold once it arrived as JSON from a client. */
export type ActionFieldValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | readonly ActionFieldValue[]
  | { readonly [fieldName: string]: ActionFieldValue }

/**
 * Shape only: text, number, flag and their nesting. Which text or number is
 * allowed (a column, a seat, a clearing) stays with the rule checks.
 */
type ValueShape =
  | { kind: 'text' }
  | { kind: 'number' }
  | { kind: 'flag' }
  | { kind: 'list'; item: ValueShape }
  | { kind: 'record'; fields: FieldShapes }
  | { kind: 'either'; shapes: readonly ValueShape[] }

type FieldShape = {
  value: ValueShape
  isRequired: boolean
}

type FieldShapes = Readonly<Record<string, FieldShape>>

type ActionOfType<Type extends Action['type']> = Extract<Action, { type: Type }>

/** One entry per action type, one shape per field: a new action cannot skip it. */
type ActionShapeTable = {
  readonly [Type in Action['type']]: Readonly<
    Record<Exclude<keyof ActionOfType<Type>, 'type'>, FieldShape>
  >
}

const TEXT: ValueShape = { kind: 'text' }
const NUMBER: ValueShape = { kind: 'number' }
const FLAG: ValueShape = { kind: 'flag' }

function listOf(item: ValueShape): ValueShape {
  return { kind: 'list', item }
}

function recordOf(fields: FieldShapes): ValueShape {
  return { kind: 'record', fields }
}

function required(value: ValueShape): FieldShape {
  return { value, isRequired: true }
}

function optional(value: ValueShape): FieldShape {
  return { value, isRequired: false }
}

const MARCH_MOVES: ValueShape = listOf(
  recordOf({
    from: required(NUMBER),
    to: required(NUMBER),
    count: required(NUMBER),
  }),
)
const DECREE_CARDS: ValueShape = listOf(
  recordOf({ cardId: required(TEXT), column: required(TEXT) }),
)
const VAGABOND_ITEMS: ValueShape = listOf(
  recordOf({
    type: required(TEXT),
    exhausted: required(FLAG),
    damaged: optional(FLAG),
  }),
)
/** A clearing id, or a forest written `forest:<index>`. */
const CLEARING_OR_FOREST: ValueShape = { kind: 'either', shapes: [NUMBER, TEXT] }

const NO_FIELDS = {} as const
const CARD_ONLY = { cardId: required(TEXT) } as const
const TARGET_ONLY = { target: required(NUMBER) } as const
const CLEARING_AND_DEFENDER = {
  clearing: required(NUMBER),
  defender: required(NUMBER),
} as const
const CLEARING_AND_SUPPORTERS = {
  clearing: required(NUMBER),
  supporterIds: required(listOf(TEXT)),
} as const
const CARD_AND_CLEARING = {
  cardId: required(TEXT),
  clearing: required(NUMBER),
} as const
const MOVE_OF_WARRIORS = {
  from: required(NUMBER),
  to: required(NUMBER),
  count: required(NUMBER),
} as const
const SERVICE_COSTS = {
  handCard: required(NUMBER),
  riverboats: required(NUMBER),
  mercenaries: required(NUMBER),
} as const

const ACTION_FIELD_SHAPES: ActionShapeTable = {
  join: { playerId: required(TEXT), faction: optional(TEXT) },
  expel: { seat: required(NUMBER) },
  start: NO_FIELDS,
  birdsongWood: NO_FIELDS,
  eveningDraw: NO_FIELDS,
  emergencyOrders: NO_FIELDS,
  eveningScore: NO_FIELDS,
  endPhase: NO_FIELDS,
  spendBird: CARD_ONLY,
  recruit: NO_FIELDS,
  march: { moves: required(MARCH_MOVES) },
  build: { clearing: required(NUMBER), building: required(TEXT) },
  overwork: CARD_AND_CLEARING,
  craft: CARD_ONLY,
  battle: CLEARING_AND_DEFENDER,
  swapMeet: TARGET_ONLY,
  charmOffensive: TARGET_ONLY,
  informantsTakeAmbush: CARD_ONLY,
  leagueMove: { itemIndex: required(NUMBER), ...MOVE_OF_WARRIORS },
  leagueBattle: { itemIndex: required(NUMBER), ...CLEARING_AND_DEFENDER },
  propagandaBureau: { ...CARD_AND_CLEARING, pieceId: required(TEXT) },
  saboteurs: { target: required(NUMBER), cardId: required(TEXT) },
  falseOrders: {
    target: required(NUMBER),
    from: required(NUMBER),
    to: required(NUMBER),
  },
  eyrieEmigre: { ...MOVE_OF_WARRIORS, defender: optional(NUMBER) },
  discard: { cardIds: required(listOf(TEXT)) },
  addToDecree: { cards: required(DECREE_CARDS) },
  newRoost: { clearing: required(NUMBER) },
  turmoil: NO_FIELDS,
  decree: {
    column: required(TEXT),
    cardId: required(TEXT),
    clearing: optional(NUMBER),
    defender: optional(NUMBER),
    moves: optional(MARCH_MOVES),
  },
  revolt: CLEARING_AND_SUPPORTERS,
  spreadSympathy: CLEARING_AND_SUPPORTERS,
  mobilize: { cardIds: required(listOf(TEXT)) },
  train: CARD_ONLY,
  militaryOp: {
    op: required(TEXT),
    from: optional(NUMBER),
    to: optional(NUMBER),
    count: optional(NUMBER),
    clearing: optional(NUMBER),
    defender: optional(NUMBER),
  },
  slip: { to: required(CLEARING_OR_FOREST) },
  vbMove: {
    to: required(NUMBER),
    allySeat: optional(NUMBER),
    allyCount: optional(NUMBER),
  },
  vbBattle: { defender: required(NUMBER), alliedSeat: optional(NUMBER) },
  explore: NO_FIELDS,
  quest: { questId: required(TEXT), reward: required(TEXT) },
  aid: {
    target: required(NUMBER),
    cardId: required(TEXT),
    takeItem: optional(TEXT),
    costItem: optional(TEXT),
  },
  strike: { defender: required(NUMBER), pieceId: optional(TEXT) },
  repair: { itemIndex: required(NUMBER) },
  vbCraft: CARD_ONLY,
  steal: TARGET_ONLY,
  dayLabor: CARD_ONLY,
  hideout: { items: required(VAGABOND_ITEMS) },
  vbRearrange: { itemType: required(TEXT), from: required(TEXT) },
  vbRemoveItems: { items: required(VAGABOND_ITEMS) },
  takeDominance: CARD_ONLY,
  activateDominance: {
    cardId: required(TEXT),
    coalitionTarget: optional(NUMBER),
  },
  refresh: NO_FIELDS,
  rest: NO_FIELDS,
  adjustOutcast: NO_FIELDS,
  crusadeBattle: CLEARING_AND_DEFENDER,
  crusadeMove: MOVE_OF_WARRIORS,
  skipCrusadeBattle: NO_FIELDS,
  convert: { clearing: required(NUMBER), target: required(NUMBER) },
  sanctify: {
    clearing: required(NUMBER),
    target: required(NUMBER),
    building: required(TEXT),
  },
  ritualBuild: CARD_AND_CLEARING,
  ritualRecruit: CARD_AND_CLEARING,
  ritualScore: CARD_ONLY,
  ritualSacrifice: CARD_ONLY,
  returnRevealed: NO_FIELDS,
  gatherFunds: NO_FIELDS,
  riverfolkMove: { ...MOVE_OF_WARRIORS, fundOwner: required(NUMBER) },
  riverfolkBattle: { ...CLEARING_AND_DEFENDER, fundOwner: required(NUMBER) },
  riverfolkCraft: { cardId: required(TEXT), exportCard: required(FLAG) },
  riverfolkDraw: { fundOwner: required(NUMBER) },
  riverfolkRecruit: {
    clearing: required(NUMBER),
    fundOwner: required(NUMBER),
  },
  establishTradePost: { clearing: required(NUMBER) },
  setServiceCosts: SERVICE_COSTS,
  resolveEvent: {
    order: optional(listOf(NUMBER)),
    pieceIds: optional(listOf(TEXT)),
    cardId: optional(TEXT),
    decline: optional(FLAG),
    useEffect: optional(FLAG),
    clearing: optional(NUMBER),
    leader: optional(TEXT),
    character: optional(TEXT),
    forest: optional(NUMBER),
    items: optional(VAGABOND_ITEMS),
    suit: optional(TEXT),
    handCard: optional(NUMBER),
    riverboats: optional(NUMBER),
    mercenaries: optional(NUMBER),
    service: optional(TEXT),
  },
}

const SHAPE_ALTERNATIVE_SEPARATOR = ' or '
const FIELD_SEPARATOR = ', '
const OPTIONAL_FIELD_MARK = '?'

function isRecord(
  value: ActionFieldValue,
): value is { readonly [fieldName: string]: ActionFieldValue } {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isAbsent(value: ActionFieldValue): value is null | undefined {
  return value === undefined || value === null
}

function describeShape(shape: ValueShape): string {
  switch (shape.kind) {
    case 'text':
      return 'text'
    case 'number':
      return 'number'
    case 'flag':
      return 'true or false'
    case 'list':
      return `list of ${describeShape(shape.item)}`
    case 'record':
      return `{${describeFields(shape.fields)}}`
    case 'either':
      return shape.shapes.map(describeShape).join(SHAPE_ALTERNATIVE_SEPARATOR)
  }
}

function describeFields(fields: FieldShapes): string {
  return Object.entries(fields)
    .map(
      ([fieldName, field]: [string, FieldShape]): string =>
        `${fieldName}${field.isRequired ? '' : OPTIONAL_FIELD_MARK}: ${describeShape(field.value)}`,
    )
    .join(FIELD_SEPARATOR)
}

function hasShape(value: ActionFieldValue, shape: ValueShape): boolean {
  switch (shape.kind) {
    case 'text':
      return typeof value === 'string'
    case 'number':
      return typeof value === 'number' && Number.isFinite(value)
    case 'flag':
      return typeof value === 'boolean'
    case 'list':
      return (
        Array.isArray(value) &&
        value.every((item: ActionFieldValue): boolean =>
          hasShape(item, shape.item),
        )
      )
    case 'record':
      return isRecord(value) && malformedFieldName(value, shape.fields) === null
    case 'either':
      return shape.shapes.some((alternative: ValueShape): boolean =>
        hasShape(value, alternative),
      )
  }
}

/** Name of the first field that is missing or holds the wrong kind of value. */
function malformedFieldName(
  fields: { readonly [fieldName: string]: ActionFieldValue },
  shapes: FieldShapes,
): string | null {
  for (const [fieldName, field] of Object.entries(shapes)) {
    const value: ActionFieldValue = fields[fieldName]
    if (isAbsent(value)) {
      if (field.isRequired) {
        return fieldName
      }
      continue
    }
    if (!hasShape(value, field.value)) {
      return fieldName
    }
  }
  return null
}

function isActionType(type: string): type is Action['type'] {
  return Object.hasOwn(ACTION_FIELD_SHAPES, type)
}

/**
 * The fields an action of `type` takes, as text: `{type: "discard", cardIds:
 * list of text}`. Null for a type the game does not know.
 *
 * `offeredFields` shortens an action of many optional fields (an answer to a
 * pending event) to the ones on offer; a required field is never left out.
 */
export function describeActionShape(
  type: string,
  offeredFields?: readonly string[],
): string | null {
  if (!isActionType(type)) {
    return null
  }
  const allFields: FieldShapes = ACTION_FIELD_SHAPES[type]
  const fields: string = describeFields(
    offeredFields === undefined
      ? allFields
      : Object.fromEntries(
          Object.entries(allFields).filter(
            ([fieldName, field]: [string, FieldShape]): boolean =>
              field.isRequired || offeredFields.includes(fieldName),
          ),
        ),
  )
  return fields === ''
    ? `{type: "${type}"}`
    : `{type: "${type}", ${fields}}`
}

/**
 * Throws `MALFORMED_ACTION` when a field of the action is missing or holds the
 * wrong kind of value, so the rule checks never read a field that is not there.
 * Actions come from clients as JSON: their static type promises nothing.
 */
export function assertActionShape(action: Action): void {
  if (!Object.hasOwn(ACTION_FIELD_SHAPES, action.type)) {
    throw new RuleError('MALFORMED_ACTION', { field: 'type', action })
  }
  const shapes: FieldShapes = ACTION_FIELD_SHAPES[action.type]
  const fields: { readonly [fieldName: string]: ActionFieldValue } = {
    ...action,
  }
  const field: string | null = malformedFieldName(fields, shapes)
  if (field === null) {
    return
  }
  throw new RuleError('MALFORMED_ACTION', {
    field,
    expected: `{type: "${action.type}", ${describeFields(shapes)}}`,
    action,
  })
}
