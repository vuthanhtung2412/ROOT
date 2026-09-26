/**
 * Busy 4p UI QA snapshot — crowded map, full boards, items, cards.
 *
 *   cd lib && pnpm exec tsx ../.cursor/skills/QA/make-ui-busy-snapshot.ts
 *   pnpm --filter @root/cli start -- load <abs-path>/tmp/qa/snapshots/ui-busy.json
 *   React → Continue loaded game
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Game } from '../../../lib/src/index.ts'
import { FALL } from '../../../lib/src/map/fall.ts'
import { createTurnScratch } from '../../../lib/src/state/turnScratch.ts'
import type { GameSnapshot } from '../../../lib/src/state/types.ts'
import type { ItemType, Seat } from '../../../lib/src/pieces/types.ts'

const skillDirectory = path.dirname(fileURLToPath(import.meta.url))
const rootDirectory = path.resolve(skillDirectory, '../../..')
const outDirectory = path.join(rootDirectory, 'tmp/qa/snapshots')
const OUT_NAME = 'ui-busy.json'

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
    game.apply({ type: 'resolveEvent', leader: 'charismatic' })
  }
  if (game.state.pending.length > 0) {
    throw new Error(`setup pending: ${JSON.stringify(game.state.pending[0])}`)
  }
}

function item(type: ItemType, exhausted = false): { type: ItemType; exhausted: boolean } {
  return { type, exhausted }
}

function pushPieces(
  snap: GameSnapshot,
  clearingId: number,
  pieces: GameSnapshot['state']['clearings'][number]['pieces'],
): void {
  const clearing = snap.state.clearings[clearingId]!
  clearing.pieces = [...clearing.pieces, ...pieces]
}

function enrichBusyUi(snap: GameSnapshot): void {
  const marquise = 0 as Seat
  const eyrie = 1 as Seat
  const alliance = 2 as Seat
  const vagabond = 3 as Seat

  snap.state.turn = 8
  snap.state.currentSeat = vagabond
  snap.state.phase = 'daylight'
  snap.state.step = 'actions'
  snap.state.pending = []
  snap.state.turnScratch = {
    ...createTurnScratch(),
    birdsongWoodDone: true,
    slipDone: true,
    actionsLeft: 3,
  }
  snap.state.winner = undefined

  // Scores + hands + crafted for every seat.
  snap.state.players[marquise]!.vp = 12
  snap.state.players[eyrie]!.vp = 9
  snap.state.players[alliance]!.vp = 14
  snap.state.players[vagabond]!.vp = 7

  snap.state.players[marquise]!.hand = [
    { id: 'ROOT-79#m1', defId: 'ROOT-79' },
    { id: 'ROOT-72#m2', defId: 'ROOT-72' },
    { id: 'ROOT-108#m3', defId: 'ROOT-108' },
    { id: 'ROOT-103#m4', defId: 'ROOT-103' },
  ]
  snap.state.players[eyrie]!.hand = [
    { id: 'ROOT-72#e1', defId: 'ROOT-72' },
    { id: 'ROOT-84#e2', defId: 'ROOT-84' },
    { id: 'ROOT-203#e3', defId: 'ROOT-203' },
  ]
  snap.state.players[alliance]!.hand = [
    { id: 'ROOT-201#a1', defId: 'ROOT-201' },
    { id: 'ROOT-202#a2', defId: 'ROOT-202' },
    { id: 'ROOT-200#a3', defId: 'ROOT-200' },
    { id: 'ROOT-88#a4', defId: 'ROOT-88' },
  ]
  snap.state.players[vagabond]!.hand = [
    { id: 'ROOT-211#v1', defId: 'ROOT-211' },
    { id: 'ROOT-202#v2', defId: 'ROOT-202' },
    { id: 'ROOT-64#v3', defId: 'ROOT-64' },
  ]

  snap.state.players[marquise]!.playArea = [
    { id: 'ROOT-64#craft1', defId: 'ROOT-64' },
  ]
  snap.state.players[marquise]!.craftedItems = [
    item('bag'),
    item('coin'),
  ]
  snap.state.players[eyrie]!.craftedItems = [item('hammer')]
  snap.state.players[alliance]!.playArea = [
    { id: 'ROOT-225#craft2', defId: 'ROOT-225' },
  ]

  // Discard pile so gallery has content.
  snap.state.deck.discard = [
    { id: 'ROOT-57#d1', defId: 'ROOT-57' },
    { id: 'ROOT-59#d2', defId: 'ROOT-59' },
    { id: 'ROOT-62#d3', defId: 'ROOT-62' },
    { id: 'ROOT-71#d4', defId: 'ROOT-71' },
    { id: 'ROOT-81#d5', defId: 'ROOT-81' },
  ]

  // --- Marquise board ---
  // tracks.*.placed = buildings still ON TRACK (6 slots; setup leaves 5).
  const marquiseBoard = snap.state.players[marquise]!.board
  if (marquiseBoard.kind === 'marquise') {
    marquiseBoard.supply.warriors = 8
    marquiseBoard.supply.wood = 3
    marquiseBoard.tracks.sawmill.placed = 3 // 3 on map
    marquiseBoard.tracks.workshop.placed = 4 // 2 on map
    marquiseBoard.tracks.recruiter.placed = 3 // 3 on map
  }

  // --- Eyrie board ---
  // roostTrack.placed = roosts still ON TRACK (7 slots).
  const eyrieBoard = snap.state.players[eyrie]!.board
  if (eyrieBoard.kind === 'eyrie') {
    eyrieBoard.supply.warriors = 6
    eyrieBoard.leader = 'charismatic'
    eyrieBoard.roostTrack.placed = 3 // 4 roosts on map
    eyrieBoard.decree = {
      recruit: [
        { id: 'ROOT-72#dr1', defId: 'ROOT-72' },
        { id: 'ROOT-203#dr2', defId: 'ROOT-203' },
      ],
      move: [{ id: 'ROOT-84#dm1', defId: 'ROOT-84' }],
      battle: [
        { id: 'ROOT-72#db1', defId: 'ROOT-72' },
        { id: 'ROOT-213#db2', defId: 'ROOT-213' },
      ],
      build: [{ id: 'ROOT-88#dbu1', defId: 'ROOT-88' }],
    }
  }

  // --- Alliance board ---
  // sympathyTrack.placed = tokens still ON TRACK (10 slots).
  const allianceBoard = snap.state.players[alliance]!.board
  if (allianceBoard.kind === 'alliance') {
    allianceBoard.supply.warriors = 2
    allianceBoard.officers = 3
    allianceBoard.bases = ['mouse'] // fox+rabbit on map
    allianceBoard.sympathyTrack.placed = 5 // 5 on map
    allianceBoard.supporters = [
      { id: 'ROOT-202#s1', defId: 'ROOT-202' },
      { id: 'ROOT-202#s2', defId: 'ROOT-202' },
      { id: 'ROOT-201#s3', defId: 'ROOT-201' },
      { id: 'ROOT-200#s4', defId: 'ROOT-200' },
      { id: 'ROOT-202#s5', defId: 'ROOT-202' },
      { id: 'ROOT-201#s6', defId: 'ROOT-201' },
    ]
  }

  // --- Vagabond board (busy pack) ---
  const vagabondBoard = snap.state.players[vagabond]!.board
  if (vagabondBoard.kind === 'vagabond') {
    vagabondBoard.forest = null
    vagabondBoard.satchel = [
      item('boot'),
      item('boot', true),
      item('torch'),
      item('sword'),
      item('sword', true),
      item('hammer'),
      item('crossbow'),
    ]
    vagabondBoard.tracks.tea = [item('tea'), item('tea', true)]
    vagabondBoard.tracks.coin = [item('coin')]
    vagabondBoard.tracks.bag = [item('bag'), item('bag')]
    vagabondBoard.damaged = [item('boot'), item('sword')]
    vagabondBoard.relationships = {
      marquise: 'hostile',
      eyrie: 2,
      alliance: 3,
      vagabond: 0,
    }
  }

  // Clear map pieces then rebuild a crowded board (keep ruins).
  for (const clearing of snap.state.clearings) {
    clearing.pieces = clearing.pieces.filter(
      (piece) => piece.kind !== 'warrior' && piece.kind !== 'building' && piece.kind !== 'token' && piece.kind !== 'pawn',
    )
  }

  // Keep at NW (C0) + warriors + sawmill + wood
  pushPieces(snap, 0, [
    { id: 'keep', kind: 'token', type: 'keep', owner: marquise },
    { id: 'sawmill-0', kind: 'building', type: 'sawmill', owner: marquise },
    { id: 'wood-0a', kind: 'token', type: 'wood', owner: marquise },
    { id: 'wood-0b', kind: 'token', type: 'wood', owner: marquise },
    { id: 'w-m-0a', kind: 'warrior', owner: marquise },
    { id: 'w-m-0b', kind: 'warrior', owner: marquise },
    { id: 'w-m-0c', kind: 'warrior', owner: marquise },
  ])

  // C4 — workshop + recruiter + cats
  pushPieces(snap, 4, [
    { id: 'workshop-4', kind: 'building', type: 'workshop', owner: marquise, used: false },
    { id: 'recruiter-4', kind: 'building', type: 'recruiter', owner: marquise },
    { id: 'w-m-4a', kind: 'warrior', owner: marquise },
    { id: 'w-m-4b', kind: 'warrior', owner: marquise },
  ])

  // C7 — extra workshop + sawmill (board tracks match)
  pushPieces(snap, 7, [
    { id: 'workshop-7', kind: 'building', type: 'workshop', owner: marquise, used: true },
    { id: 'sawmill-7', kind: 'building', type: 'sawmill', owner: marquise },
    { id: 'wood-7', kind: 'token', type: 'wood', owner: marquise },
    { id: 'w-m-7a', kind: 'warrior', owner: marquise },
    { id: 'w-m-7b', kind: 'warrior', owner: marquise },
  ])

  // C9 — contested: cats + birds + sympathy
  pushPieces(snap, 9, [
    { id: 'w-m-9a', kind: 'warrior', owner: marquise },
    { id: 'w-m-9b', kind: 'warrior', owner: marquise },
    { id: 'roost-9', kind: 'building', type: 'roost', owner: eyrie, used: false },
    { id: 'w-e-9a', kind: 'warrior', owner: eyrie },
    { id: 'w-e-9b', kind: 'warrior', owner: eyrie },
    { id: 'w-e-9c', kind: 'warrior', owner: eyrie },
    { id: 'sympathy-9', kind: 'token', type: 'sympathy', owner: alliance },
  ])

  // C1 — Eyrie roost nest
  pushPieces(snap, 1, [
    { id: 'roost-1', kind: 'building', type: 'roost', owner: eyrie, used: false },
    { id: 'w-e-1a', kind: 'warrior', owner: eyrie },
    { id: 'w-e-1b', kind: 'warrior', owner: eyrie },
    { id: 'w-e-1c', kind: 'warrior', owner: eyrie },
    { id: 'w-e-1d', kind: 'warrior', owner: eyrie },
  ])

  // C2 — roost + birds
  pushPieces(snap, 2, [
    { id: 'roost-2', kind: 'building', type: 'roost', owner: eyrie, used: false },
    { id: 'w-e-2a', kind: 'warrior', owner: eyrie },
    { id: 'w-e-2b', kind: 'warrior', owner: eyrie },
  ])

  // C6 — fourth roost
  pushPieces(snap, 6, [
    { id: 'roost-6', kind: 'building', type: 'roost', owner: eyrie, used: true },
    { id: 'sympathy-6', kind: 'token', type: 'sympathy', owner: alliance },
    { id: 'w-e-6a', kind: 'warrior', owner: eyrie },
    { id: 'w-a-6a', kind: 'warrior', owner: alliance },
  ])

  // C5 — fox: Alliance base + warriors + sympathy + ruin busy
  pushPieces(snap, 5, [
    { id: 'base-fox', kind: 'building', type: 'base', owner: alliance },
    { id: 'sympathy-5', kind: 'token', type: 'sympathy', owner: alliance },
    { id: 'w-a-5a', kind: 'warrior', owner: alliance },
    { id: 'w-a-5b', kind: 'warrior', owner: alliance },
    { id: 'w-a-5c', kind: 'warrior', owner: alliance },
    { id: 'w-m-5a', kind: 'warrior', owner: marquise },
  ])
  snap.state.clearings[5]!.ruin = { items: ['hammer', 'boot'] }

  // C10 — rabbit base + sympathy + VB pawn here (busy mid-map)
  pushPieces(snap, 10, [
    { id: 'base-rabbit', kind: 'building', type: 'base', owner: alliance },
    { id: 'sympathy-10', kind: 'token', type: 'sympathy', owner: alliance },
    { id: 'w-a-10a', kind: 'warrior', owner: alliance },
    { id: 'w-a-10b', kind: 'warrior', owner: alliance },
    { id: 'w-e-10a', kind: 'warrior', owner: eyrie },
    { id: `pawn-${String(vagabond)}`, kind: 'pawn', owner: vagabond },
  ])
  snap.state.clearings[10]!.ruin = { items: ['sword'] }

  // More sympathy + cats
  pushPieces(snap, 8, [
    { id: 'sympathy-8', kind: 'token', type: 'sympathy', owner: alliance },
    { id: 'sawmill-8', kind: 'building', type: 'sawmill', owner: marquise },
    { id: 'wood-8', kind: 'token', type: 'wood', owner: marquise },
    { id: 'w-m-8a', kind: 'warrior', owner: marquise },
  ])
  pushPieces(snap, 11, [
    { id: 'sympathy-11', kind: 'token', type: 'sympathy', owner: alliance },
    { id: 'w-m-11a', kind: 'warrior', owner: marquise },
    { id: 'w-e-11a', kind: 'warrior', owner: eyrie },
    { id: 'w-a-11a', kind: 'warrior', owner: alliance },
  ])
  snap.state.clearings[11]!.ruin = { items: ['bag'] }

  // C3 corner — cats thin presence
  pushPieces(snap, 3, [
    { id: 'recruiter-3', kind: 'building', type: 'recruiter', owner: marquise },
    { id: 'recruiter-3b', kind: 'building', type: 'recruiter', owner: marquise },
    { id: 'w-m-3a', kind: 'warrior', owner: marquise },
  ])

  // Item supply depleted-ish so craft UI looks used
  snap.state.itemSupply = {
    boot: 0,
    bag: 0,
    crossbow: 0,
    hammer: 0,
    sword: 0,
    tea: 0,
    coin: 1,
    torch: 0,
  }
}

async function main(): Promise<void> {
  await mkdir(outDirectory, { recursive: true })
  const game = Game.create({ seed: 4242 })
  game.join('marquise')
  game.join('eyrie')
  game.join('alliance')
  game.join('vagabond')
  game.start()
  finishSetup(game)

  const snap = game.toJSON()
  enrichBusyUi(snap)
  const restored = Game.fromJSON(snap)
  const filePath = path.join(outDirectory, OUT_NAME)
  await writeFile(filePath, `${JSON.stringify(restored.toJSON(), null, 2)}\n`, 'utf8')

  const state = restored.state
  const pieceCount = state.clearings.reduce(
    (sum, clearing) => sum + clearing.pieces.length,
    0,
  )
  console.log(
    JSON.stringify(
      {
        path: filePath,
        turn: state.turn,
        phase: `${state.phase}/${state.step}`,
        seat: state.currentSeat,
        faction: state.factions[state.currentSeat],
        vp: state.players.map((player) => ({
          faction: player.faction,
          vp: player.vp,
          hand: player.hand.length,
          crafted: player.craftedItems.length,
          playArea: player.playArea.length,
        })),
        mapPieces: pieceCount,
        discard: state.deck.discard.length,
        vagabond: (() => {
          const board = state.players[3]!.board
          if (board.kind !== 'vagabond') return null
          return {
            satchel: board.satchel.length,
            damaged: board.damaged.length,
            tea: board.tracks.tea.length,
            coin: board.tracks.coin.length,
            bag: board.tracks.bag.length,
            forest: board.forest,
            relationships: board.relationships,
          }
        })(),
        alliance: (() => {
          const board = state.players[2]!.board
          if (board.kind !== 'alliance') return null
          return {
            supporters: board.supporters.length,
            officers: board.officers,
            basesLeft: board.bases,
            sympathyLeft: board.sympathyTrack.placed,
          }
        })(),
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
