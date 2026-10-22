/**
 * Marquise daylight — last sawmill (Law cost 4 wood). Wood layout for the
 * spend prompt + greedy preselect:
 *   - build clearing: 2 wood
 *   - connected, margin 1: 1 wood
 *   - connected, margin 2: 2 wood
 *   - connected, margin 3: 1 wood
 *   - disconnected (not in the ruled chain): 1 wood (not offered)
 *
 *   cd lib && pnpm exec tsx ../.cursor/skills/QA/make-wood-spend-demo-snapshot.ts
 *   React → /?qaSnapshot=tmp/qa/snapshots/wood-spend-demo.json
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Game } from '../../../lib/src/index.ts'
import { createTurnScratch } from '../../../lib/src/state/turnScratch.ts'
import type { GameSnapshot } from '../../../lib/src/state/types.ts'
import type { Seat } from '../../../lib/src/pieces/types.ts'

const skillDirectory: string = path.dirname(fileURLToPath(import.meta.url))
const rootDirectory: string = path.resolve(skillDirectory, '../../..')
const outDirectory: string = path.join(rootDirectory, 'tmp/qa/snapshots')
const OUT_NAME = 'wood-spend-demo.json'
const SEED = 20261014
const SETUP_STEP_LIMIT = 60

type SnapshotPiece = GameSnapshot['state']['clearings'][number]['pieces'][number]

const MARQUISE: Seat = 0
const EYRIE: Seat = 1

/** Build here — open slots, cat rules, already holds 2 wood. */
const BUILD_CLEARING = 4
/** Connected via C1; cat 2 vs eyrie 1 → margin 1; 1 wood. */
const MARGIN_ONE_CLEARING = 5
/** Connected via C0; cat 2 alone → margin 2; 2 wood. */
const MARGIN_TWO_CLEARING = 8
/** Connected via C0; cat 3 alone → margin 3; 1 wood. */
const MARGIN_THREE_CLEARING = 9
/** Adjacent to C5 but eyrie-ruled → wood not in the pay chain. */
const DISCONNECTED_WOOD_CLEARING = 2
/** Bridge 4↔5. */
const BRIDGE_CLEARING = 1
/** Keep + hub to 4 / 8 / 9. */
const KEEP_CLEARING = 0

/** Last sawmill on the track: placed 1 → column 5 → MARQUISE_BUILD_COST[5] = 4. */
const SAWMILLS_LEFT_ON_TRACK = 1
const LAST_SAWMILL_WOOD_COST = 4

const SETUP_STEP_TYPES = new Set([
  'chooseKeep',
  'placeStartingBuilding',
  'chooseCultCorner',
])

function firstLegalClearing(game: Game): number {
  const clearings: readonly number[] | undefined =
    game.legalActions()[0]?.params?.clearing
  const clearing: number | undefined = clearings?.[0]
  if (clearing === undefined) {
    throw new Error(`no legal clearing: ${JSON.stringify(game.state.pending[0])}`)
  }
  return clearing
}

function finishSetup(game: Game): void {
  for (let step = 0; step < SETUP_STEP_LIMIT; step += 1) {
    const event = game.state.pending[0]
    if (event === undefined) return
    if (SETUP_STEP_TYPES.has(event.type)) {
      game.apply({ type: 'resolveEvent', clearing: firstLegalClearing(game) })
    } else if (event.type === 'chooseLeader') {
      game.apply({ type: 'resolveEvent', leader: 'charismatic' })
    } else {
      throw new Error(`setup pending: ${JSON.stringify(event)}`)
    }
  }
  throw new Error(`setup not finished: ${JSON.stringify(game.state.pending[0])}`)
}

let nextPieceNumber = 0

function pieceId(prefix: string): string {
  nextPieceNumber += 1
  return `${prefix}-${String(nextPieceNumber)}`
}

function warriors(owner: Seat, count: number): SnapshotPiece[] {
  return Array.from({ length: count }, () => ({
    id: pieceId(`w-${String(owner)}`),
    kind: 'warrior' as const,
    owner,
  }))
}

function woodTokens(count: number): SnapshotPiece[] {
  return Array.from({ length: count }, () => ({
    id: pieceId('wood'),
    kind: 'token' as const,
    type: 'wood' as const,
    owner: MARQUISE,
  }))
}

function sawmill(): SnapshotPiece {
  return {
    id: pieceId('saw'),
    kind: 'building',
    type: 'sawmill',
    owner: MARQUISE,
  }
}

function boardPieces(): Record<number, SnapshotPiece[]> {
  return {
    [KEEP_CLEARING]: [
      { id: pieceId('keep'), kind: 'token', type: 'keep', owner: MARQUISE },
      sawmill(),
      sawmill(),
      sawmill(),
      ...warriors(MARQUISE, 2),
    ],
    [BRIDGE_CLEARING]: [sawmill(), ...warriors(MARQUISE, 1)],
    // Build site: 2 wood already here; 2 warriors → margin 2; open slot.
    [BUILD_CLEARING]: [...warriors(MARQUISE, 2), ...woodTokens(2)],
    // Margin 1, 1 wood (warriors only — a building would raise the margin).
    [MARGIN_ONE_CLEARING]: [
      ...warriors(MARQUISE, 2),
      ...warriors(EYRIE, 1),
      ...woodTokens(1),
    ],
    // Margin 2, 2 wood.
    [MARGIN_TWO_CLEARING]: [sawmill(), ...warriors(MARQUISE, 2), ...woodTokens(2)],
    // Margin 3, 1 wood.
    [MARGIN_THREE_CLEARING]: [...warriors(MARQUISE, 3), ...woodTokens(1)],
    // Eyrie rules — Marquise wood here is not in the build pay chain.
    [DISCONNECTED_WOOD_CLEARING]: [
      { id: pieceId('roost'), kind: 'building', type: 'roost', owner: EYRIE },
      ...warriors(EYRIE, 2),
      ...woodTokens(1),
    ],
  }
}

function countPieces(
  pieces: Record<number, SnapshotPiece[]>,
  matches: (piece: SnapshotPiece) => boolean,
): number {
  return Object.values(pieces).reduce(
    (total: number, clearingPieces: SnapshotPiece[]): number =>
      total + clearingPieces.filter(matches).length,
    0,
  )
}

async function main(): Promise<void> {
  await mkdir(outDirectory, { recursive: true })
  const game: Game = Game.create({
    seed: SEED,
    factions: ['marquise', 'eyrie'],
  })
  game.join('marquise')
  game.join('eyrie')
  game.start()
  finishSetup(game)

  const snapshot: GameSnapshot = game.toJSON()
  const pieces: Record<number, SnapshotPiece[]> = boardPieces()
  snapshot.state.clearings.forEach((clearing, clearingId: number): void => {
    clearing.pieces = pieces[clearingId] ?? []
  })

  const marquise = snapshot.state.players[MARQUISE]?.board
  if (marquise?.kind !== 'marquise') {
    throw new Error('expected marquise board')
  }
  marquise.tracks.sawmill.placed = SAWMILLS_LEFT_ON_TRACK
  marquise.tracks.workshop.placed = 5
  marquise.tracks.recruiter.placed = 5
  const woodOnMap = countPieces(
    pieces,
    (piece) => piece.kind === 'token' && piece.type === 'wood',
  )
  const warriorsOnMap = countPieces(
    pieces,
    (piece) => piece.kind === 'warrior' && piece.owner === MARQUISE,
  )
  marquise.supply.wood = Math.max(0, 8 - woodOnMap)
  marquise.supply.warriors = Math.max(0, 25 - warriorsOnMap)

  snapshot.state.turn = 8
  snapshot.state.currentSeat = MARQUISE
  snapshot.state.phase = 'daylight'
  snapshot.state.step = 'actions'
  snapshot.state.pending = []
  snapshot.state.turnScratch = {
    ...createTurnScratch(),
    birdsongWoodDone: true,
    actionsLeft: 3,
  }

  const restored: Game = Game.fromJSON(snapshot)
  const buildSpec = restored.legalActions().find((spec) => spec.type === 'build')
  const sawmillAtBuild = (buildSpec?.params?.options ?? []).find(
    (option) =>
      'building' in option &&
      option.building === 'sawmill' &&
      option.clearing === BUILD_CLEARING,
  )
  const outPath: string = path.join(outDirectory, OUT_NAME)
  await writeFile(outPath, `${JSON.stringify(restored.toJSON(), null, 2)}\n`, 'utf8')
  console.log(
    JSON.stringify(
      {
        path: outPath,
        phase: `${restored.state.phase}/${restored.state.step}`,
        buildAt: BUILD_CLEARING,
        lastSawmillWoodCost: LAST_SAWMILL_WOOD_COST,
        note: 'Law last-column cost is 4 (not 5)',
        sawmillOption: sawmillAtBuild,
        legalActions: [
          ...new Set(restored.legalActions().map((spec) => spec.type)),
        ],
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
