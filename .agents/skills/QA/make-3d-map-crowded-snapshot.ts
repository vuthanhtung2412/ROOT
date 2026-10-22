/**
 * Very crowded 4p board for the 3D map: Marquise, Eyrie, Alliance, Vagabond.
 *
 * Starts from the busy UI snapshot and herds pieces into three clearings
 * until each holds everything a clearing can show at once: every building
 * slot taken, wood, sympathy, the keep, warriors of three factions and the
 * Vagabond pawn. No piece is added or removed, so component counts hold.
 *
 *   cd lib && pnpm exec tsx ../.agents/skills/QA/make-ui-busy-snapshot.ts
 *   cd lib && pnpm exec tsx ../.agents/skills/QA/make-3d-map-crowded-snapshot.ts
 *   React → /?qaSnapshot=tmp/qa/snapshots/3d-map-crowded.json
 */
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Game } from '../../../lib/src/index.ts'
import type { GameSnapshot } from '../../../lib/src/state/types.ts'

const skillDirectory: string = path.dirname(fileURLToPath(import.meta.url))
const rootDirectory: string = path.resolve(skillDirectory, '../../..')
const snapshotsDirectory: string = path.join(rootDirectory, 'tmp/qa/snapshots')
const SOURCE_NAME = 'ui-busy.json'
const OUT_NAME = '3d-map-crowded.json'

type SnapshotPiece = GameSnapshot['state']['clearings'][number]['pieces'][number]

/** Piece ids (from the busy snapshot) to herd into each crowded clearing. */
const PIECES_TO_MOVE_BY_CLEARING: Readonly<Record<number, readonly string[]>> = {
  // C0, the keep: wood, sympathy and warriors of all three armies around it.
  0: ['sympathy-9', 'w-e-4-0', 'w-e-9-0', 'w-a-9-0'],
  // C4: three buildings, wood, sympathy, three armies.
  4: ['sympathy-6', 'w-a-6-0', 'w-e-6-0'],
  // C10, the middle: ruin + base + roost fill the slots; then wood,
  // sympathy, three armies and the Vagabond pawn.
  10: [
    'roost-1',
    'wood-7a',
    'wood-7b',
    'w-m-7-0',
    'w-m-7-1',
    'w-e-1-0',
    'w-e-1-1',
    'w-a-2-0',
  ],
}

function takePiece(snapshot: GameSnapshot, pieceId: string): SnapshotPiece {
  for (const clearing of snapshot.state.clearings) {
    const piece: SnapshotPiece | undefined = clearing.pieces.find(
      (candidate: SnapshotPiece): boolean => candidate.id === pieceId,
    )
    if (piece !== undefined) {
      clearing.pieces = clearing.pieces.filter(
        (candidate: SnapshotPiece): boolean => candidate.id !== pieceId,
      )
      return piece
    }
  }
  throw new Error(`piece not on the map: ${pieceId}`)
}

async function main(): Promise<void> {
  const snapshot: GameSnapshot = Game.fromJSON(
    JSON.parse(
      await readFile(path.join(snapshotsDirectory, SOURCE_NAME), 'utf8'),
    ),
  ).toJSON()
  for (const [clearingId, pieceIds] of Object.entries(
    PIECES_TO_MOVE_BY_CLEARING,
  )) {
    const clearing = snapshot.state.clearings[Number(clearingId)]
    if (clearing === undefined) {
      throw new Error(`no clearing ${clearingId}`)
    }
    const moved: SnapshotPiece[] = pieceIds.map(
      (pieceId: string): SnapshotPiece => takePiece(snapshot, pieceId),
    )
    clearing.pieces = [...clearing.pieces, ...moved]
  }
  const restored: Game = Game.fromJSON(snapshot)
  const outPath: string = path.join(snapshotsDirectory, OUT_NAME)
  await writeFile(
    outPath,
    `${JSON.stringify(restored.toJSON(), null, 2)}\n`,
    'utf8',
  )
  console.log(
    JSON.stringify(
      {
        path: outPath,
        factions: restored.state.factions,
        phase: `${restored.state.phase}/${restored.state.step}`,
        piecesPerClearing: restored.state.clearings.map(
          (clearing): number => clearing.pieces.length,
        ),
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
