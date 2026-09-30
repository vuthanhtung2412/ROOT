/**
 * One loaded state for WA+VB continuous QA sequence.
 *
 * From repo:
 *   cd lib && pnpm exec tsx ../.cursor/skills/QA/make-wa-vb-qa-run.ts
 *
 * Writes: tmp/qa/snapshots/wa-vb-qa-run.json
 * Steps: resources/notes/QA-plan-woodland-vagabond.md
 */
import { writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Game } from '../../../lib/src/index.ts'
import { FALL } from '../../../lib/src/map/fall.ts'
import { createTurnScratch } from '../../../lib/src/state/turnScratch.ts'
import type { GameSnapshot } from '../../../lib/src/state/types.ts'
import type { Piece } from '../../../lib/src/pieces/types.ts'

const skillDirectory = path.dirname(fileURLToPath(import.meta.url))
const rootDirectory = path.resolve(skillDirectory, '../../..')
const outDirectory = path.join(rootDirectory, 'tmp/qa/snapshots')
const OUT_NAME = 'wa-vb-qa-run.json'

/** Board layout (Fall suits): 0 fox, 3 rabbit, 5 fox, 6 mouse, 7 fox, 11 fox. */
const KEEP_CLEARING = 1 // mouse — keep off fox revolt targets (0/5/7/11)
const REVOLT_CLEARING = 7
const MARTIAL_LAW_CLEARING = 3
const MULTI_ENEMY_CLEARING = 6
const CAT_MARCH_FROM = 4
const ORGANIZE_CLEARING = 8
const EXPLORE_CLEARING = 5

const ALLIANCE_SEAT = 2
const VAGABOND_SEAT = 3
const MARQUISE_SEAT = 0
const EYRIE_SEAT = 1

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
    game.apply({ type: 'resolveEvent', clearing: KEEP_CLEARING })
  }
  resolveStartingBuildings(game)
  if (game.state.pending[0]?.type === 'chooseLeader') {
    game.apply({ type: 'resolveEvent', leader: 'builder' })
  }
  if (game.state.pending[0]?.type === 'chooseForest') {
    game.apply({ type: 'resolveEvent', forest: FALL.vagabondForest })
  }
  if (game.state.pending.length > 0) {
    throw new Error(`setup pending: ${JSON.stringify(game.state.pending[0])}`)
  }
}

function createFourPlayerGame(seed: number): Game {
  const game = Game.create({ seed })
  game.join('marquise')
  game.join('eyrie')
  game.join('alliance')
  game.join('vagabond')
  game.start()
  finishSetup(game)
  return game
}

function forceSeatPhase(
  snap: GameSnapshot,
  seat: number,
  phase: GameSnapshot['state']['phase'],
  step: GameSnapshot['state']['step'],
): void {
  snap.state.currentSeat = seat
  snap.state.phase = phase
  snap.state.step = step
  snap.state.pending = []
  snap.state.turnScratch = {
    ...createTurnScratch(),
    ...snap.state.turnScratch,
  }
}

function clearClearingPieces(snap: GameSnapshot, clearingId: number): void {
  snap.state.clearings[clearingId]!.pieces = []
}

function addPieces(snap: GameSnapshot, clearingId: number, pieces: Piece[]): void {
  const clearing = snap.state.clearings[clearingId]!
  clearing.pieces = [...clearing.pieces, ...pieces]
}

function placeSympathy(
  snap: GameSnapshot,
  clearingId: number,
  allianceSeat: number,
): void {
  const alliance = snap.state.players[allianceSeat]!
  if (alliance.board.kind !== 'alliance') {
    throw new Error('expected alliance board')
  }
  alliance.board.sympathyTrack.placed = Math.max(
    0,
    alliance.board.sympathyTrack.placed - 1,
  )
  addPieces(snap, clearingId, [
    {
      id: `sympathy-qa-${String(clearingId)}`,
      kind: 'token',
      type: 'sympathy',
      owner: allianceSeat,
    },
  ])
}

function removeAllPawns(snap: GameSnapshot, vagabondSeat: number): void {
  for (const clearing of snap.state.clearings) {
    clearing.pieces = clearing.pieces.filter(
      (piece) =>
        !(piece.kind === 'pawn' && piece.owner === vagabondSeat),
    )
  }
}

function placeVagabondPawn(
  snap: GameSnapshot,
  vagabondSeat: number,
  clearingId: number,
): void {
  const vagabond = snap.state.players[vagabondSeat]!
  if (vagabond.board.kind !== 'vagabond') {
    throw new Error('expected vagabond board')
  }
  vagabond.board.forest = null
  removeAllPawns(snap, vagabondSeat)
  addPieces(snap, clearingId, [
    { id: `pawn-${String(vagabondSeat)}`, kind: 'pawn', owner: vagabondSeat },
  ])
}

type VagabondItemType =
  | 'boot'
  | 'torch'
  | 'sword'
  | 'hammer'
  | 'crossbow'
  | 'tea'
  | 'coin'
  | 'bag'

function item(
  type: VagabondItemType,
  exhausted: boolean,
): { type: VagabondItemType; exhausted: boolean } {
  return { type, exhausted }
}

async function main(): Promise<void> {
  await mkdir(outDirectory, { recursive: true })
  const game = createFourPlayerGame(20260930)
  const snap = game.toJSON()

  forceSeatPhase(snap, ALLIANCE_SEAT, 'birdsong', 'revolt')

  // --- Strip crowded setup pieces from key clearings, keep keep on 0 ---
  for (const clearingId of [
    REVOLT_CLEARING,
    MARTIAL_LAW_CLEARING,
    MULTI_ENEMY_CLEARING,
    CAT_MARCH_FROM,
    ORGANIZE_CLEARING,
    EXPLORE_CLEARING,
    KEEP_CLEARING,
  ]) {
    const keepPieces = snap.state.clearings[clearingId]!.pieces.filter(
      (piece) => piece.type === 'keep',
    )
    clearClearingPieces(snap, clearingId)
    snap.state.clearings[clearingId]!.pieces = keepPieces
  }

  const alliance = snap.state.players[ALLIANCE_SEAT]!
  if (alliance.board.kind !== 'alliance') {
    throw new Error('alliance board missing')
  }
  alliance.board.officers = 3
  alliance.board.bases = ['fox', 'rabbit', 'mouse']
  alliance.board.sympathyTrack.placed = 10
  alliance.board.supporters = [
    { id: 'ROOT-202#r1', defId: 'ROOT-202' }, // fox revolt
    { id: 'ROOT-202#r2', defId: 'ROOT-202' }, // fox revolt
    { id: 'ROOT-201#ml1', defId: 'ROOT-201' }, // rabbit ML
    { id: 'ROOT-201#ml2', defId: 'ROOT-201' }, // rabbit ML
    { id: 'ROOT-201#ml3', defId: 'ROOT-201' }, // rabbit ML
    { id: 'ROOT-200#b1', defId: 'ROOT-200' }, // bird spare
    { id: 'ROOT-203#m1', defId: 'ROOT-203' }, // mouse spare
  ]
  alliance.hand = [
    { id: 'ROOT-202#train', defId: 'ROOT-202' }, // fox — Train after revolt
    { id: 'ROOT-204#craft', defId: 'ROOT-204' }, // Anvil fox hammer craft
    { id: 'ROOT-203#mob', defId: 'ROOT-203' }, // Mobilize
  ]

  // Sympathy: fox 5,7,11 + mouse 1 (keep) + fox/rabbit? need adj for Outrage into 0
  // Cost band: 4 on map → next index 4 cost 2 (+1 ML = 3 rabbit)
  placeSympathy(snap, KEEP_CLEARING, ALLIANCE_SEAT) // 1 mouse
  placeSympathy(snap, EXPLORE_CLEARING, ALLIANCE_SEAT) // 5 fox
  placeSympathy(snap, REVOLT_CLEARING, ALLIANCE_SEAT) // 7 fox
  placeSympathy(snap, 11, ALLIANCE_SEAT) // 11 fox
  placeSympathy(snap, KEEP_CLEARING === 0 ? 9 : 0, ALLIANCE_SEAT) // 0 fox — Outrage destination


  // Revolt target 7: Cat warriors + wood (VP) + VB pawn
  addPieces(snap, REVOLT_CLEARING, [
    { id: 'w-cat-revolt-1', kind: 'warrior', owner: MARQUISE_SEAT },
    { id: 'w-cat-revolt-2', kind: 'warrior', owner: MARQUISE_SEAT },
    { id: 'wood-revolt', kind: 'token', type: 'wood', owner: MARQUISE_SEAT },
  ])
  placeVagabondPawn(snap, VAGABOND_SEAT, REVOLT_CLEARING)

  // Martial Law target 3 (adj 7): ≥3 Cat warriors
  addPieces(snap, MARTIAL_LAW_CLEARING, [
    { id: 'w-cat-ml-1', kind: 'warrior', owner: MARQUISE_SEAT },
    { id: 'w-cat-ml-2', kind: 'warrior', owner: MARQUISE_SEAT },
    { id: 'w-cat-ml-3', kind: 'warrior', owner: MARQUISE_SEAT },
  ])

  // Multi-enemy battle 6 (adj 7): WA + Cat + Eyrie
  addPieces(snap, MULTI_ENEMY_CLEARING, [
    { id: 'w-wa-multi', kind: 'warrior', owner: ALLIANCE_SEAT },
    { id: 'w-cat-multi', kind: 'warrior', owner: MARQUISE_SEAT },
    { id: 'w-eyrie-multi', kind: 'warrior', owner: EYRIE_SEAT },
  ])

  // Organize: WA warrior on unsympathetic mouse clearing 8
  addPieces(snap, ORGANIZE_CLEARING, [
    { id: 'w-wa-organize', kind: 'warrior', owner: ALLIANCE_SEAT },
  ])

  // Cat march-from 4 → into sympathy 0 (Outrage later)
  addPieces(snap, CAT_MARCH_FROM, [
    { id: 'w-cat-march-1', kind: 'warrior', owner: MARQUISE_SEAT },
    { id: 'w-cat-march-2', kind: 'warrior', owner: MARQUISE_SEAT },
  ])

  // Two-item ruin on fox 5 for Explore V1/V2 (after VB moves there)
  // + 1 Cat warrior for Hostile battle/Infamy after Explore
  snap.state.clearings[EXPLORE_CLEARING]!.ruin = {
    items: ['boot', 'hammer'],
  }
  addPieces(snap, EXPLORE_CLEARING, [
    { id: 'w-cat-hostile', kind: 'warrior', owner: MARQUISE_SEAT },
  ])

  // Cat hand: fox for Field Hospitals on 7; rabbit for Outrage on 0 path
  snap.state.players[MARQUISE_SEAT]!.hand = [
    { id: 'ROOT-202#fh', defId: 'ROOT-202' },
    { id: 'ROOT-201#outr', defId: 'ROOT-201' },
    { id: 'ROOT-200#bird', defId: 'ROOT-200' },
  ]

  // Eyrie: crafted item for Aid take (optional)
  snap.state.players[EYRIE_SEAT]!.hand = [
    { id: 'ROOT-203#eyrie', defId: 'ROOT-203' },
  ]
  snap.state.players[EYRIE_SEAT]!.craftedItems = [
    { type: 'boot', exhausted: false },
  ]

  const vagabond = snap.state.players[VAGABOND_SEAT]!
  if (vagabond.board.kind !== 'vagabond') {
    throw new Error('vagabond board missing')
  }
  // Extra undamaged items so revolt damage-3 still leaves quest/explore kit
  vagabond.board.satchel = [
    item('boot', false),
    item('boot', true), // exhausted → Refresh visible
    item('torch', false),
    item('torch', false),
    item('sword', false),
    item('sword', false),
    item('hammer', false),
    item('hammer', false),
    item('crossbow', false),
  ]
  vagabond.board.tracks = {
    tea: [item('tea', false), item('tea', false)],
    coin: [item('coin', false)],
    bag: [item('bag', false)],
  }
  vagabond.board.damaged = []
  vagabond.board.completedQuests = []
  vagabond.board.relationships = {
    marquise: 'hostile',
    eyrie: 0,
    alliance: 0,
    vagabond: 0,
  }
  vagabond.hand = [
    { id: 'ROOT-202#aid', defId: 'ROOT-202' }, // fox — Aid while on fox clearing
    { id: 'ROOT-204#vb-craft', defId: 'ROOT-204' }, // Anvil
    { id: 'ROOT-203#vb-spare', defId: 'ROOT-203' },
  ]

  // Face-up quests: fox shed (hammer+torch) matches revolt/explore fox clearings
  snap.state.questsAvailable = [
    { id: 'QUEST-F-SHED#1', defId: 'QUEST-F-SHED' },
    { id: 'QUEST-M-GUARD#1', defId: 'QUEST-M-GUARD' },
    { id: 'QUEST-R-ERRAND#1', defId: 'QUEST-R-ERRAND' },
  ]

  const restored = Game.fromJSON(snap)
  const legal = restored.legalActions().map((spec) => spec.type)
  const outPath = path.join(outDirectory, OUT_NAME)
  await writeFile(outPath, `${JSON.stringify(restored.toJSON(), null, 2)}\n`, 'utf8')
  console.log(
    JSON.stringify(
      {
        path: outPath,
        phase: `${restored.state.phase}/${restored.state.step}`,
        seat: restored.state.currentSeat,
        legal,
        revoltClearing: REVOLT_CLEARING,
        martialLawClearing: MARTIAL_LAW_CLEARING,
        multiEnemyClearing: MULTI_ENEMY_CLEARING,
        exploreClearing: EXPLORE_CLEARING,
        plan: 'resources/notes/QA-plan-woodland-vagabond.md',
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
