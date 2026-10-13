import type { PlayerToolInput } from '@root/web-client/ai-player-api'
import { aiPlayerApi } from '#api/client.js'

/** Commands that run a read-only player tool, same names as the AI tools. */
export const PLAYER_TOOL_COMMANDS: readonly string[] = [
  'card',
  'clearing',
  'score',
  'workshops',
  'sympathy',
  'decree',
  'preview',
]

const TOOL_ERROR_EXIT_CODE = 2

function isToolInput(value: unknown): value is PlayerToolInput {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseJsonObject(text: string, what: string): PlayerToolInput {
  const parsed: unknown = JSON.parse(text)
  if (!isToolInput(parsed)) {
    throw new Error(`${what} must be a JSON object`)
  }
  return parsed
}

/** Turns the words after the command into the input its tool takes. */
export function buildPlayerToolInput(
  command: string,
  args: readonly string[],
): PlayerToolInput {
  switch (command) {
    case 'card':
      return args.length === 0 ? {} : { cards: [...args] }
    case 'clearing': {
      const clearing = Number(args[0])
      if (args[0] === undefined || !Number.isInteger(clearing)) {
        throw new Error('clearing id required')
      }
      return { clearing }
    }
    case 'decree': {
      if (args[0] === undefined) return {}
      const adding: unknown = JSON.parse(args[0])
      return { adding }
    }
    case 'preview':
      if (args[0] === undefined) throw new Error('action json required')
      return { action: parseJsonObject(args[0], 'action') }
    default:
      return {}
  }
}

/** Prints what the tool answers for the `--player-id` seat. */
export async function cmdPlayerTool(
  command: string,
  args: readonly string[],
): Promise<void> {
  const result = await aiPlayerApi.playerTool(
    command,
    buildPlayerToolInput(command, args),
  )
  if (result.isError) {
    console.error(result.content)
    process.exit(TOOL_ERROR_EXIT_CODE)
  }
  console.log(result.content)
}
