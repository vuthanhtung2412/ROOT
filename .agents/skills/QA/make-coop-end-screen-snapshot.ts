/**
 * Co-op vs bots (Rootbotics 3.5.1): Alliance + Vagabond against Mechanical
 * Marquise + Electric Eyrie, setup done, both humans already at 30 VP. The
 * next action ends the game for the Woodland (end screen demo).
 *
 *   cd lib && pnpm exec tsx ../.agents/skills/QA/make-coop-end-screen-snapshot.ts
 *
 * Writes: tmp/qa/snapshots/coop-vs-bots-woodland-holds.json
 */
import { writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Game } from '../../../lib/src/index.ts'
import type { Action, ActionSpec } from '../../../lib/src/index.ts'

const skillDirectory = path.dirname(fileURLToPath(import.meta.url))
const rootDirectory = path.resolve(skillDirectory, '../../..')
const outDirectory = path.join(rootDirectory, 'tmp/qa/snapshots')
const OUT_NAME = 'coop-vs-bots-woodland-holds.json'
const SEED = 20261021
const MAX_SETUP_STEPS = 60
const HUMAN_VICTORY_POINTS = 30
const BOT_VICTORY_POINTS = 22

/** First legal answer of a setup choice. */
function firstAnswer(spec: ActionSpec): Action {
  const params: Record<string, readonly unknown[]> = (spec.params ?? {}) as Record<string, readonly unknown[]>
  const answer: Record<string, unknown> = { type: spec.type }
  if (params.clearing) answer.clearing = params.clearing[0]
  else if (params.forests) answer.forest = params.forests[0]
  else if (params.characters) answer.character = params.characters[0]
  else if (params.leaders) answer.leader = params.leaders[0]
  return answer as Action
}

async function main(): Promise<void> {
  const game: Game = Game.create({
    seed: SEED,
    factions: ['alliance', 'vagabond', 'mechanicalMarquise', 'electricEyrie'],
    cooperative: true,
  })
  game.join('alliance-player')
  game.join('vagabond-player')
  game.start()
  for (let step = 0; step < MAX_SETUP_STEPS && game.state.status !== 'playing'; step += 1) {
    if (game.botHasWork()) {
      game.stepBot()
      continue
    }
    const spec: ActionSpec | undefined = game.legalActions()[0]
    if (spec === undefined) throw new Error(`setup stuck: ${JSON.stringify(game.state.pending)}`)
    game.apply(firstAnswer(spec))
  }
  if (game.state.status !== 'playing') throw new Error('setup did not finish')
  const snapshot = game.toJSON()
  snapshot.state.players = snapshot.state.players.map((player) => ({
    ...player,
    vp: player.faction === 'alliance' || player.faction === 'vagabond'
      ? HUMAN_VICTORY_POINTS
      : BOT_VICTORY_POINTS,
  }))
  await mkdir(outDirectory, { recursive: true })
  const outPath = path.join(outDirectory, OUT_NAME)
  await writeFile(outPath, `${JSON.stringify(snapshot, null, 2)}\n`)
  console.log(`wrote ${outPath} · seat ${snapshot.state.currentSeat} to act · ${snapshot.state.phase}`)
}

main().catch((error: Error) => {
  console.error(error)
  process.exit(1)
})
