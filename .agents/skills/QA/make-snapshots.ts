/**
 * Build GameSnapshots for Frontend QA videos: Marquise march, Eyrie turmoil.
 * Run from repo root:
 *   pnpm --filter @root/lib exec tsx ../../.cursor/skills/QA/make-snapshots.ts
 */
import { writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Game } from '@root/lib'
import { makeViziers } from '../../../lib/src/factions/eyrie/viziers.ts'
import { FALL } from '../../../lib/src/map/fall.ts'
import { eyrieLeaderPools } from '../../../lib/src/state/boards.ts'

const skillDirectory = path.dirname(fileURLToPath(import.meta.url))
const rootDirectory = path.resolve(skillDirectory, '../../..')
const outDirectory = path.join(rootDirectory, 'tmp/qa/snapshots')

function lobbyTwoPlaying(seed: number): Game {
  const game = Game.create({ seed })
  game.join('marquise')
  game.join('eyrie')
  game.start()
  game.apply({ type: 'resolveEvent', clearing: FALL.corners[0]! })
  game.apply({ type: 'resolveEvent', leader: 'builder' })
  return game
}

function advanceToActions(game: Game): void {
  if (game.state.phase === 'birdsong') {
    game.apply({ type: 'endPhase' })
  }
  if (game.state.step === 'craft') {
    game.apply({ type: 'endPhase' })
  }
}

async function writeSnapshot(name: string, game: Game): Promise<void> {
  const snapshot = game.toJSON()
  const filePath = path.join(outDirectory, name)
  await writeFile(filePath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8')
  const actions = game.legalActions().map((spec) => spec.type)
  console.log(
    `${name}: phase=${game.state.phase}/${game.state.step} seat=${String(game.state.currentSeat)} actions=${actions.join(',')}`,
  )
}

async function makeMarchSnapshot(): Promise<void> {
  const game = lobbyTwoPlaying(3)
  advanceToActions(game)
  const march = game.legalActions().find((spec) => spec.type === 'march')
  if (march === undefined) {
    throw new Error('expected march legal after advanceToActions')
  }
  await writeSnapshot('march-ready.json', game)
}

async function makeTurmoilSnapshot(): Promise<void> {
  const game = lobbyTwoPlaying(7)
  const snap = game.toJSON()
  const [vizierRecruit, vizierMove] = makeViziers()
  const foxCard = {
    id: 'ROOT-72#qa',
    defId: 'ROOT-72',
  }

  snap.state.currentSeat = 1
  snap.state.phase = 'daylight'
  snap.state.step = 'decree'
  snap.state.pending = []
  snap.state.turnScratch = {
    ...snap.state.turnScratch,
    actionsLeft: 0,
    extraActions: 0,
    decree: { column: 'battle', remaining: [foxCard.id] },
    decreeDone: false,
  }

  const eyrie = snap.state.players[1]!
  const leaderPools = eyrieLeaderPools('builder')
  eyrie.vp = 5
  eyrie.board = {
    kind: 'eyrie',
    supply: { warriors: 14 },
    leader: 'builder',
    leadersFaceUp: leaderPools.leadersFaceUp,
    leadersFaceDown: leaderPools.leadersFaceDown,
    decree: {
      recruit: [vizierRecruit],
      move: [vizierMove],
      battle: [foxCard],
      build: [],
    },
    roostTrack: { placed: 5 },
  }

  // Strip Eyrie warriors so battle decree cannot resolve (7.5.2 → turmoil).
  for (const clearing of snap.state.clearings) {
    clearing.pieces = clearing.pieces.filter(
      (piece) => !(piece.kind === 'warrior' && piece.owner === 1),
    )
  }

  const restored = Game.fromJSON(snap)
  const types = restored.legalActions().map((spec) => spec.type)
  if (!types.includes('turmoil')) {
    throw new Error(`expected turmoil legal, got: ${types.join(',')}`)
  }
  await writeSnapshot('turmoil-ready.json', restored)

  restored.apply({ type: 'turmoil' })
  if (restored.state.pending[0]?.type !== 'chooseLeader') {
    throw new Error(
      `expected chooseLeader after turmoil, got: ${JSON.stringify(restored.state.pending)}`,
    )
  }
  await writeSnapshot('turmoil-choose-leader.json', restored)
}

async function main(): Promise<void> {
  await mkdir(outDirectory, { recursive: true })
  await makeMarchSnapshot()
  await makeTurmoilSnapshot()
  console.log(`wrote snapshots under ${outDirectory}`)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
