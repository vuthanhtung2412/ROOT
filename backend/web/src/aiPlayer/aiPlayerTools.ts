import { RuleError, type Game } from '@root/lib'
import { z } from 'zod'
import { lookupRules, type RuleSection } from '#aiPlayer/rulebook.js'
import { logGameEvent } from '#debug/logGame.js'
import { isAction } from '#typeGuards.js'
import { mayPlayerSendAction } from '#view/actionSeatGuard.js'
import {
  formatPlayerGameView,
  formatPlayerLog,
  listPlayerLegalActions,
} from '#view/playerView.js'

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

export type AiPlayerToolResult = {
  content: string
  isError: boolean
  /** True when the call changed the game (an applied `act`). */
  appliedAction: boolean
}

/** Everything a tool may touch: one game, seen and played as one seat. */
export type AiPlayerToolContext = {
  game: Game
  playerId: string
  rulebook: readonly RuleSection[]
  /** Called after an applied action: save the slot, push it to viewers. */
  onGameChanged: () => void
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

const DEFAULT_LOG_ENTRY_LIMIT = 40
const MAXIMUM_LOG_ENTRY_LIMIT = 200
const JSON_INDENT_SPACES = 2

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

function succeed(content: string): AiPlayerToolResult {
  return { content, isError: false, appliedAction: false }
}

function fail(content: string): AiPlayerToolResult {
  return { content, isError: true, appliedAction: false }
}

function formatJson(value: object): string {
  return JSON.stringify(value, null, JSON_INDENT_SPACES)
}

function formatRuleSection(section: RuleSection): string {
  const heading =
    section.sectionNumber === null
      ? section.title
      : `${section.sectionNumber} ${section.title}`
  return section.text === '' ? heading : `${heading}\n${section.text}`
}

function runAct(
  context: AiPlayerToolContext,
  input: JsonValue,
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
    const result = context.game.apply(action)
    logGameEvent('ACT', result.state, action, result.log)
    context.onGameChanged()
    return {
      content: `Applied. ${formatPlayerLog(context.game, context.playerId, result.log.length)}`,
      isError: false,
      appliedAction: true,
    }
  } catch (error) {
    if (error instanceof RuleError) {
      return fail(
        `${error.code}: ${JSON.stringify(error.detail ?? null)}. The action was not applied.`,
      )
    }
    throw error
  }
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
      const sections = lookupRules(context.rulebook, parsed.data.query)
      if (sections.length === 0) {
        return succeed('No rule matches. Try a rule number or other keywords.')
      }
      return succeed(sections.map(formatRuleSection).join('\n\n'))
    },
  },
  {
    definition: {
      name: ACT_TOOL_NAME,
      description:
        'Take one action as your seat. It must come from the current legal actions. A rule error is returned without changing the game, so you can correct the action and try again.',
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
