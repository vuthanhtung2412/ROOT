#!/usr/bin/env node
import { DEFAULT_ROOT_DEV_API_BASE_URL } from '@root/web-client'
import { ApiError } from '#api/client.js'
import { cmdAct } from '#commands/act.js'
import { cmdActions } from '#commands/actions.js'
import { cmdAuto } from '#commands/auto.js'
import { cmdJoin } from '#commands/join.js'
import { cmdLoad } from '#commands/load.js'
import { cmdLog } from '#commands/log.js'
import { cmdNew } from '#commands/new.js'
import { cmdShow } from '#commands/show.js'
import { cmdStart } from '#commands/start.js'
import { cmdUndo } from '#commands/undo.js'

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name)
  if (i < 0 || i + 1 >= args.length) return undefined
  return args[i + 1]
}

function usage(): void {
  console.error(`usage: root-cli <command> [options]

commands:
  new [--factions marquise,eyrie]
  join <playerId>
  start
  load <snapshot.json>
  show
  actions
  act '<json>'
  log
  undo
  auto [--turns 50] [--players 2] [--factions marquise,eyrie]
    (creates game, joins as faction names, starts — no manual lobby)

env: ROOT_DEV_API (default ${DEFAULT_ROOT_DEV_API_BASE_URL}; set in .mise.toml)`)
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
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
