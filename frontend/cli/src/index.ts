#!/usr/bin/env node
import { DEFAULT_ROOT_DEV_API_BASE_URL } from '@root/web-client'
import { ApiError, PLAYER_ID_FLAG } from '#api/client.js'
import { cmdAct } from '#commands/act.js'
import { cmdActions } from '#commands/actions.js'
import { cmdAiRestart } from '#commands/aiRestart.js'
import { cmdAiStream } from '#commands/aiStream.js'
import { cmdAuto } from '#commands/auto.js'
import { cmdJoin } from '#commands/join.js'
import { cmdLoad } from '#commands/load.js'
import { cmdLog } from '#commands/log.js'
import { cmdNew } from '#commands/new.js'
import { cmdPlayerTool, PLAYER_TOOL_COMMANDS } from '#commands/playerTool.js'
import { cmdRules } from '#commands/rules.js'
import { cmdShow } from '#commands/show.js'
import { cmdStart } from '#commands/start.js'
import { cmdUndo } from '#commands/undo.js'

const FULL_TEXT_FLAG = '--full'

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name)
  if (i < 0 || i + 1 >= args.length) return undefined
  return args[i + 1]
}

/** The flag is read by the API client; commands see the arguments without it. */
function withoutPlayerIdFlag(args: string[]): string[] {
  const flagIndex = args.indexOf(PLAYER_ID_FLAG)
  if (flagIndex < 0) return args
  return [...args.slice(0, flagIndex), ...args.slice(flagIndex + 2)]
}

function usage(): void {
  console.error(`usage: root-cli [--player-id <id>] <command> [options]

--player-id <id>: play one seat. show / actions / log hide the other hands
  and act is checked against that seat, also in a hotseat game.

commands:
  new [--factions marquise,eyrie]
  join <playerId>
  start
  load <snapshot.json>
  show
  actions
  act '<json>'
  log
  rules <rule number | keywords>
    (Law of Root lookup, e.g. rules 7.2 / rules ambush defender)
  card [cardId ...]
    (cards in full: cost, text, craftable now; no id = your hand)
  clearing <id>
    (one clearing: pieces, ruler, free slots, neighbors, can you build)
  score
    (standings: points, pieces on the map, your supply)
  workshops | sympathy | decree ['<json adding>']
    (your faction's plan: Marquise wood and buildings, Alliance sympathy,
     Eyrie Decree; decree takes [{"cardId": "...", "column": "move"}])
  preview '<json>'
    (dry run of an action: legal or not, what it would cause; applies nothing)
    card ... preview need --player-id: they answer for one seat
  ai-restart <seat>
    (drop the AI player's session, start a fresh one for its turn)
  ai-stream [${FULL_TEXT_FLAG}]
    (follow what the AI players are told, say and do; long texts are cut
     unless ${FULL_TEXT_FLAG}; keeps running, reconnects by itself)
  undo
  auto [--turns 50] [--players 2] [--factions marquise,eyrie]
    (creates game, joins as faction names, starts — no manual lobby)

env: ROOT_DEV_API (default ${DEFAULT_ROOT_DEV_API_BASE_URL}; set in .env)`)
}

async function main(): Promise<void> {
  const argv = withoutPlayerIdFlag(process.argv.slice(2))
  const base = argv[0] === '--' ? 1 : 0
  const cmd = argv[base]
  const rest = argv.slice(base + 1)
  if (!cmd) {
    usage()
    process.exit(1)
  }

  try {
    switch (cmd) {
      case 'new': {
        const raw = flag(rest, '--factions')
        const factions = raw?.split(',').map((s) => s.trim())
        await cmdNew(factions)
        break
      }
      case 'join':
        if (!rest[0]) throw new Error('playerId required')
        await cmdJoin(rest[0])
        break
      case 'start':
        await cmdStart()
        break
      case 'load':
        if (!rest[0]) throw new Error('snapshot.json path required')
        await cmdLoad(rest[0])
        break
      case 'show':
        await cmdShow()
        break
      case 'actions':
        await cmdActions()
        break
      case 'act':
        if (!rest[0]) throw new Error('action json required')
        await cmdAct(rest[0])
        break
      case 'log':
        await cmdLog()
        break
      case 'rules':
        if (rest.length === 0) throw new Error('rule number or keywords required')
        await cmdRules(rest.join(' '))
        break
      case 'ai-restart': {
        const seat = Number(rest[0])
        if (rest[0] === undefined || !Number.isInteger(seat)) {
          throw new Error('seat number required')
        }
        await cmdAiRestart(seat)
        break
      }
      case 'ai-stream':
        await cmdAiStream({ showFullText: rest.includes(FULL_TEXT_FLAG) })
        break
      case 'undo':
        await cmdUndo()
        break
      case 'auto': {
        const turns = Number(flag(rest, '--turns') ?? 50)
        const players = Number(flag(rest, '--players') ?? 2)
        const raw = flag(rest, '--factions')
        const factions = raw?.split(',').map((s) => s.trim())
        await cmdAuto(turns, players, factions)
        break
      }
      default:
        if (PLAYER_TOOL_COMMANDS.includes(cmd)) {
          await cmdPlayerTool(cmd, rest)
          break
        }
        usage()
        process.exit(1)
    }
  } catch (err) {
    if (err instanceof ApiError) {
      console.error(`${err.status} ${err.code}`, err.detail ?? '')
      process.exit(err.status >= 500 ? 1 : 2)
    }
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  }
}

main()
