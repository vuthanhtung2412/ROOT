import { DECREE_COLUMNS, RuleError, type Action } from '@root/lib'
import { z } from 'zod'
import { previewAction } from '#aiPlayer/aiPlayerActionPreview.js'
import {
  buildActionReport,
  listDescribedLegalActions,
} from '#aiPlayer/aiPlayerActionReport.js'
import { lookUpCardDetails } from '#aiPlayer/aiPlayerCardDetail.js'
import { describeClearing } from '#aiPlayer/aiPlayerClearingDetail.js'
import { checkDecree } from '#aiPlayer/aiPlayerDecreeCheck.js'
import { forecastOwnFaction } from '#aiPlayer/aiPlayerFactionForecast.js'
import { buildStandings } from '#aiPlayer/aiPlayerStandings.js'
import {
  fail,
  formatJson,
  succeed,
  type AiPlayerToolContext,
  type AiPlayerToolResult,
} from '#aiPlayer/aiPlayerToolResult.js'
import { formatRuleLookup } from '#aiPlayer/rulebook.js'
import { logGameEvent } from '#debug/logGame.js'
import { isAction } from '#typeGuards.js'
import { mayPlayerSendAction } from '#view/actionSeatGuard.js'
import { formatPlayerGameView, formatPlayerLog } from '#view/playerView.js'

export type {
  AiPlayerToolContext,
  AiPlayerToolResult,
} from '#aiPlayer/aiPlayerToolResult.js'

/** JSON as it travels to and from a model. */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

/** Narrows a parsed model payload (typed `unknown` by the SDKs). */
export function isJsonValue(value: unknown): value is JsonValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return true
  }
  if (Array.isArray(value)) {
    return value.every(isJsonValue)
  }
  return typeof value === 'object' && Object.values(value).every(isJsonValue)
}

/** What a model is told about one tool. Same names as `root-cli` commands. */
export type AiPlayerToolDefinition = {
  name: string
  description: string
  inputJsonSchema: z.core.JSONSchema.BaseSchema
}

export type AiPlayerToolCall = {
  name: string
  input: JsonValue
}

type AiPlayerTool = {
  definition: AiPlayerToolDefinition
  run: (context: AiPlayerToolContext, input: JsonValue) => AiPlayerToolResult
}

export const SHOW_TOOL_NAME = 'show'
export const ACTIONS_TOOL_NAME = 'actions'
export const LOG_TOOL_NAME = 'log'
export const RULES_TOOL_NAME = 'rules'
export const ACT_TOOL_NAME = 'act'
export const CARD_TOOL_NAME = 'card'
export const CLEARING_TOOL_NAME = 'clearing'
export const DECREE_TOOL_NAME = 'decree'
export const PREVIEW_TOOL_NAME = 'preview'
export const SCORE_TOOL_NAME = 'score'
export const WORKSHOPS_TOOL_NAME = 'workshops'
export const SYMPATHY_TOOL_NAME = 'sympathy'

const DEFAULT_LOG_ENTRY_LIMIT = 40
const MAXIMUM_LOG_ENTRY_LIMIT = 200

const EmptyInputSchema = z.object({})

const LogInputSchema = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(MAXIMUM_LOG_ENTRY_LIMIT)
    .optional()
    .describe('How many of the latest log lines to return.'),
})

const CardInputSchema = z.object({
  cards: z
    .array(z.string())
    .optional()
    .describe(
      'Card ids such as "ROOT-224#1". Leave out for your whole hand. A card must be face up for you: your hand, crafted cards, the Decree, the discard pile.',
    ),
})

function runCard(
  context: AiPlayerToolContext,
  input: JsonValue,
): AiPlayerToolResult {
  const parsed = CardInputSchema.safeParse(input)
  if (!parsed.success) {
    return fail('Bad input: pass {} or {"cards": ["<card id>", ...]}.')
  }
  const lookup = lookUpCardDetails(
    context.game,
    context.playerId,
    parsed.data.cards ?? [],
  )
  if (lookup === null) {
    return fail('You hold no seat in this game.')
  }
  if (lookup.unknownCardIds.length > 0) {
    return fail(
      `No face-up card with id ${lookup.unknownCardIds.join(', ')}. Card ids are in "${SHOW_TOOL_NAME}" and "${ACTIONS_TOOL_NAME}".`,
    )
  }
  return succeed(formatJson(lookup.cards))
}

const RulesInputSchema = z.object({
  query: z
    .string()
    .min(1)
    .describe(
      'A rule number such as "7.2" (returns that rule and its sub-rules) or keywords such as "ambush defender".',
    ),
})

const ActInputSchema = z.object({
  action: z
    .object({ type: z.string() })
    .loose()
    .describe(
      'One action: "type" from a legal action, plus one value chosen from each of its params.',
    ),
})

const ClearingInputSchema = z.object({
  clearing: z.number().int().describe('Clearing id, as on the map: 0 to 11.'),
})

function runClearing(
  context: AiPlayerToolContext,
  input: JsonValue,
): AiPlayerToolResult {
  const parsed = ClearingInputSchema.safeParse(input)
  if (!parsed.success) {
    return fail('Bad input: pass {"clearing": <clearing id>}.')
  }
  const detail = describeClearing(
    context.game,
    context.playerId,
    parsed.data.clearing,
  )
  return detail === null
    ? fail(`No clearing ${String(parsed.data.clearing)} on this map.`)
    : succeed(formatJson(detail))
}

const DecreeInputSchema = z.object({
  adding: z
    .array(z.object({ cardId: z.string(), column: z.enum(DECREE_COLUMNS) }))
    .optional()
    .describe(
      'Hand cards to try in a column before you add them, in the shape "addToDecree" takes.',
    ),
})

function runDecree(
  context: AiPlayerToolContext,
  input: JsonValue,
): AiPlayerToolResult {
  const parsed = DecreeInputSchema.safeParse(input)
  if (!parsed.success) {
    return fail(
      'Bad input: pass {} or {"adding": [{"cardId": "<hand card id>", "column": "recruit" | "move" | "battle" | "build"}]}.',
    )
  }
  try {
    const check = checkDecree(
      context.game,
      context.playerId,
      parsed.data.adding ?? [],
    )
    return check === null
      ? fail('Only the Eyrie have a Decree.')
      : succeed(formatJson(check))
  } catch (error) {
    if (error instanceof RuleError) {
      return fail(`${error.code}: ${JSON.stringify(error.detail ?? null)}.`)
    }
    throw error
  }
}

/**
 * Shared by `act` and `preview`: reads the action, checks the seat, and turns
 * a failure of `run` into an error the model can correct.
 */
function runSeatAction(
  context: AiPlayerToolContext,
  input: JsonValue,
  run: (action: Action) => AiPlayerToolResult,
): AiPlayerToolResult {
  const parsed = ActInputSchema.safeParse(input)
  if (!parsed.success || !isAction(parsed.data.action)) {
    return fail('Bad input: pass {"action": {"type": "...", ...}}.')
  }
  const action = parsed.data.action
  if (!mayPlayerSendAction(context.game, context.playerId, action.type)) {
    return fail(
      `NOT_YOUR_SEAT: "${action.type}" is not a legal action of your seat now. Call "${ACTIONS_TOOL_NAME}".`,
    )
  }
  try {
    return run(action)
  } catch (error) {
    if (error instanceof RuleError) {
      return fail(
        `${error.code}: ${JSON.stringify(error.detail ?? null)}. The action was not applied.`,
      )
    }
    // Not a rule error: the engine itself failed. Its shape check
    // (`MALFORMED_ACTION`) should have caught the action first; the model may
    // still find another action, so the session lives.
    const reason: string = error instanceof Error ? error.message : String(error)
    console.error(`AI player action crashed the engine: ${reason}`)
    return fail(
      `ENGINE_ERROR: ${reason}. The action was not applied. Check the field names of ${JSON.stringify(action)} against "${ACTIONS_TOOL_NAME}".`,
    )
  }
}

function runAct(
  context: AiPlayerToolContext,
  input: JsonValue,
): AiPlayerToolResult {
  return runSeatAction(context, input, (action: Action): AiPlayerToolResult => {
    const result = context.game.apply(action)
    logGameEvent('ACT', result.state, action, result.log)
    context.onGameChanged()
    return {
      content: formatJson(
        buildActionReport({
          game: context.game,
          playerId: context.playerId,
          action,
          logEntryCount: result.log.length,
        }),
      ),
      isError: false,
      appliedAction: true,
    }
  })
}

function runPreview(
  context: AiPlayerToolContext,
  input: JsonValue,
): AiPlayerToolResult {
  return runSeatAction(
    context,
    input,
    (action: Action): AiPlayerToolResult =>
      succeed(
        formatJson(
          previewAction({
            game: context.game,
            playerId: context.playerId,
            action,
          }),
        ),
      ),
  )
}

const AI_PLAYER_TOOLS: readonly AiPlayerTool[] = [
  {
    definition: {
      name: SHOW_TOOL_NAME,
      description:
        'The current game as you see it at the table: turn and phase, every player (your hand in full, other hands as face-down cards), the map with pieces per clearing, paths, and pending events.',
      inputJsonSchema: z.toJSONSchema(EmptyInputSchema),
    },
    run: (context) =>
      succeed(formatPlayerGameView(context.game, context.playerId)),
  },
  {
    definition: {
      name: ACTIONS_TOOL_NAME,
      description:
        'The actions your seat may take right now. Each has a "type", "params" and a "shape"; every param lists the values you may choose from, and "shape" is the exact action to pass to "act" (a param named "cardIds" often fills a field named "cardId"). An empty list means you are waiting for another player.',
      inputJsonSchema: z.toJSONSchema(EmptyInputSchema),
    },
    run: (context) =>
      succeed(
        formatJson(listDescribedLegalActions(context.game, context.playerId)),
      ),
  },
  {
    definition: {
      name: LOG_TOOL_NAME,
      description:
        'The latest lines of the game log: what every player did, oldest first. Cards other players kept secret are hidden.',
      inputJsonSchema: z.toJSONSchema(LogInputSchema),
    },
    run: (context, input) => {
      const parsed = LogInputSchema.safeParse(input)
      if (!parsed.success) {
        return fail('Bad input: pass {} or {"limit": <number>}.')
      }
      return succeed(
        formatPlayerLog(
          context.game,
          context.playerId,
          parsed.data.limit ?? DEFAULT_LOG_ENTRY_LIMIT,
        ),
      )
    },
  },
  {
    definition: {
      name: RULES_TOOL_NAME,
      description:
        'Look up the Law of Root, the official rules. Use it before an action whose rules you are unsure about.',
      inputJsonSchema: z.toJSONSchema(RulesInputSchema),
    },
    run: (context, input) => {
      const parsed = RulesInputSchema.safeParse(input)
      if (!parsed.success) {
        return fail('Bad input: pass {"query": "<rule number or keywords>"}.')
      }
      return succeed(formatRuleLookup(context.rulebook, parsed.data.query))
    },
  },
  {
    definition: {
      name: CARD_TOOL_NAME,
      description:
        'Cards in full: suit, type, text, and for a craftable card its cost, what it gives, whether you can craft it right now ("craftableNow"), which cost suits your unused crafting pieces do not cover ("missing"), and the action types that may take the card right now ("legalUsesNow"). Call it with {} for your whole hand before you plan a turn.',
      inputJsonSchema: z.toJSONSchema(CardInputSchema),
    },
    run: runCard,
  },
  {
    definition: {
      name: CLEARING_TOOL_NAME,
      description:
        'One clearing in full: suit, building slots (total and free), ruin, who rules it, the pieces of every faction, the adjacent clearings with their suit and ruler, river links, and your legal action types that name this clearing right now. Use it instead of reading the drawn map.',
      inputJsonSchema: z.toJSONSchema(ClearingInputSchema),
    },
    run: runClearing,
  },
  {
    definition: {
      name: SCORE_TOOL_NAME,
      description:
        'The standings: the goal, and for every faction its victory points, points still needed, hand size, warriors, buildings and tokens on the map, crafted items, and the points it scores on its next turn without acting (Eyrie roosts, Riverfolk dividends). Also the pieces left in your supply. Use it to see who is ahead and to plan toward the goal.',
      inputJsonSchema: z.toJSONSchema(EmptyInputSchema),
    },
    run: (context) => {
      const standings = buildStandings(context.game, context.playerId)
      return standings === null
        ? fail('You hold no seat in this game.')
        : succeed(formatJson(standings))
    },
  },
  {
    definition: {
      name: WORKSHOPS_TOOL_NAME,
      description:
        'Marquise only. Your economy: wood in reach of each clearing you rule, what the next sawmill, workshop and recruiter cost in wood and score in victory points, the clearings where each can be built now, your unused workshops by suit (for crafting) and your recruiters.',
      inputJsonSchema: z.toJSONSchema(EmptyInputSchema),
    },
    run: (context) => {
      const forecast = forecastOwnFaction(
        context.game,
        context.playerId,
        'marquise',
      )
      return forecast === null
        ? fail('Only the Marquise have workshops and wood.')
        : succeed(formatJson(forecast))
    },
  },
  {
    definition: {
      name: SYMPATHY_TOOL_NAME,
      description:
        'Alliance only. Your sympathy plan: the cost and victory points of the next token, the clearings you may spread to with the supporters each costs (martial law counted) and whether you can pay, the clearings where you can revolt, and your supporters that match each suit.',
      inputJsonSchema: z.toJSONSchema(EmptyInputSchema),
    },
    run: (context) => {
      const forecast = forecastOwnFaction(
        context.game,
        context.playerId,
        'alliance',
      )
      return forecast === null
        ? fail('Only the Alliance spread sympathy.')
        : succeed(formatJson(forecast))
    },
  },
  {
    definition: {
      name: DECREE_TOOL_NAME,
      description:
        'Eyrie only. Your Decree card by card: whether each card can resolve on the map as it stands and in which clearings ("where"; for a move, the clearings to move from), what would send you into turmoil ("turmoilRisks"), which cards resolve only if the recruit column first places warriors for them ("dependsOnRecruit"), and the victory points turmoil costs. Pass "adding" to test hand cards in a column before "addToDecree". Use it instead of working out turmoil by hand.',
      inputJsonSchema: z.toJSONSchema(DecreeInputSchema),
    },
    run: runDecree,
  },
  {
    definition: {
      name: PREVIEW_TOOL_NAME,
      description:
        'Dry run of one action: same input as "act", nothing is applied. Answers whether the action is legal, what it would cause ("wouldLog") and which action types you could take after it. An illegal action returns the same error as "act". Dice are never rolled and no card is drawn: for a battle you get the warriors of both sides and the highest hits each side can roll. Use it before an action you cannot take back.',
      inputJsonSchema: z.toJSONSchema(ActInputSchema),
    },
    run: runPreview,
  },
  {
    definition: {
      name: ACT_TOOL_NAME,
      description:
        'Take one action as your seat. It must come from the current legal actions. The result holds what the action caused ("log"), the phase, and "legalActions": what you may do next, so there is no need to call "actions" after it. A rule error is returned without changing the game, so you can correct the action and try again.',
      inputJsonSchema: z.toJSONSchema(ActInputSchema),
    },
    run: runAct,
  },
]

/**
 * Tools that only read the game and have no `root-cli` command of their own
 * yet: one route serves them all to a player, human or not.
 */
export const READ_ONLY_PLAYER_TOOL_NAMES: readonly string[] = [
  CARD_TOOL_NAME,
  CLEARING_TOOL_NAME,
  SCORE_TOOL_NAME,
  WORKSHOPS_TOOL_NAME,
  SYMPATHY_TOOL_NAME,
  DECREE_TOOL_NAME,
  PREVIEW_TOOL_NAME,
]

export const AI_PLAYER_TOOL_DEFINITIONS: readonly AiPlayerToolDefinition[] =
  AI_PLAYER_TOOLS.map(
    (tool: AiPlayerTool): AiPlayerToolDefinition => tool.definition,
  )

export function runAiPlayerTool(
  context: AiPlayerToolContext,
  call: AiPlayerToolCall,
): AiPlayerToolResult {
  const tool = AI_PLAYER_TOOLS.find(
    (candidate: AiPlayerTool): boolean =>
      candidate.definition.name === call.name,
  )
  if (tool === undefined) {
    return fail(`Unknown tool "${call.name}".`)
  }
  return tool.run(context, call.input)
}
