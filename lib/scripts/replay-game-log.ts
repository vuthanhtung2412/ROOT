/**
 * Rebuild a logged game as it stood after one of its events, as a snapshot the
 * web server can load. Dice and shuffles follow the logged seed.
 *
 * Run: pnpm --filter @root/lib replay:log <logs/…/game.json> [event seq]
 *   (no seq = last event; `seq` is the field of that name in game.json)
 * Then: pnpm --filter @root/cli start -- load <printed snapshot path>
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isLoggedGame, snapshotAtLoggedEvent } from '#game/replayEventLog.js'
import type { GameSnapshot } from '#state/snapshot.js'

const root: string = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const outDirectory: string = resolve(root, 'tmp/qa/snapshots')
/** pnpm runs the script from `lib/`; paths are given from where pnpm was called. */
const callerDirectory: string = process.env.INIT_CWD ?? process.cwd()

function main(): void {
  const logArgument: string | undefined = process.argv[2]
  if (logArgument === undefined) {
    throw new Error('usage: replay:log <logs/…/game.json> [event seq]')
  }
  const logPath: string = resolve(callerDirectory, logArgument)
  const parsed: unknown = JSON.parse(readFileSync(logPath, 'utf8'))
  if (!isLoggedGame(parsed)) {
    throw new Error(`not a game log: ${logPath}`)
  }
  const lastSeq: number = parsed.events.length - 1
  const seqArgument: string | undefined = process.argv[3]
  const untilSeq: number = seqArgument === undefined ? lastSeq : Number(seqArgument)
  if (!Number.isInteger(untilSeq)) {
    throw new Error(`event seq must be a whole number, got ${String(seqArgument)}`)
  }

  const snapshot: GameSnapshot = snapshotAtLoggedEvent(parsed, untilSeq)
  const logged = parsed.events[untilSeq]?.state
  const sameAsLogged: boolean =
    JSON.stringify({ ...snapshot.state, id: logged?.id }) === JSON.stringify(logged)

  mkdirSync(outDirectory, { recursive: true })
  const outPath: string = resolve(
    outDirectory,
    `replay-${basename(dirname(logPath))}-seq${String(untilSeq)}.json`,
  )
  writeFileSync(outPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8')

  console.log(`event ${String(untilSeq)} of ${String(lastSeq)} → ${outPath}`)
  console.log(
    sameAsLogged
      ? 'replayed state matches the logged state'
      : 'WARNING: replayed state differs from the logged state (rules changed since the log?)',
  )
}

main()
