import { z } from 'zod'
import type { Action } from '#actions/types.js'

/**
 * Shape only: text, number, flag and their nesting. Which text or number is
 * allowed (a column, a seat, a clearing) stays with the rule checks.
 */
export type ActionFieldSchema = z.core.$ZodType

export type ActionFieldSchemas = Readonly<Record<string, ActionFieldSchema>>

type ActionOfType<Type extends Action['type']> = Extract<Action, { type: Type }>

/** One entry per action type, one schema per field: a new action cannot skip it. */
type ActionFieldSchemaTable = {
  readonly [Type in Action['type']]: Readonly<
    Record<Exclude<keyof ActionOfType<Type>, 'type'>, ActionFieldSchema>
  >
}

const TEXT = z.string()
const NUMBER = z.number()
const FLAG = z.boolean()

const FEWEST_WARRIORS_MOVED = 1
/** Marquise and Lizard Cult: no faction has more warriors than this. */
const MOST_WARRIORS_OF_ANY_FACTION = 25
/** Warriors moved at once: a whole number, never zero. */
const WARRIOR_COUNT = z
  .int()
  .min(FEWEST_WARRIORS_MOVED)
  .max(MOST_WARRIORS_OF_ANY_FACTION)

/** Null counts as the field left out, as JSON clients often send it. */
function optional(value: z.ZodType): ActionFieldSchema {
  return value.nullish()
}

const MARCH_MOVES = z.array(
  z.object({ from: NUMBER, to: NUMBER, count: WARRIOR_COUNT }),
)
const DECREE_CARDS = z.array(z.object({ cardId: TEXT, column: TEXT }))
const VAGABOND_ITEMS = z.array(
  z.object({ type: TEXT, exhausted: FLAG, damaged: optional(FLAG) }),
)
/** A clearing id, or a forest written `forest:<index>`. */
const CLEARING_OR_FOREST = z.union([NUMBER, TEXT])

const NO_FIELDS = {} as const
const CARD_ONLY = { cardId: TEXT } as const
const TARGET_ONLY = { target: NUMBER } as const
const CLEARING_AND_DEFENDER = { clearing: NUMBER, defender: NUMBER } as const
const CLEARING_AND_SUPPORTERS = {
  clearing: NUMBER,
  supporterIds: z.array(TEXT),
} as const
const CARD_AND_CLEARING = { cardId: TEXT, clearing: NUMBER } as const
const MOVE_OF_WARRIORS = {
  from: NUMBER,
  to: NUMBER,
  count: WARRIOR_COUNT,
} as const
const SERVICE_COSTS = {
  handCard: NUMBER,
  riverboats: NUMBER,
  mercenaries: NUMBER,
} as const

export const ACTION_FIELD_SCHEMAS: ActionFieldSchemaTable = {
  join: { playerId: TEXT, faction: optional(TEXT) },
  expel: { seat: NUMBER },
  start: NO_FIELDS,
  birdsongWood: NO_FIELDS,
  eveningDraw: NO_FIELDS,
  emergencyOrders: NO_FIELDS,
  eveningScore: NO_FIELDS,
  endPhase: NO_FIELDS,
  spendBird: CARD_ONLY,
  recruit: NO_FIELDS,
  march: { moves: MARCH_MOVES },
  build: { clearing: NUMBER, building: TEXT, woodClearings: z.array(NUMBER) },
  overwork: CARD_AND_CLEARING,
  craft: CARD_ONLY,
  battle: CLEARING_AND_DEFENDER,
  swapMeet: TARGET_ONLY,
  charmOffensive: TARGET_ONLY,
  informantsTakeAmbush: CARD_ONLY,
  leagueMove: { itemIndex: NUMBER, ...MOVE_OF_WARRIORS },
  leagueBattle: { itemIndex: NUMBER, ...CLEARING_AND_DEFENDER },
  propagandaBureau: { ...CARD_AND_CLEARING, pieceId: TEXT },
  saboteurs: { target: NUMBER, cardId: TEXT },
  falseOrders: { target: NUMBER, from: NUMBER, to: NUMBER },
  eyrieEmigre: { ...MOVE_OF_WARRIORS, defender: optional(NUMBER) },
  discard: { cardIds: z.array(TEXT) },
  addToDecree: { cards: DECREE_CARDS },
  newRoost: { clearing: NUMBER },
  turmoil: NO_FIELDS,
  decree: {
    column: TEXT,
    cardId: TEXT,
    clearing: optional(NUMBER),
    defender: optional(NUMBER),
    moves: optional(MARCH_MOVES),
  },
  revolt: CLEARING_AND_SUPPORTERS,
  spreadSympathy: CLEARING_AND_SUPPORTERS,
  mobilize: { cardIds: z.array(TEXT) },
  train: CARD_ONLY,
  militaryOp: {
    op: TEXT,
    from: optional(NUMBER),
    to: optional(NUMBER),
    count: optional(WARRIOR_COUNT),
    clearing: optional(NUMBER),
    defender: optional(NUMBER),
  },
  slip: { to: CLEARING_OR_FOREST },
  vbMove: { to: NUMBER, allySeat: optional(NUMBER), allyCount: optional(NUMBER) },
  vbBattle: { defender: NUMBER, alliedSeat: optional(NUMBER) },
  explore: NO_FIELDS,
  quest: { questId: TEXT, reward: TEXT },
  aid: {
    target: NUMBER,
    cardId: TEXT,
    takeItem: optional(TEXT),
    costItem: optional(TEXT),
  },
  strike: { defender: NUMBER, pieceId: optional(TEXT) },
  repair: { itemIndex: NUMBER },
  vbCraft: CARD_ONLY,
  steal: TARGET_ONLY,
  dayLabor: CARD_ONLY,
  hideout: { items: VAGABOND_ITEMS },
  vbRearrange: { itemType: TEXT, from: TEXT },
  vbRemoveItems: { items: VAGABOND_ITEMS },
  takeDominance: CARD_ONLY,
  activateDominance: { cardId: TEXT, coalitionTarget: optional(NUMBER) },
  refresh: NO_FIELDS,
  rest: NO_FIELDS,
  adjustOutcast: NO_FIELDS,
  crusadeBattle: CLEARING_AND_DEFENDER,
  crusadeMove: MOVE_OF_WARRIORS,
  skipCrusadeBattle: NO_FIELDS,
  convert: { clearing: NUMBER, target: NUMBER },
  sanctify: { clearing: NUMBER, target: NUMBER, building: TEXT },
  ritualBuild: CARD_AND_CLEARING,
  ritualRecruit: CARD_AND_CLEARING,
  ritualScore: CARD_ONLY,
  ritualSacrifice: CARD_ONLY,
  returnRevealed: NO_FIELDS,
  gatherFunds: NO_FIELDS,
  riverfolkMove: { ...MOVE_OF_WARRIORS, fundOwner: NUMBER },
  riverfolkBattle: { ...CLEARING_AND_DEFENDER, fundOwner: NUMBER },
  riverfolkCraft: { cardId: TEXT, exportCard: FLAG },
  riverfolkDraw: { fundOwner: NUMBER },
  riverfolkRecruit: { clearing: NUMBER, fundOwner: NUMBER },
  establishTradePost: { clearing: NUMBER },
  setServiceCosts: SERVICE_COSTS,
  botStep: NO_FIELDS,
  revealOrder: CARD_ONLY,
  botCraft: CARD_ONLY,
  botRecruit: { clearing: NUMBER, count: NUMBER },
  botBuild: { clearing: NUMBER, building: TEXT },
  botMove: { from: NUMBER, to: NUMBER, count: NUMBER },
  botBattle: CLEARING_AND_DEFENDER,
  botTurmoil: NO_FIELDS,
  resolveEvent: {
    order: optional(z.array(NUMBER)),
    pieceIds: optional(z.array(TEXT)),
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

export function isActionType(type: string): type is Action['type'] {
  return Object.hasOwn(ACTION_FIELD_SCHEMAS, type)
}

/** The whole action of `type` as one object schema, `type` field included. */
export function actionSchema(type: Action['type']): z.ZodObject {
  return z.object({ type: z.literal(type), ...ACTION_FIELD_SCHEMAS[type] })
}
