/**
 * 4p snapshot (Marquise/Eyrie/Alliance/Vagabond) for Frontend QA board videos.
 *
 *   pnpm --filter @root/lib exec tsx ../../.cursor/skills/QA/make-alliance-vagabond-snapshot.ts
 */
import { writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Game } from '../../../lib/src/index.ts'
import { FALL } from '../../../lib/src/map/fall.ts'

const skillDirectory = path.dirname(fileURLToPath(import.meta.url))
const rootDirectory = path.resolve(skillDirectory, '../../..')
const outDirectory = path.join(rootDirectory, 'tmp/qa/snapshots')

function resolveStartingBuildings(game: Game): void {
  while (game.state.pending[0]?.type === 'placeStartingBuilding') {
    const clearings = game.legalActions()[0]?.params?.clearing
    if (clearings === undefined || clearings.length === 0) {
      throw new Error('no legal starting building clearings')
    }
    game.apply({ type: 'resolveEvent', clearing: clearings[0]! })
  }
}

function finishSetup(game: Game): void {
  if (game.state.pending[0]?.type === 'chooseKeep') {
    game.apply({ type: 'resolveEvent', clearing: FALL.corners[0]! })
  }
  resolveStartingBuildings(game)
  if (game.state.pending[0]?.type === 'chooseLeader') {
    game.apply({ type: 'resolveEvent', leader: 'builder' })
  }
  if (game.state.pending.length > 0) {
    throw new Error(
      `setup still pending: ${JSON.stringify(game.state.pending[0])}`,
    )
  }
}

async function main(): Promise<void> {
  await mkdir(outDirectory, { recursive: true })
  const game = Game.create({ seed: 99 })
  game.join('marquise')
  game.join('eyrie')
  game.join('alliance')
  game.join('vagabond')
  game.start()
  finishSetup(game)

  // Advance Marquise birdsong wood → so UI is in a live turn (seat 0).
  if (game.state.phase === 'birdsong' && game.state.step === 'wood') {
    game.apply({ type: 'endPhase' })
  }

  const snapshot = game.toJSON()
  const filePath = path.join(outDirectory, 'alliance-vagabond-boards.json')
  await writeFile(filePath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8')

  const alliance = game.state.players.find((player) => player.faction === 'alliance')
  const vagabond = game.state.players.find((player) => player.faction === 'vagabond')
  console.log(
    JSON.stringify(
      {
        path: filePath,
        status: game.state.status,
        phase: `${game.state.phase}/${game.state.step}`,
        seat: game.state.currentSeat,
        alliance: {
          supporters: alliance?.board.kind === 'alliance'
            ? alliance.board.supporters.length
            : null,
          sympathyPlaced:
            alliance?.board.kind === 'alliance'
              ? alliance.board.sympathyTrack.placed
              : null,
          bases:
            alliance?.board.kind === 'alliance' ? alliance.board.bases : null,
        },
        vagabond: {
          satchel:
            vagabond?.board.kind === 'vagabond'
              ? vagabond.board.satchel.map((item) => item.type)
              : null,
          tea:
            vagabond?.board.kind === 'vagabond'
              ? vagabond.board.tracks.tea.length
              : null,
          forest:
            vagabond?.board.kind === 'vagabond' ? vagabond.board.forest : null,
        },
      },
      null,
      2,
    ),
  )
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
