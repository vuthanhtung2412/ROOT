/**
 * One loaded state for the Lizard Cult + Riverfolk Company continuous QA sequence.
 *
 * From repo:
 *   cd lib && pnpm exec tsx ../.cursor/skills/QA/make-lizard-riverfolk-qa-run.ts
 *
 * Writes: tmp/qa/snapshots/lizard-riverfolk-qa-run.json
 * Steps: resources/notes/QA-plan-lizard-riverfolk.md
 */
import { writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Game } from '../../../lib/src/index.ts'
import { SeededRng } from '../../../lib/src/rules/Rng.ts'
import { createTurnScratch } from '../../../lib/src/state/turnScratch.ts'
import type { GameSnapshot } from '../../../lib/src/state/types.ts'
import type { Card } from '../../../lib/src/cards/types.ts'
import type { Piece, Seat } from '../../../lib/src/pieces/types.ts'

const skillDirectory = path.dirname(fileURLToPath(import.meta.url))
const rootDirectory = path.resolve(skillDirectory, '../../..')
const outDirectory = path.join(rootDirectory, 'tmp/qa/snapshots')
const OUT_NAME = 'lizard-riverfolk-qa-run.json'
const SEED = 20261006

const MARQUISE_SEAT: Seat = 0
const RIVERFOLK_SEAT: Seat = 1
const LIZARD_SEAT: Seat = 2

/** Board layout (Fall suits): fox 0/5/7/11, rabbit 2/3/4/9, mouse 1/6/8/10. */
const KEEP_CLEARING = 2 // rabbit corner — Cult corner 0 is diagonally opposite
const CULT_CORNER = 0 // fox — crusade move origin
const PILGRIMS_CLEARING = 4 // rabbit, river — garden outnumbered; trade post target
const SANCTIFY_CLEARING = 5 // fox — sawmill becomes a garden, then Fear of the Faithful
const RIVERFOLK_BATTLE_CLEARING = 6 // mouse, river
const MULTI_ENEMY_CLEARING = 7 // fox — convert / crusade battle with two enemies
const CRUSADE_DESTINATION = 8 // mouse — crusade move follow-up battle
const SWIM_FROM_CLEARING = 10 // mouse, river — no path to 9
const TRADE_DISRUPTION_CLEARING = 11 // fox — trade post without Riverfolk warriors

const STARTING_BUILDING_CLEARINGS: Record<string, number> = {
  sawmill: SANCTIFY_CLEARING,
  workshop: SWIM_FROM_CLEARING,
  recruiter: KEEP_CLEARING,
}

const MARQUISE_WARRIOR_TOTAL = 25
const LIZARD_WARRIOR_TOTAL = 25
const RIVERFOLK_WARRIOR_TOTAL = 15

/** Warriors per clearing: [clearing, count]. */
const MARQUISE_WARRIORS: ReadonlyArray<readonly [number, number]> = [
  [KEEP_CLEARING, 1],
  [PILGRIMS_CLEARING, 3],
  [SANCTIFY_CLEARING, 1],
  [RIVERFOLK_BATTLE_CLEARING, 1],
  [MULTI_ENEMY_CLEARING, 2],
  [CRUSADE_DESTINATION, 1],
  [SWIM_FROM_CLEARING, 3],
  [TRADE_DISRUPTION_CLEARING, 2],
]
const RIVERFOLK_WARRIORS: ReadonlyArray<readonly [number, number]> = [
  [RIVERFOLK_BATTLE_CLEARING, 2],
  [MULTI_ENEMY_CLEARING, 2],
  [SWIM_FROM_CLEARING, 2],
]
const LIZARD_WARRIORS: ReadonlyArray<readonly [number, number]> = [
  [CULT_CORNER, 3],
  [PILGRIMS_CLEARING, 2],
  [MULTI_ENEMY_CLEARING, 2],
]

/** Rule: 10.4.3 — convert 2 + crusade 2 + sanctify 3 + crusade 2. */
const LIZARD_ACOLYTES = 9
/** Funds box at the start of the Riverfolk turn: 6 funds → 3 dividend points. */
const RIVERFOLK_FUNDS: Seat[] = [
  MARQUISE_SEAT,
  MARQUISE_SEAT,
  MARQUISE_SEAT,
  MARQUISE_SEAT,
  LIZARD_SEAT,
  LIZARD_SEAT,
]
const RIVERFOLK_COMMITTED: Seat[] = [RIVERFOLK_SEAT, RIVERFOLK_SEAT, RIVERFOLK_SEAT]

/** Hands by card definition (see lib/src/cards/ep.generated.ts). No ambush cards. */
const MARQUISE_HAND = ['ROOT-205', 'ROOT-209', 'ROOT-227'] // birds: extra actions
const RIVERFOLK_HAND = [
  'ROOT-204', // Anvil (fox, cost fox) — craft
  'ROOT-206', // A Visit To Friends (rabbit, cost rabbit) — export
  'ROOT-208', // Birdy Bindle (bird) — Hand Card for the Cult
  'ROOT-222', // Root Tea (mouse)
  'ROOT-226', // Travel Gear (mouse)
  'ROOT-219', // Protection Racket (fox)
  'ROOT-223', // Smuggler's Trail (rabbit)
]
const LIZARD_HAND = [
  'ROOT-207', // Bake Sale (rabbit) — build garden on 4
  'ROOT-218', // Mouse-in-a-sack (mouse) — recruit
  'ROOT-221', // Root Tea (fox) — score
  'ROOT-225', // Travel Gear (fox, cost rabbit) — second fox card, not craftable
  'ROOT-215', // Foxfolk Steel (fox, cost fox fox) — evening craft
]
/** Fox leads → Outcast moves mouse → fox; the dominance card becomes available. */
const LOST_SOULS = ['ROOT-216', 'ROOT-72', 'ROOT-79', 'ROOT-210', 'ROOT-211']

/**
 * Dice of the five battles of the plan, in play order (two rolls per battle,
 * higher roll to the attacker). Only battles roll dice before step 38.
 */
const BATTLE_DICE: readonly number[] = [
  1, 0, // step 8: Riverfolk removes the Cat warrior on 6
  1, 0, // step 16: Cult removes one Cat warrior on 7
  1, 0, // step 19: Cult removes the Cat warrior on 8
  0, 0, // step 36: trade post on 11 falls to the defenseless extra hit
  2, 2, // step 37: Revenge (2 Cult warriors) + mercenary hit split (2 hits on Cat)
]
const DICE_SEED_SEARCH_LIMIT = 50_000_000

/** Seed whose first rolls are exactly `rolls` (snapshot rng restarts at cursor 0). */
function findDiceSeed(rolls: readonly number[]): number {
  for (let seed = 0; seed < DICE_SEED_SEARCH_LIMIT; seed++) {
    const probe = new SeededRng({ seed, cursor: 0 })
    if (rolls.every((roll: number): boolean => probe.roll() === roll)) {
      return seed
    }
  }
  throw new Error(`no seed with rolls ${rolls.join(',')}`)
}

function finishSetup(game: Game): void {
  let guard = 0
  while (game.state.pending.length > 0 && guard++ < 50) {
    const event = game.state.pending[0]!
    // First turn already started: the Marquise is being offered services.
    if (event.type === 'buyServices') return
    if (event.type === 'chooseKeep') {
      game.apply({ type: 'resolveEvent', clearing: KEEP_CLEARING })
    } else if (event.type === 'placeStartingBuilding') {
      const clearing = STARTING_BUILDING_CLEARINGS[event.building]
      if (clearing === undefined) throw new Error(`no clearing for ${event.building}`)
      game.apply({ type: 'resolveEvent', clearing })
    } else if (event.type === 'chooseCultCorner') {
      game.apply({ type: 'resolveEvent', clearing: CULT_CORNER })
    } else if (event.type === 'chooseOutcast') {
      game.apply({ type: 'resolveEvent', suit: 'mouse' })
    } else if (event.type === 'placeRiverfolkWarrior') {
      game.apply({ type: 'resolveEvent', clearing: RIVERFOLK_BATTLE_CLEARING })
    } else if (event.type === 'setStartingCosts') {
      game.apply({
        type: 'resolveEvent',
        handCard: 1,
        riverboats: 1,
        mercenaries: 1,
      })
    } else {
      throw new Error(`setup pending: ${JSON.stringify(event)}`)
    }
  }
}

function createThreePlayerGame(): Game {
  const game = Game.create({
    seed: SEED,
    factions: ['marquise', 'riverfolk', 'lizard'],
  })
  game.join('marquise')
  game.join('riverfolk')
  game.join('lizard')
  game.start()
  finishSetup(game)
  return game
}

/** Keep buildings and the keep; drop every warrior and other token. */
function stripMovablePieces(snap: GameSnapshot): void {
  for (const clearing of snap.state.clearings) {
    clearing.pieces = clearing.pieces.filter(
      (piece: Piece): boolean =>
        piece.kind === 'building' ||
        (piece.kind === 'token' && piece.type === 'keep'),
    )
  }
}

function addPieces(snap: GameSnapshot, clearingId: number, pieces: Piece[]): void {
  const clearing = snap.state.clearings[clearingId]!
  clearing.pieces = [...clearing.pieces, ...pieces]
}

function placeWarriors(
  snap: GameSnapshot,
  owner: Seat,
  placements: ReadonlyArray<readonly [number, number]>,
): number {
  let placed = 0
  for (const [clearingId, count] of placements) {
    const pieces: Piece[] = []
    for (let index = 0; index < count; index++) {
      pieces.push({
        id: `w-qa-${String(owner)}-${String(clearingId)}-${String(index)}`,
        kind: 'warrior',
        owner,
      })
    }
    addPieces(snap, clearingId, pieces)
    placed += count
  }
  return placed
}

function fundsOwnedBy(owner: Seat): number {
  return RIVERFOLK_FUNDS.filter((fund: Seat): boolean => fund === owner).length
}

/** Every dealt hand goes back to the draw pile so real cards can be re-dealt. */
function returnHandsToDeck(snap: GameSnapshot): void {
  for (const player of snap.state.players) {
    snap.state.deck.draw.push(...player.hand)
    player.hand = []
  }
}

function takeFromDeck(snap: GameSnapshot, defIds: readonly string[]): Card[] {
  return defIds.map((defId: string): Card => {
    const draw = snap.state.deck.draw
    const cardIndex = draw.findIndex((card: Card): boolean => card.defId === defId)
    if (cardIndex < 0) throw new Error(`card ${defId} not in the draw pile`)
    return draw.splice(cardIndex, 1)[0]!
  })
}

async function main(): Promise<void> {
  await mkdir(outDirectory, { recursive: true })
  const game = createThreePlayerGame()
  const snap = game.toJSON()

  // Marquise at the end of her turn: End phase starts the Riverfolk turn for real
  // (Protectionism, dividends, gather funds, then service offers every turn after).
  snap.state.currentSeat = MARQUISE_SEAT
  snap.state.phase = 'evening'
  snap.state.step = 'discard'
  snap.state.pending = []
  snap.state.turnScratch = createTurnScratch({ eveningDrawDone: true })

  stripMovablePieces(snap)
  const marquiseOnMap = placeWarriors(snap, MARQUISE_SEAT, MARQUISE_WARRIORS)
  const riverfolkOnMap = placeWarriors(snap, RIVERFOLK_SEAT, RIVERFOLK_WARRIORS)
  const lizardOnMap = placeWarriors(snap, LIZARD_SEAT, LIZARD_WARRIORS)

  const marquise = snap.state.players[MARQUISE_SEAT]!
  if (marquise.board.kind !== 'marquise') throw new Error('marquise board missing')
  marquise.board.supply.warriors =
    MARQUISE_WARRIOR_TOTAL - marquiseOnMap - fundsOwnedBy(MARQUISE_SEAT)

  const lizard = snap.state.players[LIZARD_SEAT]!
  if (lizard.board.kind !== 'lizard') throw new Error('lizard board missing')
  // Second garden: rabbit clearing 4, outnumbered by the Marquise (Pilgrims).
  addPieces(snap, PILGRIMS_CLEARING, [
    {
      id: 'garden-qa-pilgrims',
      kind: 'building',
      type: 'garden',
      owner: LIZARD_SEAT,
      used: false,
    },
  ])
  lizard.board.gardens.rabbit -= 1
  lizard.board.acolytes = LIZARD_ACOLYTES
  lizard.board.outcast = 'mouse'
  lizard.board.hated = false
  lizard.board.supply.warriors =
    LIZARD_WARRIOR_TOTAL - lizardOnMap - LIZARD_ACOLYTES - fundsOwnedBy(LIZARD_SEAT)

  const riverfolk = snap.state.players[RIVERFOLK_SEAT]!
  if (riverfolk.board.kind !== 'riverfolk') throw new Error('riverfolk board missing')
  // Fox trade post with no Riverfolk warrior beside it: one hit removes it.
  addPieces(snap, TRADE_DISRUPTION_CLEARING, [
    {
      id: 'trade-post-qa-fox',
      kind: 'token',
      type: 'tradePost',
      owner: RIVERFOLK_SEAT,
    },
  ])
  riverfolk.board.tradePosts.fox -= 1
  riverfolk.board.payments = [] // empty → Protectionism
  riverfolk.board.funds = [...RIVERFOLK_FUNDS]
  riverfolk.board.committed = [...RIVERFOLK_COMMITTED]
  riverfolk.board.serviceCosts = { handCard: 1, riverboats: 1, mercenaries: 1 }
  riverfolk.board.supply.warriors =
    RIVERFOLK_WARRIOR_TOTAL - riverfolkOnMap - RIVERFOLK_COMMITTED.length

  returnHandsToDeck(snap)
  marquise.hand = takeFromDeck(snap, MARQUISE_HAND)
  riverfolk.hand = takeFromDeck(snap, RIVERFOLK_HAND)
  lizard.hand = takeFromDeck(snap, LIZARD_HAND)
  snap.state.deck.lostSouls = takeFromDeck(snap, LOST_SOULS)
  snap.rng = { seed: findDiceSeed(BATTLE_DICE), cursor: 0 }

  const restored = Game.fromJSON(snap)
  const outPath = path.join(outDirectory, OUT_NAME)
  await writeFile(outPath, `${JSON.stringify(restored.toJSON(), null, 2)}\n`, 'utf8')
  console.log(
    JSON.stringify(
      {
        path: outPath,
        phase: `${restored.state.phase}/${restored.state.step}`,
        seat: restored.state.currentSeat,
        legal: restored.legalActions().map((spec) => spec.type),
        plan: 'resources/notes/QA-plan-lizard-riverfolk.md',
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
