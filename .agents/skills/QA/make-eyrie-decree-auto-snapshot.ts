/**
 * Eyrie Daylight Decree: bird + fox on recruit, one legal roost clearing.
 * Demo: medallion prefers non-bird; sole clearing auto-submits.
 *
 *   cd lib && pnpm exec tsx ../.cursor/skills/QA/make-eyrie-decree-auto-snapshot.ts
 *
 * Writes: tmp/qa/snapshots/eyrie-decree-auto.json
 */
import { writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Game } from '../../../lib/src/index.ts'
import { makeViziers } from '../../../lib/src/factions/eyrie/viziers.ts'
import { eyrieLeaderPools } from '../../../lib/src/state/boards.ts'

const skillDirectory = path.dirname(fileURLToPath(import.meta.url))
const rootDirectory = path.resolve(skillDirectory, '../../..')
const outDirectory = path.join(rootDirectory, 'tmp/qa/snapshots')
const OUT_NAME = 'eyrie-decree-auto.json'
const SEED = 20261014
const EYRIE_SEAT = 1
/** Rabbit corner keep → Eyrie roost on fox corner 0. */
const KEEP_CLEARING = 2
const WORKSHOP_CLEARING = 6
const RECRUITER_CLEARING = 10
/** Fox card on recruit: non-bird ahead of the Loyal Vizier (roost on 0). */
const FOX_CARD = { id: 'ROOT-72#qa-decree', defId: 'ROOT-72' } as const

const MAX_SETUP_EVENTS = 20
const STARTING_BUILDING_CLEARINGS: Readonly<Record<string, number>> = {
  sawmill: KEEP_CLEARING,
  workshop: WORKSHOP_CLEARING,
  recruiter: RECRUITER_CLEARING,
}

function finishSetup(game: Game): void {
  let guard = 0
  while (game.state.pending.length > 0 && guard++ < MAX_SETUP_EVENTS) {
    const event = game.state.pending[0]!
    if (event.type === 'chooseKeep') {
      game.apply({ type: 'resolveEvent', clearing: KEEP_CLEARING })
    } else if (event.type === 'placeStartingBuilding') {
      const clearing = STARTING_BUILDING_CLEARINGS[event.building]
      if (clearing === undefined) {
        throw new Error(`no clearing for ${event.building}`)
      }
      game.apply({ type: 'resolveEvent', clearing })
    } else if (event.type === 'chooseLeader') {
      game.apply({ type: 'resolveEvent', leader: 'builder' })
    } else {
      throw new Error(`setup pending: ${JSON.stringify(event)}`)
    }
  }
}

async function main(): Promise<void> {
  const game = Game.create({ seed: SEED })
  game.join('marquise')
  game.join('eyrie')
  game.start()
  finishSetup(game)

  const snap = game.toJSON()
  const [vizierRecruit, vizierMove] = makeViziers()
  const leaderPools = eyrieLeaderPools('builder')

  snap.state.currentSeat = EYRIE_SEAT
  snap.state.phase = 'daylight'
  snap.state.step = 'decree'
  snap.state.pending = []
  snap.state.turnScratch = {
    ...snap.state.turnScratch,
    actionsLeft: 0,
    extraActions: 0,
    decree: {
      column: 'recruit',
      remaining: [vizierRecruit.id, FOX_CARD.id],
    },
    decreeDone: false,
  }

  const eyrie = snap.state.players[EYRIE_SEAT]!
  eyrie.board = {
    kind: 'eyrie',
    supply: { warriors: 14 },
    leader: 'builder',
    leadersFaceUp: leaderPools.leadersFaceUp,
    leadersFaceDown: leaderPools.leadersFaceDown,
    decree: {
      // Bird first in column order; medallion must still prefer fox.
      recruit: [vizierRecruit, FOX_CARD],
      move: [vizierMove],
      battle: [],
      build: [],
    },
    roostTrack: { placed: 5 },
  }

  const restored = Game.fromJSON(snap)
  const decreeActions = restored
    .legalActions()
    .filter((spec) => spec.type === 'decree')
  if (decreeActions.length < 2) {
    throw new Error(
      `expected bird+fox recruit legal, got ${String(decreeActions.length)}: ${decreeActions
        .map((spec) => JSON.stringify(spec.params))
        .join(' | ')}`,
    )
  }

  await mkdir(outDirectory, { recursive: true })
  const filePath = path.join(outDirectory, OUT_NAME)
  await writeFile(filePath, `${JSON.stringify(restored.toJSON(), null, 2)}\n`, 'utf8')
  console.log(
    `${OUT_NAME}: seat=${String(restored.state.currentSeat)} ${restored.state.phase}/${restored.state.step} decreeActions=${String(decreeActions.length)}`,
  )
  console.log(`wrote ${filePath}`)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
