/**
 * One loaded state for the UI improvements demo:
 * Vagabond + Marquise + Lizard Cult + Riverfolk, stopped in setup on the Cult's
 * Outcast choice so the demo starts on the suit icons.
 *
 * From repo:
 *   cd lib && pnpm exec tsx ../.agents/skills/QA/make-ui-improvements-qa-run.ts
 *   cd lib && pnpm exec tsx ../.agents/skills/QA/make-ui-improvements-qa-run.ts simulate
 *
 * Writes: tmp/qa/snapshots/ui-improvements-qa-run.json
 * Steps: resources/notes/QA-plan-ui-improvements.md
 * `simulate` plays the whole plan on the engine and prints each step (no UI).
 */
import { writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Game } from '../../../lib/src/index.ts'
import { SeededRng } from '../../../lib/src/rules/Rng.ts'
import type { Action } from '../../../lib/src/actions/types.ts'
import type { GameSnapshot } from '../../../lib/src/state/types.ts'
import type { Card } from '../../../lib/src/cards/types.ts'
import type { Piece, Seat } from '../../../lib/src/pieces/types.ts'

const skillDirectory = path.dirname(fileURLToPath(import.meta.url))
const rootDirectory = path.resolve(skillDirectory, '../../..')
const outDirectory = path.join(rootDirectory, 'tmp/qa/snapshots')
const OUT_NAME = 'ui-improvements-qa-run.json'
const SEED = 20261007
const SIMULATE_ARGUMENT = 'simulate'

const VAGABOND_SEAT: Seat = 0
const MARQUISE_SEAT: Seat = 1
const LIZARD_SEAT: Seat = 2
const RIVERFOLK_SEAT: Seat = 3

/** Board layout (Fall suits): fox 0/5/7/11, rabbit 2/3/4/9, mouse 1/6/8/10. */
const KEEP_CLEARING = 2 // rabbit corner, first sawmill
const WORKSHOP_CLEARING = 5 // fox — crafts Anvil
const RECRUITER_CLEARING = 10 // mouse — third sawmill joins it
const SECOND_SAWMILL_CLEARING = 6 // mouse
const CULT_CORNER = 0 // fox, opposite the keep
const BATTLE_CLEARING = 9 // rabbit — 3 Cat warriors against 2 Cult warriors
const VAGABOND_FOREST = 4 // borders clearings 1, 5, 9, 10
const SLIP_CLEARING = 1 // mouse corner, empty
const RIVERFOLK_START_CLEARINGS: readonly number[] = [3, 3, 4, 4]
const RECRUIT_CLEARING = 8 // mouse — Cult ritual recruit

const STARTING_BUILDING_CLEARINGS: Readonly<Record<string, number>> = {
  sawmill: KEEP_CLEARING,
  workshop: WORKSHOP_CLEARING,
  recruiter: RECRUITER_CLEARING,
}
/** Sawmills added to the starting one: wood grows in three clearings. */
const EXTRA_SAWMILL_CLEARINGS: readonly number[] = [
  SECOND_SAWMILL_CLEARING,
  RECRUITER_CLEARING,
]

const MARQUISE_WARRIOR_TOTAL = 25
const LIZARD_WARRIOR_TOTAL = 25

/** Warriors per clearing: [clearing, count]. */
const MARQUISE_WARRIORS: ReadonlyArray<readonly [number, number]> = [
  [KEEP_CLEARING, 1],
  [WORKSHOP_CLEARING, 1],
  [SECOND_SAWMILL_CLEARING, 1],
  [BATTLE_CLEARING, 3],
  [RECRUITER_CLEARING, 1],
]
const LIZARD_WARRIORS: ReadonlyArray<readonly [number, number]> = [
  [CULT_CORNER, 3],
  [RECRUIT_CLEARING, 1],
  [BATTLE_CLEARING, 2],
]

/** Hands by card definition (lib/src/cards/ep.generated.ts). No ambush cards. */
const CARD = {
  anvil: 'ROOT-204', // fox, cost fox — crafted at the fox workshop
  armsTrader: 'ROOT-205',
  visitToFriends: 'ROOT-206',
  bakeSale: 'ROOT-207',
  birdyBindle: 'ROOT-208', // the card the Marquise buys
  crossbowBird: 'ROOT-209',
  foxfolkSteel: 'ROOT-215',
  mouseInASack: 'ROOT-218', // mouse — the Cult reveals it to recruit
  protectionRacket: 'ROOT-219',
  rootTeaFox: 'ROOT-221',
  rootTeaMouse: 'ROOT-222',
  smugglersTrail: 'ROOT-223',
  travelGearFox: 'ROOT-225',
  travelGearMouse: 'ROOT-226',
  woodlandRunners: 'ROOT-227',
} as const
const VAGABOND_HAND: readonly string[] = [CARD.armsTrader, CARD.woodlandRunners]
/** Seven cards: craft −1, buy +1, evening draw +1 → three to discard. */
const MARQUISE_HAND: readonly string[] = [
  CARD.anvil,
  CARD.travelGearFox,
  CARD.protectionRacket,
  CARD.foxfolkSteel,
  CARD.bakeSale,
  CARD.visitToFriends,
  CARD.smugglersTrail,
]
/** The three cards the Marquise lets go of in Evening. */
const MARQUISE_DISCARDS: readonly string[] = [
  CARD.travelGearFox,
  CARD.protectionRacket,
  CARD.foxfolkSteel,
]
const LIZARD_HAND: readonly string[] = [
  CARD.mouseInASack,
  CARD.rootTeaMouse,
  CARD.rootTeaFox,
]
const RIVERFOLK_HAND: readonly string[] = [
  CARD.birdyBindle,
  CARD.travelGearMouse,
  CARD.crossbowBird,
]

/**
 * Dice of the two battles of the plan, in play order (two rolls per battle,
 * higher roll to the attacker).
 */
const BATTLE_DICE: readonly number[] = [
  0, 0, // first battle: nobody is hit, the result still shows
  2, 1, // second battle: both Cult warriors fall, one Cat warrior falls
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

/** Setup up to the Cult's Outcast choice: that prompt opens the demo. */
function setupUntilOutcastChoice(game: Game): void {
  let guard = 0
  while (game.state.pending.length > 0 && guard++ < 50) {
    const event = game.state.pending[0]!
    if (event.type === 'chooseOutcast') return
    if (event.type === 'chooseKeep') {
      game.apply({ type: 'resolveEvent', clearing: KEEP_CLEARING })
    } else if (event.type === 'placeStartingBuilding') {
      const clearing = STARTING_BUILDING_CLEARINGS[event.building]
      if (clearing === undefined) throw new Error(`no clearing for ${event.building}`)
      game.apply({ type: 'resolveEvent', clearing })
    } else if (event.type === 'chooseCharacter') {
      game.apply({ type: 'resolveEvent', character: 'thief' })
    } else if (event.type === 'chooseForest') {
      game.apply({ type: 'resolveEvent', forest: VAGABOND_FOREST })
    } else if (event.type === 'chooseCultCorner') {
      game.apply({ type: 'resolveEvent', clearing: CULT_CORNER })
    } else {
      throw new Error(`setup pending: ${JSON.stringify(event)}`)
    }
  }
  throw new Error('setup ended before the Outcast choice')
}

function createFourPlayerGame(): Game {
  const game = Game.create({
    seed: SEED,
    factions: ['vagabond', 'marquise', 'lizard', 'riverfolk'],
  })
  game.join('vagabond')
  game.join('marquise')
  game.join('lizard')
  game.join('riverfolk')
  game.start()
  setupUntilOutcastChoice(game)
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

function buildSnapshot(): GameSnapshot {
  const snap = createFourPlayerGame().toJSON()

  stripMovablePieces(snap)
  const marquiseOnMap = placeWarriors(snap, MARQUISE_SEAT, MARQUISE_WARRIORS)
  const lizardOnMap = placeWarriors(snap, LIZARD_SEAT, LIZARD_WARRIORS)

  const marquise = snap.state.players[MARQUISE_SEAT]!
  if (marquise.board.kind !== 'marquise') throw new Error('marquise board missing')
  for (const clearingId of EXTRA_SAWMILL_CLEARINGS) {
    addPieces(snap, clearingId, [
      {
        id: `sawmill-qa-${String(clearingId)}`,
        kind: 'building',
        type: 'sawmill',
        owner: MARQUISE_SEAT,
        used: false,
      },
    ])
  }
  marquise.board.tracks.sawmill.placed -= EXTRA_SAWMILL_CLEARINGS.length
  marquise.board.supply.warriors = MARQUISE_WARRIOR_TOTAL - marquiseOnMap

  const lizard = snap.state.players[LIZARD_SEAT]!
  if (lizard.board.kind !== 'lizard') throw new Error('lizard board missing')
  lizard.board.supply.warriors = LIZARD_WARRIOR_TOTAL - lizardOnMap

  returnHandsToDeck(snap)
  snap.state.players[VAGABOND_SEAT]!.hand = takeFromDeck(snap, VAGABOND_HAND)
  marquise.hand = takeFromDeck(snap, MARQUISE_HAND)
  lizard.hand = takeFromDeck(snap, LIZARD_HAND)
  snap.state.players[RIVERFOLK_SEAT]!.hand = takeFromDeck(snap, RIVERFOLK_HAND)
  snap.rng = { seed: findDiceSeed(BATTLE_DICE), cursor: 0 }

  return Game.fromJSON(snap).toJSON()
}

type SimulationStep = {
  title: string
  /** Action for the current state; null = stop (nothing left to play). */
  next: (game: Game) => Action | null
  /** Repeat the action until this seat's turn starts (ends a whole turn). */
  untilSeat?: Seat
}

const MAX_PHASES_PER_TURN = 12

/** End phases until the turn passes to `seat`. */
function endTurnUntil(seat: Seat, title: string): SimulationStep {
  return { title, next: () => ({ type: 'endPhase' }), untilSeat: seat }
}

function cardIdInHand(game: Game, seat: Seat, defId: string): string {
  const card = game.state.players[seat]!.hand.find(
    (candidate: Card): boolean => candidate.defId === defId,
  )
  if (card === undefined) throw new Error(`${defId} not in the hand of seat ${String(seat)}`)
  return card.id
}

function describe(game: Game): string {
  const state = game.state
  const legal = [...new Set(game.legalActions().map((spec) => spec.type))].join(',')
  const pending = state.pending.map((event) => event.type).join(',')
  const hands = state.players.map((player) => player.hand.length).join('/')
  const wood = state.clearings
    .map((clearing, clearingId) =>
      clearing.pieces.some((piece) => piece.type === 'wood') ? clearingId : null,
    )
    .filter((clearingId) => clearingId !== null)
    .join(',')
  const battleClearing = state.clearings[BATTLE_CLEARING]!.pieces
  const warriorsOf = (owner: Seat): number =>
    battleClearing.filter((piece) => piece.kind === 'warrior' && piece.owner === owner).length
  return `wood[${wood}] battle9 cat${String(warriorsOf(MARQUISE_SEAT))}/cult${String(warriorsOf(LIZARD_SEAT))} seat ${String(state.currentSeat)} ${state.phase}/${state.step} pending[${pending}] hands ${hands} legal[${legal}]`
}

/** The plan of resources/notes/QA-plan-ui-improvements.md, as engine actions. */
const SIMULATION: readonly SimulationStep[] = [
  { title: 'Outcast: fox', next: () => ({ type: 'resolveEvent', suit: 'fox' }) },
  ...RIVERFOLK_START_CLEARINGS.map(
    (clearing: number): SimulationStep => ({
      title: `Riverfolk warrior on ${String(clearing)}`,
      next: () => ({ type: 'resolveEvent', clearing }),
    }),
  ),
  {
    title: 'Riverfolk starting costs 1/1/1',
    next: () => ({ type: 'resolveEvent', handCard: 1, riverboats: 1, mercenaries: 1 }),
  },
  { title: 'Vagabond skips services', next: () => ({ type: 'resolveEvent', decline: true }) },
  { title: 'Vagabond: refresh step ends (UI does it alone)', next: () => ({ type: 'endPhase' }) },
  { title: 'Vagabond slips out of the forest', next: () => ({ type: 'slip', to: SLIP_CLEARING }) },
  endTurnUntil(MARQUISE_SEAT, 'Vagabond ends the turn'),
  {
    title: 'Marquise buys Birdy Bindle',
    next: (game) => ({
      type: 'resolveEvent',
      service: 'handCard',
      cardId: cardIdInHand(game, RIVERFOLK_SEAT, CARD.birdyBindle),
    }),
  },
  { title: 'Marquise ends Birdsong', next: () => ({ type: 'endPhase' }) },
  {
    title: 'Marquise crafts Anvil',
    next: (game) => ({ type: 'craft', cardId: cardIdInHand(game, MARQUISE_SEAT, CARD.anvil) }),
  },
  { title: 'Marquise ends craft step', next: () => ({ type: 'endPhase' }) },
  {
    title: 'Battle 1 on 9 (0–0)',
    next: () => ({ type: 'battle', clearing: BATTLE_CLEARING, defender: LIZARD_SEAT }),
  },
  { title: 'Cult skips ambush', next: () => ({ type: 'resolveEvent', decline: true }) },
  {
    title: 'Battle 2 on 9 (2–1)',
    next: () => ({ type: 'battle', clearing: BATTLE_CLEARING, defender: LIZARD_SEAT }),
  },
  { title: 'Cult skips ambush', next: () => ({ type: 'resolveEvent', decline: true }) },
  {
    title: 'Marquise removes one of her warriors',
    next: () => ({
      type: 'resolveEvent',
      pieceIds: [`w-qa-${String(MARQUISE_SEAT)}-${String(BATTLE_CLEARING)}-0`],
    }),
  },
  { title: 'Marquise declines Field Hospitals', next: () => ({ type: 'resolveEvent', decline: true }) },
  { title: 'Marquise ends Daylight', next: () => ({ type: 'endPhase' }) },
  { title: 'Marquise: draw step ends (UI does it alone)', next: () => ({ type: 'endPhase' }) },
  {
    title: 'Marquise discards down to five',
    next: (game) => ({
      type: 'discard',
      cardIds: MARQUISE_DISCARDS.map((defId: string): string =>
        cardIdInHand(game, MARQUISE_SEAT, defId),
      ),
    }),
  },
  endTurnUntil(LIZARD_SEAT, 'Marquise ends the turn'),
  { title: 'Cult skips services', next: () => ({ type: 'resolveEvent', decline: true }) },
  { title: 'Cult ends Birdsong (no conspiracy)', next: () => ({ type: 'endPhase' }) },
  {
    title: 'Cult reveals Mouse-in-a-sack to recruit on 8',
    next: (game) => ({
      type: 'ritualRecruit',
      cardId: cardIdInHand(game, LIZARD_SEAT, CARD.mouseInASack),
      clearing: RECRUIT_CLEARING,
    }),
  },
]

/** Play the plan on the engine: a step that is not legal throws and shows why. */
function simulate(snapshot: GameSnapshot): void {
  const game = Game.fromJSON(structuredClone(snapshot))
  console.log(`start: ${describe(game)}`)
  for (const step of SIMULATION) {
    const action = step.next(game)
    if (action === null) break
    try {
      if (step.untilSeat === undefined) {
        game.apply(action)
      } else {
        let phases = 0
        while (game.state.currentSeat !== step.untilSeat && phases++ < MAX_PHASES_PER_TURN) {
          game.apply(action)
        }
      }
      console.log(`ok   ${step.title} → ${describe(game)}`)
    } catch (error: unknown) {
      console.log(`FAIL ${step.title}: ${String(error)} | at ${describe(game)}`)
      console.log(JSON.stringify(game.legalActions()).slice(0, 1500))
      return
    }
  }
  console.log(JSON.stringify(game.legalActions()).slice(0, 1500))
}

async function main(): Promise<void> {
  await mkdir(outDirectory, { recursive: true })
  const snapshot = buildSnapshot()
  const outPath = path.join(outDirectory, OUT_NAME)
  await writeFile(outPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8')
  const restored = Game.fromJSON(structuredClone(snapshot))
  console.log(
    JSON.stringify(
      {
        path: outPath,
        seat: restored.state.currentSeat,
        pending: restored.state.pending.map((event) => event.type),
        legal: restored.legalActions().map((spec) => spec.type),
        plan: 'resources/notes/QA-plan-ui-improvements.md',
      },
      null,
      2,
    ),
  )
  if (process.argv[2] === SIMULATE_ARGUMENT) simulate(snapshot)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
