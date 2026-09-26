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

type SnapshotPiece = GameSnapshot['state']['clearings'][number]['pieces'][number]

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

function card(defId: string, tag: string): { id: string; defId: string } {
  return { id: `${defId}#${tag}`, defId }
}

function pushPieces(
  snap: GameSnapshot,
  clearingId: number,
  pieces: readonly SnapshotPiece[],
): void {
  const clearing = snap.state.clearings[clearingId]!
  clearing.pieces = [...clearing.pieces, ...pieces]
}

function warriors(
  owner: Seat,
  clearingId: number,
  count: number,
  factionCode: string,
): SnapshotPiece[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `w-${factionCode}-${String(clearingId)}-${String(index)}`,
    kind: 'warrior' as const,
    owner,
  }))
}

function enrichBusyUi(snap: GameSnapshot): void {
  const marquise = 0 as Seat
  const eyrie = 1 as Seat
  const alliance = 2 as Seat
  const vagabond = 3 as Seat

  snap.state.turn = 18
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

  // Near-endgame scores so the VP rail looks busy.
  snap.state.players[marquise]!.vp = 24
  snap.state.players[eyrie]!.vp = 21
  snap.state.players[alliance]!.vp = 26
  snap.state.players[vagabond]!.vp = 19

  // Hands at/near limit with mixed suits.
  snap.state.players[marquise]!.hand = [
    card('ROOT-79', 'm1'),
    card('ROOT-72', 'm2'),
    card('ROOT-108', 'm3'),
    card('ROOT-103', 'm4'),
    card('ROOT-205', 'm5'),
  ]
  snap.state.players[eyrie]!.hand = [
    card('ROOT-72', 'e1'),
    card('ROOT-84', 'e2'),
    card('ROOT-203', 'e3'),
    card('ROOT-211', 'e4'),
    card('ROOT-88', 'e5'),
  ]
  snap.state.players[alliance]!.hand = [
    card('ROOT-201', 'a1'),
    card('ROOT-202', 'a2'),
    card('ROOT-200', 'a3'),
    card('ROOT-88', 'a4'),
    card('ROOT-214', 'a5'),
  ]
  snap.state.players[vagabond]!.hand = [
    card('ROOT-211', 'v1'),
    card('ROOT-202', 'v2'),
    card('ROOT-64', 'v3'),
    card('ROOT-57', 'v4'),
    card('ROOT-208', 'v5'),
  ]

  // Crafted permanent cards across seats (gallery + board chrome).
  snap.state.players[marquise]!.playArea = [
    card('ROOT-64', 'craft-m1'),
    card('ROOT-57', 'craft-m2'),
    card('ROOT-79', 'craft-m3'),
    card('ROOT-81', 'craft-m4'),
  ]
  snap.state.players[eyrie]!.playArea = [
    card('ROOT-72', 'craft-e1'),
    card('ROOT-84', 'craft-e2'),
    card('ROOT-71', 'craft-e3'),
  ]
  snap.state.players[alliance]!.playArea = [
    card('ROOT-225', 'craft-a1'),
    card('ROOT-59', 'craft-a2'),
    card('ROOT-62', 'craft-a3'),
    card('ROOT-77', 'craft-a4'),
  ]
  snap.state.players[vagabond]!.playArea = [
    card('ROOT-88', 'craft-v1'),
    card('ROOT-82', 'craft-v2'),
  ]

  snap.state.players[marquise]!.craftedItems = [
    item('bag'),
    item('coin'),
    item('hammer'),
    item('sword'),
  ]
  snap.state.players[eyrie]!.craftedItems = [item('hammer'), item('boot'), item('tea')]
  snap.state.players[alliance]!.craftedItems = [item('coin'), item('bag'), item('crossbow')]
  snap.state.players[vagabond]!.craftedItems = [item('boot')]

  // Fat discard for pile UI.
  snap.state.deck.discard = [
    card('ROOT-57', 'd1'),
    card('ROOT-59', 'd2'),
    card('ROOT-62', 'd3'),
    card('ROOT-71', 'd4'),
    card('ROOT-81', 'd5'),
    card('ROOT-82', 'd6'),
    card('ROOT-103', 'd7'),
    card('ROOT-108', 'd8'),
    card('ROOT-200', 'd9'),
    card('ROOT-201', 'd10'),
    card('ROOT-203', 'd11'),
    card('ROOT-204', 'd12'),
    card('ROOT-206', 'd13'),
    card('ROOT-207', 'd14'),
    card('ROOT-209', 'd15'),
  ]

  // --- Marquise board ---
  // tracks.*.placed = buildings still ON TRACK (6 slots).
  const marquiseBoard = snap.state.players[marquise]!.board
  if (marquiseBoard.kind === 'marquise') {
    // 25 warriors total: 20 on map + 5 supply. Wood: 8 total → 7 on map + 1 supply.
    marquiseBoard.supply.warriors = 5
    marquiseBoard.supply.wood = 1
    marquiseBoard.tracks.sawmill.placed = 1 // 5 on map
    marquiseBoard.tracks.workshop.placed = 2 // 4 on map
    marquiseBoard.tracks.recruiter.placed = 1 // 5 on map
  }

  // --- Eyrie board ---
  const eyrieBoard = snap.state.players[eyrie]!.board
  if (eyrieBoard.kind === 'eyrie') {
    // 20 warriors total: 16 on map + 4 supply.
    eyrieBoard.supply.warriors = 4
    eyrieBoard.leader = 'charismatic'
    eyrieBoard.leadersFaceUp = ['builder', 'commander', 'despot']
    eyrieBoard.leadersFaceDown = []
    eyrieBoard.roostTrack.placed = 1 // 6 roosts on map
    eyrieBoard.decree = {
      recruit: [
        card('ROOT-72', 'dr1'),
        card('ROOT-203', 'dr2'),
        card('ROOT-200', 'dr3'),
      ],
      move: [card('ROOT-84', 'dm1'), card('ROOT-211', 'dm2')],
      battle: [
        card('ROOT-72', 'db1'),
        card('ROOT-213', 'db2'),
        card('ROOT-214', 'db3'),
      ],
      build: [card('ROOT-88', 'dbu1'), card('ROOT-201', 'dbu2')],
    }
  }

  // --- Alliance board ---
  const allianceBoard = snap.state.players[alliance]!.board
  if (allianceBoard.kind === 'alliance') {
    // 10 warriors total: 6 on map + 4 officers.
    allianceBoard.supply.warriors = 0
    allianceBoard.officers = 4
    allianceBoard.bases = [] // all three bases on map
    allianceBoard.sympathyTrack.placed = 2 // 8 on map
    allianceBoard.supporters = [
      card('ROOT-202', 's1'),
      card('ROOT-202', 's2'),
      card('ROOT-201', 's3'),
      card('ROOT-200', 's4'),
      card('ROOT-202', 's5'),
      card('ROOT-201', 's6'),
      card('ROOT-214', 's7'),
      card('ROOT-203', 's8'),
      card('ROOT-200', 's9'),
      card('ROOT-211', 's10'),
    ]
  }

  // --- Vagabond board (maxed satchel / tracks) ---
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
      item('boot'),
      item('sword'),
      item('hammer'),
      item('crossbow', true),
      item('torch'),
    ]
    // Rule: tea/coin/bag tracks hold only matching item types.
    vagabondBoard.tracks.tea = [item('tea'), item('tea'), item('tea', true)]
    vagabondBoard.tracks.coin = [item('coin'), item('coin', true)]
    vagabondBoard.tracks.bag = [item('bag'), item('bag'), item('bag')]
    vagabondBoard.damaged = [item('boot'), item('sword'), item('torch'), item('bag')]
    vagabondBoard.relationships = {
      marquise: 'hostile',
      eyrie: 2,
      alliance: 3,
      vagabond: 0,
    }
  }

  // Clear map pieces then rebuild a packed board.
  for (const clearing of snap.state.clearings) {
    clearing.pieces = []
  }

  // Warrior budgets (component totals): M20+E16+A6 on map.
  // C0 keep nest — dense cats + wood pile
  pushPieces(snap, 0, [
    { id: 'keep', kind: 'token', type: 'keep', owner: marquise },
    { id: 'sawmill-0', kind: 'building', type: 'sawmill', owner: marquise },
    { id: 'workshop-0', kind: 'building', type: 'workshop', owner: marquise, used: false },
    { id: 'wood-0a', kind: 'token', type: 'wood', owner: marquise },
    { id: 'wood-0b', kind: 'token', type: 'wood', owner: marquise },
    ...warriors(marquise, 0, 3, 'm'),
  ])

  // C1 — roost nest
  pushPieces(snap, 1, [
    { id: 'roost-1', kind: 'building', type: 'roost', owner: eyrie, used: false },
    ...warriors(eyrie, 1, 3, 'e'),
    ...warriors(marquise, 1, 1, 'm'),
  ])

  // C2 — roost + contested
  pushPieces(snap, 2, [
    { id: 'roost-2', kind: 'building', type: 'roost', owner: eyrie, used: false },
    { id: 'sympathy-2', kind: 'token', type: 'sympathy', owner: alliance },
    ...warriors(eyrie, 2, 2, 'e'),
    ...warriors(alliance, 2, 1, 'a'),
  ])

  // C3 — recruiters stack
  pushPieces(snap, 3, [
    { id: 'recruiter-3a', kind: 'building', type: 'recruiter', owner: marquise },
    { id: 'recruiter-3b', kind: 'building', type: 'recruiter', owner: marquise },
    { id: 'sawmill-3', kind: 'building', type: 'sawmill', owner: marquise },
    { id: 'wood-3', kind: 'token', type: 'wood', owner: marquise },
    ...warriors(marquise, 3, 2, 'm'),
  ])

  // C4 — workshop + recruiter hub
  pushPieces(snap, 4, [
    { id: 'workshop-4', kind: 'building', type: 'workshop', owner: marquise, used: false },
    { id: 'recruiter-4', kind: 'building', type: 'recruiter', owner: marquise },
    { id: 'sawmill-4', kind: 'building', type: 'sawmill', owner: marquise },
    { id: 'wood-4a', kind: 'token', type: 'wood', owner: marquise },
    { id: 'wood-4b', kind: 'token', type: 'wood', owner: marquise },
    ...warriors(marquise, 4, 3, 'm'),
    ...warriors(eyrie, 4, 1, 'e'),
  ])

  // C5 — fox base mega-stack + ruin loot
  pushPieces(snap, 5, [
    { id: 'base-fox', kind: 'building', type: 'base', owner: alliance },
    { id: 'sympathy-5', kind: 'token', type: 'sympathy', owner: alliance },
    { id: 'roost-5', kind: 'building', type: 'roost', owner: eyrie, used: false },
    ...warriors(alliance, 5, 2, 'a'),
    ...warriors(marquise, 5, 2, 'm'),
    ...warriors(eyrie, 5, 2, 'e'),
  ])
  snap.state.clearings[5]!.ruin = { items: ['hammer', 'boot'] }

  // C6 — roost + sympathy tangle
  pushPieces(snap, 6, [
    { id: 'roost-6', kind: 'building', type: 'roost', owner: eyrie, used: true },
    { id: 'sympathy-6', kind: 'token', type: 'sympathy', owner: alliance },
    { id: 'workshop-6', kind: 'building', type: 'workshop', owner: marquise, used: true },
    ...warriors(eyrie, 6, 2, 'e'),
    ...warriors(alliance, 6, 1, 'a'),
    ...warriors(marquise, 6, 1, 'm'),
  ])

  // C7 — industrial cats
  pushPieces(snap, 7, [
    { id: 'workshop-7', kind: 'building', type: 'workshop', owner: marquise, used: true },
    { id: 'sawmill-7', kind: 'building', type: 'sawmill', owner: marquise },
    { id: 'recruiter-7', kind: 'building', type: 'recruiter', owner: marquise },
    { id: 'wood-7a', kind: 'token', type: 'wood', owner: marquise },
    { id: 'wood-7b', kind: 'token', type: 'wood', owner: marquise },
    ...warriors(marquise, 7, 3, 'm'),
  ])

  // C8 — sympathy + sawmill fringe
  pushPieces(snap, 8, [
    { id: 'sympathy-8', kind: 'token', type: 'sympathy', owner: alliance },
    { id: 'sawmill-8', kind: 'building', type: 'sawmill', owner: marquise },
    { id: 'roost-8', kind: 'building', type: 'roost', owner: eyrie, used: false },
    ...warriors(marquise, 8, 2, 'm'),
    ...warriors(eyrie, 8, 2, 'e'),
  ])

  // C9 — triple-faction scrap
  pushPieces(snap, 9, [
    { id: 'roost-9', kind: 'building', type: 'roost', owner: eyrie, used: false },
    { id: 'sympathy-9', kind: 'token', type: 'sympathy', owner: alliance },
    { id: 'recruiter-9', kind: 'building', type: 'recruiter', owner: marquise },
    ...warriors(marquise, 9, 2, 'm'),
    ...warriors(eyrie, 9, 2, 'e'),
    ...warriors(alliance, 9, 1, 'a'),
  ])

  // C10 — rabbit base + VB pawn mid-map
  pushPieces(snap, 10, [
    { id: 'base-rabbit', kind: 'building', type: 'base', owner: alliance },
    { id: 'sympathy-10', kind: 'token', type: 'sympathy', owner: alliance },
    { id: `pawn-${String(vagabond)}`, kind: 'pawn', owner: vagabond },
    ...warriors(alliance, 10, 1, 'a'),
    ...warriors(eyrie, 10, 1, 'e'),
    ...warriors(marquise, 10, 1, 'm'),
  ])
  snap.state.clearings[10]!.ruin = { items: ['sword'] }

  // C11 — mouse base (one sympathy max per clearing)
  pushPieces(snap, 11, [
    { id: 'base-mouse', kind: 'building', type: 'base', owner: alliance },
    { id: 'sympathy-11', kind: 'token', type: 'sympathy', owner: alliance },
    ...warriors(eyrie, 11, 1, 'e'),
  ])
  snap.state.clearings[11]!.ruin = { items: ['bag'] }

  // Eighth sympathy on a clearing that had none (no stacking).
  pushPieces(snap, 3, [
    { id: 'sympathy-3', kind: 'token', type: 'sympathy', owner: alliance },
  ])

  // Item supply emptied (crafted / VB took them).
  snap.state.itemSupply = {
    boot: 0,
    bag: 0,
    crossbow: 0,
    hammer: 0,
    sword: 0,
    tea: 0,
    coin: 0,
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
  const piecesByKind: Record<string, number> = {}
  for (const clearing of state.clearings) {
    for (const piece of clearing.pieces) {
      piecesByKind[piece.kind] = (piecesByKind[piece.kind] ?? 0) + 1
    }
  }
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
        piecesByKind,
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
