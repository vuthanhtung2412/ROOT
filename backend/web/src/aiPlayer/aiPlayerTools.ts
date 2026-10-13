import { RuleError, type Action } from '@root/lib'
import { z } from 'zod'
import { previewAction } from '#aiPlayer/aiPlayerActionPreview.js'
import { buildActionReport } from '#aiPlayer/aiPlayerActionReport.js'
import { lookUpCardDetails } from '#aiPlayer/aiPlayerCardDetail.js'
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
import {
  formatPlayerGameView,
  formatPlayerLog,
  listPlayerLegalActions,
} from '#view/playerView.js'

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
export const PREVIEW_TOOL_NAME = 'preview'

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
        'The actions your seat may take right now. Each has a "type" and "params"; every param lists the values you may choose from. An empty list means you are waiting for another player.',
      inputJsonSchema: z.toJSONSchema(EmptyInputSchema),
    },
    run: (context) =>
      succeed(
        formatJson(listPlayerLegalActions(context.game, context.playerId)),
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
