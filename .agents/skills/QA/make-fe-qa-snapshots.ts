/**
 * FE QA snapshots: Alliance + Vagabond boards + action turns.
 *
 * From repo:
 *   cd lib && pnpm exec tsx ../.cursor/skills/QA/make-fe-qa-snapshots.ts
 */
import { writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Game } from '../../../lib/src/index.ts'
import { FALL } from '../../../lib/src/map/fall.ts'
import { createTurnScratch } from '../../../lib/src/state/turnScratch.ts'
import type { GameSnapshot } from '../../../lib/src/state/types.ts'

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

function actionTypes(game: Game): string[] {
  return [...new Set(game.legalActions().map((spec) => spec.type))]
}

async function writeNamed(
  name: string,
  snapshot: GameSnapshot,
  note: Record<string, unknown>,
): Promise<void> {
  const filePath = path.join(outDirectory, name)
  await writeFile(filePath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify({ name, ...note }, null, 2))
}

function forceSeatPhase(
  snap: GameSnapshot,
  seat: number,
  phase: string,
  step: string,
): void {
  snap.state.currentSeat = seat
  snap.state.phase = phase as GameSnapshot['state']['phase']
  snap.state.step = step as GameSnapshot['state']['step']
  snap.state.pending = []
  snap.state.turnScratch = {
    ...createTurnScratch(),
    ...snap.state.turnScratch,
  }
}

/** Place Alliance sympathy token on clearing; decrement track. */
function placeAllianceSympathy(
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
  const clearing = snap.state.clearings[clearingId]!
  clearing.pieces = [
    ...clearing.pieces,
    { id: `sympathy-qa-${String(clearingId)}`, kind: 'token', type: 'sympathy', owner: allianceSeat },
  ]
}

/** Move Vagabond pawn from forest into a clearing. */
function placeVagabondInClearing(
  snap: GameSnapshot,
  vagabondSeat: number,
  clearingId: number,
): void {
  const vagabond = snap.state.players[vagabondSeat]!
  if (vagabond.board.kind !== 'vagabond') {
    throw new Error('expected vagabond board')
  }
  vagabond.board.forest = null
  // Remove any existing pawn pieces then place.
  for (const clearing of snap.state.clearings) {
    clearing.pieces = clearing.pieces.filter(
      (piece) =>
        !(
          piece.kind === 'pawn' &&
          piece.owner === vagabondSeat
        ),
    )
  }
  snap.state.clearings[clearingId]!.pieces = [
    ...snap.state.clearings[clearingId]!.pieces,
    { id: `pawn-${String(vagabondSeat)}`, kind: 'pawn', owner: vagabondSeat },
  ]
}

async function makeBoardsSnapshot(): Promise<void> {
  const game = createFourPlayerGame(99)
  if (game.state.phase === 'birdsong' && game.state.step === 'wood') {
    game.apply({ type: 'endPhase' })
  }
  await writeNamed('alliance-vagabond-boards.json', game.toJSON(), {
    phase: `${game.state.phase}/${game.state.step}`,
    seat: game.state.currentSeat,
    actions: actionTypes(game),
  })
}

async function makeAllianceBirdsongSpread(): Promise<void> {
  const game = createFourPlayerGame(110)
  const snap = game.toJSON()
  forceSeatPhase(snap, 2, 'birdsong', 'actions')
  // Ensure fox supporters for first-cost spread into a fox clearing.
  const alliance = snap.state.players[2]!
  if (alliance.board.kind !== 'alliance') {
    throw new Error('alliance board missing')
  }
  alliance.board.supporters = [
    { id: 'ROOT-202#qa1', defId: 'ROOT-202' },
    { id: 'ROOT-202#qa2', defId: 'ROOT-202' },
    { id: 'ROOT-201#qa1', defId: 'ROOT-201' },
  ]
  const restored = Game.fromJSON(snap)
  await writeNamed('alliance-birdsong-spread.json', restored.toJSON(), {
    phase: `${restored.state.phase}/${restored.state.step}`,
    seat: restored.state.currentSeat,
    actions: actionTypes(restored),
  })
}

async function makeAllianceBirdsongRevolt(): Promise<void> {
  const game = createFourPlayerGame(111)
  const snap = game.toJSON()
  forceSeatPhase(snap, 2, 'birdsong', 'actions')
  // Put sympathy on a fox clearing (suit fox); keep fox base in supply.
  const foxClearing = FALL.clearings.findIndex(
    (clearing) => clearing.suit === 'fox',
  )
  if (foxClearing < 0) {
    throw new Error('no fox clearing')
  }
  placeAllianceSympathy(snap, foxClearing, 2)
  const alliance = snap.state.players[2]!
  if (alliance.board.kind !== 'alliance') {
    throw new Error('alliance board missing')
  }
  // Two fox supporters for revolt cost.
  alliance.board.supporters = [
    { id: 'ROOT-202#r1', defId: 'ROOT-202' },
    { id: 'ROOT-202#r2', defId: 'ROOT-202' },
    { id: 'ROOT-200#r3', defId: 'ROOT-200' },
  ]
  // Clear enemy pieces so openSlots >= 1 (keep may be elsewhere).
  snap.state.clearings[foxClearing]!.pieces = snap.state.clearings[
    foxClearing
  ]!.pieces.filter(
    (piece) => piece.owner === 2 || piece.kind === 'token',
  )
  const restored = Game.fromJSON(snap)
  await writeNamed('alliance-birdsong-revolt.json', restored.toJSON(), {
    phase: `${restored.state.phase}/${restored.state.step}`,
    seat: restored.state.currentSeat,
    actions: actionTypes(restored),
    foxClearing,
  })
}

async function makeAllianceDaylightMobilize(): Promise<void> {
  const game = createFourPlayerGame(112)
  const snap = game.toJSON()
  forceSeatPhase(snap, 2, 'daylight', 'actions')
  const alliance = snap.state.players[2]!
  alliance.hand = [
    { id: 'ROOT-201#m1', defId: 'ROOT-201' },
    { id: 'ROOT-202#m2', defId: 'ROOT-202' },
  ]
  const restored = Game.fromJSON(snap)
  await writeNamed('alliance-daylight-mobilize.json', restored.toJSON(), {
    phase: `${restored.state.phase}/${restored.state.step}`,
    seat: restored.state.currentSeat,
    actions: actionTypes(restored),
  })
}

async function makeAllianceEveningMilitary(): Promise<void> {
  const game = createFourPlayerGame(113)
  const snap = game.toJSON()
  forceSeatPhase(snap, 2, 'evening', 'military')
  snap.state.turnScratch = {
    ...createTurnScratch(),
    militaryOpsLeft: 2,
  }
  const alliance = snap.state.players[2]!
  if (alliance.board.kind !== 'alliance') {
    throw new Error('alliance board missing')
  }
  alliance.board.officers = 2
  alliance.board.bases = ['rabbit', 'mouse'] // fox base on map
  // Place fox base + warriors on fox clearing.
  const foxClearing = FALL.clearings.findIndex(
    (clearing) => clearing.suit === 'fox',
  )
  snap.state.clearings[foxClearing]!.pieces = [
    { id: 'base-fox-qa', kind: 'building', type: 'base', owner: 2 },
    { id: 'w-alliance-1', kind: 'warrior', owner: 2 },
    { id: 'w-alliance-2', kind: 'warrior', owner: 2 },
  ]
  placeAllianceSympathy(snap, foxClearing, 2)
  const restored = Game.fromJSON(snap)
  await writeNamed('alliance-evening-military.json', restored.toJSON(), {
    phase: `${restored.state.phase}/${restored.state.step}`,
    seat: restored.state.currentSeat,
    actions: actionTypes(restored),
  })
}

async function makeVagabondBirdsongSlip(): Promise<void> {
  const game = createFourPlayerGame(120)
  const snap = game.toJSON()
  forceSeatPhase(snap, 3, 'birdsong', 'slip')
  snap.state.turnScratch = {
    ...createTurnScratch(),
    birdsongWoodDone: true,
    slipDone: false,
  }
  const restored = Game.fromJSON(snap)
  await writeNamed('vagabond-birdsong-slip.json', restored.toJSON(), {
    phase: `${restored.state.phase}/${restored.state.step}`,
    seat: restored.state.currentSeat,
    actions: actionTypes(restored),
  })
}

async function makeVagabondDaylightMove(): Promise<void> {
  const game = createFourPlayerGame(121)
  const snap = game.toJSON()
  forceSeatPhase(snap, 3, 'daylight', 'actions')
  // Place VB in a clearing adjacent to others with boot in satchel.
  const forest = FALL.vagabondForest
  const adjacent = FALL.forests[forest]?.[0]
  if (adjacent === undefined) {
    throw new Error('no adjacent clearing for VB forest')
  }
  placeVagabondInClearing(snap, 3, adjacent)
  const restored = Game.fromJSON(snap)
  await writeNamed('vagabond-daylight-move.json', restored.toJSON(), {
    phase: `${restored.state.phase}/${restored.state.step}`,
    seat: restored.state.currentSeat,
    actions: actionTypes(restored),
    clearing: adjacent,
  })
}

async function makeVagabondDaylightSteal(): Promise<void> {
  const game = createFourPlayerGame(122)
  const snap = game.toJSON()
  forceSeatPhase(snap, 3, 'daylight', 'actions')
  const forest = FALL.vagabondForest
  const adjacent = FALL.forests[forest]?.[0]
  if (adjacent === undefined) {
    throw new Error('no adjacent clearing')
  }
  placeVagabondInClearing(snap, 3, adjacent)
  // Put Marquise warrior + hand in same clearing for steal.
  snap.state.clearings[adjacent]!.pieces = [
    ...snap.state.clearings[adjacent]!.pieces,
    { id: 'w-marquise-steal', kind: 'warrior', owner: 0 },
  ]
  snap.state.players[0]!.hand = [
    { id: 'ROOT-202#steal', defId: 'ROOT-202' },
  ]
  const restored = Game.fromJSON(snap)
  await writeNamed('vagabond-daylight-steal.json', restored.toJSON(), {
    phase: `${restored.state.phase}/${restored.state.step}`,
    seat: restored.state.currentSeat,
    actions: actionTypes(restored),
    clearing: adjacent,
  })
}

async function makeVagabondDaylightExplore(): Promise<void> {
  const game = createFourPlayerGame(123)
  const snap = game.toJSON()
  forceSeatPhase(snap, 3, 'daylight', 'actions')
  // Find a clearing with ruin.
  let ruinClearing = -1
  for (let index = 0; index < snap.state.clearings.length; index += 1) {
    if (snap.state.clearings[index]?.ruin !== undefined) {
      ruinClearing = index
      break
    }
  }
  if (ruinClearing < 0) {
    // Force a ruin with item.
    ruinClearing = FALL.forests[FALL.vagabondForest]?.[0] ?? 0
    snap.state.clearings[ruinClearing]!.ruin = {
      items: [{ type: 'boot' }],
    }
  }
  placeVagabondInClearing(snap, 3, ruinClearing)
  const restored = Game.fromJSON(snap)
  await writeNamed('vagabond-daylight-explore.json', restored.toJSON(), {
    phase: `${restored.state.phase}/${restored.state.step}`,
    seat: restored.state.currentSeat,
    actions: actionTypes(restored),
    clearing: ruinClearing,
  })
}

async function main(): Promise<void> {
  await mkdir(outDirectory, { recursive: true })
  await makeBoardsSnapshot()
  await makeAllianceBirdsongSpread()
  await makeAllianceBirdsongRevolt()
  await makeAllianceDaylightMobilize()
  await makeAllianceEveningMilitary()
  await makeVagabondBirdsongSlip()
  await makeVagabondDaylightMove()
  await makeVagabondDaylightSteal()
  await makeVagabondDaylightExplore()
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
