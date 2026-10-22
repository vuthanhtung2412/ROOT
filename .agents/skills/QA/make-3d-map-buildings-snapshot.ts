/**
 * Every building of the 3D map on one board: Marquise, Eyrie, Woodland
 * Alliance and Lizard Cult, each with all of its buildings and tokens out.
 *
 *   Marquise  keep, sawmill, workshop, recruiter, wood
 *   Eyrie     roost
 *   Alliance  base (fox, mouse and rabbit), sympathy
 *   Lizard    garden (fox, mouse and rabbit)
 *   also      ruins, and clearings with empty building slots
 *
 * Marquise daylight, so the board can be played on from here. With
 * `--evening`: Marquise Evening discard (two cards over the limit) instead,
 * so the map waits at dusk with the campfires lit.
 *
 *   cd lib && pnpm exec tsx ../.agents/skills/QA/make-3d-map-buildings-snapshot.ts [--evening]
 *   React → /?qaSnapshot=tmp/qa/snapshots/3d-map-buildings.json
 *   React → /?qaSnapshot=tmp/qa/snapshots/3d-map-buildings-evening.json
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
const EVENING_FLAG = '--evening'
const IS_EVENING: boolean = process.argv.includes(EVENING_FLAG)
const OUT_NAME: string = IS_EVENING
  ? '3d-map-buildings-evening.json'
  : '3d-map-buildings.json'
/** Seven cards: two over the Evening hand limit of five. */
const EVENING_HAND_CARD_DEFINITION_IDS: readonly string[] = [
  'ROOT-72',
  'ROOT-57',
  'ROOT-205',
  'ROOT-204',
  'ROOT-81',
  'ROOT-71',
  'ROOT-73',
]
const SEED = 2026
const SETUP_STEP_LIMIT = 60

type SnapshotPiece = GameSnapshot['state']['clearings'][number]['pieces'][number]
type BuildingType = 'sawmill' | 'workshop' | 'recruiter' | 'roost' | 'base' | 'garden'
type TokenType = 'keep' | 'wood' | 'sympathy'

const MARQUISE: Seat = 0
const EYRIE: Seat = 1
const ALLIANCE: Seat = 2
const LIZARD: Seat = 3

const MARQUISE_BUILDINGS_PER_TRACK = 6
const MARQUISE_WARRIOR_COUNT = 25
const MARQUISE_WOOD_COUNT = 8
const EYRIE_ROOST_COUNT = 7
const EYRIE_WARRIOR_COUNT = 20
const ALLIANCE_WARRIOR_COUNT = 10
const ALLIANCE_SYMPATHY_COUNT = 10
const LIZARD_WARRIOR_COUNT = 25
const LIZARD_GARDENS_PER_SUIT = 5

/** First clearing the pending setup question accepts. */
function firstLegalClearing(game: Game): number {
  const clearings: readonly number[] | undefined =
    game.legalActions()[0]?.params?.clearing
  const clearing: number | undefined = clearings?.[0]
  if (clearing === undefined) {
    throw new Error(`no legal clearing: ${JSON.stringify(game.state.pending[0])}`)
  }
  return clearing
}

/** Answer every setup question; the map is rebuilt afterwards anyway. */
function finishSetup(game: Game): void {
  for (let step = 0; step < SETUP_STEP_LIMIT; step += 1) {
    const event = game.state.pending[0]
    if (event === undefined) {
      return
    }
    if (
      event.type === 'chooseKeep' ||
      event.type === 'placeStartingBuilding' ||
      event.type === 'chooseCultCorner'
    ) {
      game.apply({ type: 'resolveEvent', clearing: firstLegalClearing(game) })
    } else if (event.type === 'chooseLeader') {
      game.apply({ type: 'resolveEvent', leader: 'charismatic' })
    } else if (event.type === 'chooseOutcast') {
      game.apply({ type: 'resolveEvent', suit: 'mouse' })
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

function building(type: BuildingType, owner: Seat): SnapshotPiece {
  const id: string = pieceId(type)
  if (type === 'workshop' || type === 'roost' || type === 'garden') {
    return { id, kind: 'building', type, owner, used: false }
  }
  return { id, kind: 'building', type, owner }
}

function token(type: TokenType, owner: Seat): SnapshotPiece {
  return { id: pieceId(type), kind: 'token', type, owner }
}

function warriors(owner: Seat, count: number): SnapshotPiece[] {
  return Array.from(
    { length: count },
    (): SnapshotPiece => ({ id: pieceId('w'), kind: 'warrior', owner }),
  )
}

/**
 * The board, clearing by clearing (ids and slots of the Autumn map; a ruin
 * takes one slot). Suits: 0 fox, 1 mouse, 2 rabbit, 3 rabbit, 4 rabbit,
 * 5 fox, 6 mouse, 7 fox, 8 mouse, 9 rabbit, 10 mouse, 11 fox.
 */
function boardPieces(): Record<number, SnapshotPiece[]> {
  return {
    // The keep and its sawmill, with a pile of wood.
    0: [
      token('keep', MARQUISE),
      building('sawmill', MARQUISE),
      token('wood', MARQUISE),
      token('wood', MARQUISE),
      ...warriors(MARQUISE, 3),
    ],
    1: [building('roost', EYRIE), ...warriors(EYRIE, 3)],
    2: [
      building('base', ALLIANCE),
      token('sympathy', ALLIANCE),
      ...warriors(ALLIANCE, 2),
    ],
    3: [building('garden', LIZARD), ...warriors(LIZARD, 3)],
    4: [
      building('workshop', MARQUISE),
      building('recruiter', MARQUISE),
      ...warriors(MARQUISE, 2),
    ],
    // Ruin + fox garden.
    5: [building('garden', LIZARD), ...warriors(LIZARD, 2)],
    6: [
      building('base', ALLIANCE),
      building('roost', EYRIE),
      token('sympathy', ALLIANCE),
      ...warriors(ALLIANCE, 1),
      ...warriors(EYRIE, 2),
    ],
    7: [
      building('base', ALLIANCE),
      token('sympathy', ALLIANCE),
      ...warriors(ALLIANCE, 2),
    ],
    8: [
      building('roost', EYRIE),
      building('recruiter', MARQUISE),
      ...warriors(EYRIE, 2),
      ...warriors(MARQUISE, 1),
    ],
    // Ruin and one empty slot.
    9: [token('sympathy', ALLIANCE), ...warriors(MARQUISE, 1)],
    // Ruin + mouse garden + workshop: three faction colours side by side.
    10: [
      building('garden', LIZARD),
      building('workshop', MARQUISE),
      token('wood', MARQUISE),
      ...warriors(LIZARD, 2),
      ...warriors(MARQUISE, 2),
    ],
    // Ruin + sawmill.
    11: [
      building('sawmill', MARQUISE),
      token('wood', MARQUISE),
      ...warriors(MARQUISE, 2),
    ],
  }
}

function countOnMap(
  snapshot: GameSnapshot,
  matches: (piece: SnapshotPiece) => boolean,
): number {
  return snapshot.state.clearings.reduce(
    (count: number, clearing): number =>
      count + clearing.pieces.filter(matches).length,
    0,
  )
}

/** Make the faction boards agree with what stands on the map. */
function syncFactionBoards(snapshot: GameSnapshot): void {
  const warriorsOf = (owner: Seat): number =>
    countOnMap(
      snapshot,
      (piece: SnapshotPiece): boolean =>
        piece.kind === 'warrior' && piece.owner === owner,
    )
  const typed = (type: string): number =>
    countOnMap(
      snapshot,
      (piece: SnapshotPiece): boolean => 'type' in piece && piece.type === type,
    )
  const marquise = snapshot.state.players[MARQUISE]?.board
  if (marquise?.kind === 'marquise') {
    marquise.supply.warriors = MARQUISE_WARRIOR_COUNT - warriorsOf(MARQUISE)
    marquise.supply.wood = MARQUISE_WOOD_COUNT - typed('wood')
    marquise.tracks.sawmill.placed = MARQUISE_BUILDINGS_PER_TRACK - typed('sawmill')
    marquise.tracks.workshop.placed = MARQUISE_BUILDINGS_PER_TRACK - typed('workshop')
    marquise.tracks.recruiter.placed =
      MARQUISE_BUILDINGS_PER_TRACK - typed('recruiter')
  }
  const eyrie = snapshot.state.players[EYRIE]?.board
  if (eyrie?.kind === 'eyrie') {
    eyrie.supply.warriors = EYRIE_WARRIOR_COUNT - warriorsOf(EYRIE)
    eyrie.roostTrack.placed = EYRIE_ROOST_COUNT - typed('roost')
  }
  const alliance = snapshot.state.players[ALLIANCE]?.board
  if (alliance?.kind === 'alliance') {
    // Three bases out: their warriors that are not on the map are officers.
    alliance.bases = []
    alliance.officers = 3
    alliance.supply.warriors =
      ALLIANCE_WARRIOR_COUNT - warriorsOf(ALLIANCE) - alliance.officers
    alliance.sympathyTrack.placed = ALLIANCE_SYMPATHY_COUNT - typed('sympathy')
  }
  const lizard = snapshot.state.players[LIZARD]?.board
  if (lizard?.kind === 'lizard') {
    lizard.supply.warriors = LIZARD_WARRIOR_COUNT - warriorsOf(LIZARD)
    // One garden of each suit is on the map (clearings 3, 5 and 10).
    lizard.gardens = {
      fox: LIZARD_GARDENS_PER_SUIT - 1,
      rabbit: LIZARD_GARDENS_PER_SUIT - 1,
      mouse: LIZARD_GARDENS_PER_SUIT - 1,
    }
  }
}

async function main(): Promise<void> {
  await mkdir(outDirectory, { recursive: true })
  const game: Game = Game.create({
    seed: SEED,
    factions: ['marquise', 'eyrie', 'alliance', 'lizard'],
  })
  game.join('marquise')
  game.join('eyrie')
  game.join('alliance')
  game.join('lizard')
  game.start()
  finishSetup(game)

  const snapshot: GameSnapshot = game.toJSON()
  const pieces: Record<number, SnapshotPiece[]> = boardPieces()
  snapshot.state.clearings.forEach((clearing, clearingId: number): void => {
    clearing.pieces = pieces[clearingId] ?? []
  })
  syncFactionBoards(snapshot)
  snapshot.state.turn = 6
  snapshot.state.currentSeat = MARQUISE
  snapshot.state.phase = IS_EVENING ? 'evening' : 'daylight'
  snapshot.state.step = IS_EVENING ? 'discard' : 'actions'
  const marquisePlayer = snapshot.state.players[MARQUISE]
  if (IS_EVENING && marquisePlayer !== undefined) {
    // Over the hand limit: the discard waits for a pick, so dusk holds.
    marquisePlayer.hand = EVENING_HAND_CARD_DEFINITION_IDS.map(
      (defId: string, index: number) => ({ id: `evening-${String(index)}`, defId }),
    )
  }
  snapshot.state.pending = []
  snapshot.state.turnScratch = {
    ...createTurnScratch(),
    birdsongWoodDone: true,
    actionsLeft: IS_EVENING ? 0 : 3,
  }

  const restored: Game = Game.fromJSON(snapshot)
  const outPath: string = path.join(outDirectory, OUT_NAME)
  await writeFile(outPath, `${JSON.stringify(restored.toJSON(), null, 2)}\n`, 'utf8')
  const buildingsByType: Record<string, number> = {}
  for (const clearing of restored.state.clearings) {
    for (const piece of clearing.pieces) {
      if (piece.kind !== 'warrior' && 'type' in piece) {
        buildingsByType[piece.type] = (buildingsByType[piece.type] ?? 0) + 1
      }
    }
  }
  console.log(
    JSON.stringify(
      {
        path: outPath,
        factions: restored.state.factions,
        phase: `${restored.state.phase}/${restored.state.step}`,
        ruins: restored.state.clearings.flatMap((clearing, clearingId: number) =>
          clearing.ruin !== undefined ? [clearingId] : [],
        ),
        buildingsByType,
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
