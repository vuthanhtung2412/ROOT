/**
 * One loaded state for the crafted-card demo: Marquise + Woodland Alliance.
 * The Alliance owns the eight cards with a player action and plays them all in
 * one turn. Stopped on the Marquise Evening discard step: one End phase starts
 * the Alliance turn.
 *
 * From repo:
 *   cd lib && pnpm exec tsx ../.agents/skills/QA/make-card-fe-support-qa-run.ts
 *   cd lib && pnpm exec tsx ../.agents/skills/QA/make-card-fe-support-qa-run.ts simulate
 *
 * Writes: tmp/qa/snapshots/card-fe-support-qa-run.json
 * Steps: resources/notes/QA-plan-card-fe-support.md
 * `simulate` plays the whole plan on the engine and checks each step (no UI).
 */
import { writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Game } from '../../../lib/src/index.ts'
import { SeededRng } from '../../../lib/src/rules/Rng.ts'
import type { Action } from '../../../lib/src/actions/types.ts'
import type { GameSnapshot } from '../../../lib/src/state/snapshot.ts'
import type { Card } from '../../../lib/src/cards/types.ts'
import type { Piece, Seat } from '../../../lib/src/pieces/types.ts'

const skillDirectory = path.dirname(fileURLToPath(import.meta.url))
const rootDirectory = path.resolve(skillDirectory, '../../..')
const outDirectory = path.join(rootDirectory, 'tmp/qa/snapshots')
const OUT_NAME = 'card-fe-support-qa-run.json'
const SEED = 20261011
const SIMULATE_ARGUMENT = 'simulate'

const MARQUISE_SEAT: Seat = 0
const ALLIANCE_SEAT: Seat = 1

/** Board layout (Fall suits): fox 0/5/7/11, rabbit 2/3/4/9, mouse 1/6/8/10. */
const KEEP_CLEARING = 2 // rabbit corner — never offered to Propaganda Bureau
const WORKSHOP_CLEARING = 10
const FALSE_ORDERS_ORIGIN = 1 // mouse — 3 Cat warriors; later the Émigré battle
const FALSE_ORDERS_DESTINATION = 5 // fox
const PROPAGANDA_CLEARING = 6 // mouse — 2 Cat warriors
const ALLIANCE_CLEARING = 9 // rabbit — 4 Alliance warriors
const LEAGUE_DESTINATION = 4 // rabbit, empty

const STARTING_BUILDING_CLEARINGS: Readonly<Record<string, number>> = {
  sawmill: KEEP_CLEARING,
  workshop: WORKSHOP_CLEARING,
  recruiter: WORKSHOP_CLEARING,
}

const MARQUISE_WARRIOR_TOTAL = 25
const ALLIANCE_WARRIOR_TOTAL = 10

/** Warriors per clearing: [clearing, count]. */
const MARQUISE_WARRIORS: ReadonlyArray<readonly [number, number]> = [
  [FALSE_ORDERS_ORIGIN, 3],
  [KEEP_CLEARING, 2],
  [PROPAGANDA_CLEARING, 2],
]
const ALLIANCE_WARRIORS: ReadonlyArray<readonly [number, number]> = [
  [ALLIANCE_CLEARING, 4],
]

/** Cards by definition (lib/src/cards/ep.generated.ts). */
const CARD = {
  ambushFox: 'ROOT-202',
  anvil: 'ROOT-204',
  visitToFriends: 'ROOT-206', // rabbit
  mouseInASack: 'ROOT-218', // mouse — spent on Propaganda Bureau
  sword: 'ROOT-224', // mouse — the card Swap Meet takes
  travelGearMouse: 'ROOT-226', // mouse — the card Swap Meet gives
  boatBuilders: 'ROOT-57',
  charmOffensive: 'ROOT-59',
  coffinMakers: 'ROOT-62',
  eyrieEmigre: 'ROOT-71',
  falseOrders: 'ROOT-72',
  informants: 'ROOT-79',
  league: 'ROOT-81',
  propagandaBureau: 'ROOT-86',
  saboteurs: 'ROOT-93',
  swapMeet: 'ROOT-103',
  tunnels: 'ROOT-108',
} as const

const ALLIANCE_PLAY_AREA: readonly string[] = [
  CARD.saboteurs,
  CARD.swapMeet,
  CARD.falseOrders,
  CARD.eyrieEmigre,
  CARD.league,
  CARD.propagandaBureau,
  CARD.charmOffensive,
  CARD.informants,
  CARD.coffinMakers,
]
const ALLIANCE_HAND: readonly string[] = [
  CARD.travelGearMouse,
  CARD.mouseInASack,
  CARD.visitToFriends,
]
const MARQUISE_PLAY_AREA: readonly string[] = [CARD.boatBuilders, CARD.tunnels]
/** One card, so Swap Meet takes it for sure; a mouse card answers no ambush. */
const MARQUISE_HAND: readonly string[] = [CARD.sword]
const DISCARD_PILE: readonly string[] = [CARD.ambushFox, CARD.anvil]

/** The single battle of the plan (Eyrie Émigré): attacker hits 1, defender 0. */
const BATTLE_DICE: readonly number[] = [1, 0]
const DICE_SEED_SEARCH_LIMIT = 50_000_000
const MAX_SETUP_EVENTS = 20
const MAX_PHASES_TO_EVENING = 12

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
  while (game.state.pending.length > 0 && guard++ < MAX_SETUP_EVENTS) {
    const event = game.state.pending[0]!
    if (event.type === 'chooseKeep') {
      game.apply({ type: 'resolveEvent', clearing: KEEP_CLEARING })
    } else if (event.type === 'placeStartingBuilding') {
      const clearing = STARTING_BUILDING_CLEARINGS[event.building]
      if (clearing === undefined) throw new Error(`no clearing for ${event.building}`)
      game.apply({ type: 'resolveEvent', clearing })
    } else {
      throw new Error(`setup pending: ${JSON.stringify(event)}`)
    }
  }
}

/** Marquise plays an empty first turn down to her Evening discard step. */
function playToMarquiseEveningDiscard(game: Game): void {
  let phases = 0
  while (
    !(game.state.phase === 'evening' && game.state.step === 'discard') &&
    phases++ < MAX_PHASES_TO_EVENING
  ) {
    game.apply({ type: 'endPhase' })
  }
  if (game.state.currentSeat !== MARQUISE_SEAT || game.state.step !== 'discard') {
    throw new Error('did not reach the Marquise Evening discard step')
  }
}

function createTwoPlayerGame(): Game {
  const game = Game.create({ seed: SEED, factions: ['marquise', 'alliance'] })
  game.join('marquise')
  game.join('alliance')
  game.start()
  finishSetup(game)
  playToMarquiseEveningDiscard(game)
  return game
}

/** Keep buildings and the keep; drop every warrior and other token. */
function stripMovablePieces(snap: GameSnapshot): number {
  let woodRemoved = 0
  for (const clearing of snap.state.clearings) {
    woodRemoved += clearing.pieces.filter(
      (piece: Piece): boolean => piece.kind === 'token' && piece.type === 'wood',
    ).length
    clearing.pieces = clearing.pieces.filter(
      (piece: Piece): boolean =>
        piece.kind === 'building' ||
        (piece.kind === 'token' && piece.type === 'keep'),
    )
  }
  return woodRemoved
}

function placeWarriors(
  snap: GameSnapshot,
  owner: Seat,
  placements: ReadonlyArray<readonly [number, number]>,
): number {
  let placed = 0
  for (const [clearingId, count] of placements) {
    const clearing = snap.state.clearings[clearingId]!
    for (let index = 0; index < count; index++) {
      clearing.pieces.push({
        id: `w-qa-${String(owner)}-${String(clearingId)}-${String(index)}`,
        kind: 'warrior',
        owner,
      })
    }
    placed += count
  }
  return placed
}

/** Every card outside the deck goes back to it, so real cards can be re-dealt. */
function returnCardsToDeck(snap: GameSnapshot): void {
  const deck = snap.state.deck
  for (const player of snap.state.players) {
    deck.draw.push(...player.hand, ...player.playArea)
    player.hand = []
    player.playArea = []
    if (player.board.kind === 'alliance') {
      deck.draw.push(...player.board.supporters)
      player.board.supporters = []
    }
  }
  deck.draw.push(...deck.discard)
  deck.discard = []
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
  const snap = createTwoPlayerGame().toJSON()

  const woodRemoved = stripMovablePieces(snap)
  const marquiseOnMap = placeWarriors(snap, MARQUISE_SEAT, MARQUISE_WARRIORS)
  const allianceOnMap = placeWarriors(snap, ALLIANCE_SEAT, ALLIANCE_WARRIORS)

  const marquise = snap.state.players[MARQUISE_SEAT]!
  if (marquise.board.kind !== 'marquise') throw new Error('marquise board missing')
  marquise.board.supply.warriors = MARQUISE_WARRIOR_TOTAL - marquiseOnMap
  marquise.board.supply.wood += woodRemoved

  const alliance = snap.state.players[ALLIANCE_SEAT]!
  if (alliance.board.kind !== 'alliance') throw new Error('alliance board missing')
  alliance.board.supply.warriors = ALLIANCE_WARRIOR_TOTAL - allianceOnMap

  returnCardsToDeck(snap)
  marquise.hand = takeFromDeck(snap, MARQUISE_HAND)
  marquise.playArea = takeFromDeck(snap, MARQUISE_PLAY_AREA)
  alliance.hand = takeFromDeck(snap, ALLIANCE_HAND)
  alliance.playArea = takeFromDeck(snap, ALLIANCE_PLAY_AREA)
  snap.state.deck.discard = takeFromDeck(snap, DISCARD_PILE)

  // League of Adventurous Mice exhausts one of these.
  alliance.craftedItems = [
    { type: 'boot', exhausted: false },
    { type: 'tea', exhausted: false },
  ]
  snap.state.itemSupply.boot -= 1
  snap.state.itemSupply.tea -= 1

  snap.rng = { seed: findDiceSeed(BATTLE_DICE), cursor: 0 }
  return Game.fromJSON(snap).toJSON()
}

type SimulationStep = {
  title: string
  next: (game: Game) => Action
  /** What the plan expects after the step; throws with the reason when wrong. */
  check?: (game: Game) => void
}

function expectThat(condition: boolean, message: string): void {
  if (!condition) throw new Error(`expectation failed: ${message}`)
}

function cardIdOf(cards: readonly Card[], defId: string): string {
  const card = cards.find((candidate: Card): boolean => candidate.defId === defId)
  if (card === undefined) throw new Error(`${defId} not found`)
  return card.id
}

function handOf(game: Game, seat: Seat): Card[] {
  return game.state.players[seat]!.hand
}

function playAreaOf(game: Game, seat: Seat): Card[] {
  return game.state.players[seat]!.playArea
}

function hasCard(cards: readonly Card[], defId: string): boolean {
  return cards.some((card: Card): boolean => card.defId === defId)
}

function warriorsOn(game: Game, clearingId: number, owner: Seat): number {
  return game.state.clearings[clearingId]!.pieces.filter(
    (piece: Piece): boolean => piece.kind === 'warrior' && piece.owner === owner,
  ).length
}

function legalTypes(game: Game): string[] {
  return [...new Set(game.legalActions().map((spec) => spec.type))]
}

function coffinMakersCount(game: Game): number {
  const coffinMakers = playAreaOf(game, ALLIANCE_SEAT).find(
    (card: Card): boolean => card.defId === CARD.coffinMakers,
  )
  return coffinMakers?.heldWarriors ?? 0
}

function describe(game: Game): string {
  const state = game.state
  const pending = state.pending.map((event) => event.type).join(',')
  const hands = state.players.map((player) => player.hand.length).join('/')
  return `seat ${String(state.currentSeat)} ${state.phase}/${state.step} pending[${pending}] hands ${hands} legal[${legalTypes(game).join(',')}]`
}

const declineEvent: SimulationStep['next'] = () => ({
  type: 'resolveEvent',
  decline: true,
})
const endPhase: SimulationStep['next'] = () => ({ type: 'endPhase' })

/** The plan of resources/notes/QA-plan-card-fe-support.md, as engine actions. */
const SIMULATION: readonly SimulationStep[] = [
  {
    title: '1 Marquise ends her turn → Alliance Birdsong',
    next: endPhase,
    check: (game) => {
      expectThat(game.state.currentSeat === ALLIANCE_SEAT, 'Alliance turn')
      const types = legalTypes(game)
      for (const offered of ['saboteurs', 'swapMeet', 'falseOrders']) {
        expectThat(types.includes(offered), `${offered} offered`)
      }
      for (const hidden of ['eyrieEmigre', 'leagueMove', 'propagandaBureau', 'charmOffensive']) {
        expectThat(!types.includes(hidden), `${hidden} not offered in Birdsong`)
      }
    },
  },
  {
    title: '2–3 Saboteurs discards Boat Builders',
    next: (game) => ({
      type: 'saboteurs',
      target: MARQUISE_SEAT,
      cardId: cardIdOf(playAreaOf(game, MARQUISE_SEAT), CARD.boatBuilders),
    }),
    check: (game) => {
      expectThat(!hasCard(playAreaOf(game, MARQUISE_SEAT), CARD.boatBuilders), 'Boat Builders gone')
      expectThat(hasCard(playAreaOf(game, MARQUISE_SEAT), CARD.tunnels), 'Tunnels kept')
      expectThat(!hasCard(playAreaOf(game, ALLIANCE_SEAT), CARD.saboteurs), 'Saboteurs discarded')
      expectThat(game.state.deck.discard.length === 4, 'Discarded pile 4')
    },
  },
  {
    title: '4 Swap Meet takes the Sword',
    next: () => ({ type: 'swapMeet', target: MARQUISE_SEAT }),
    check: (game) => {
      expectThat(hasCard(handOf(game, ALLIANCE_SEAT), CARD.sword), 'Sword taken')
      expectThat(handOf(game, MARQUISE_SEAT).length === 0, 'Marquise hand empty')
      expectThat(game.state.pending[0]?.type === 'swapMeetGive', 'give prompt pending')
    },
  },
  {
    title: '5 Swap Meet gives Travel Gear',
    next: (game) => ({
      type: 'resolveEvent',
      cardId: cardIdOf(handOf(game, ALLIANCE_SEAT), CARD.travelGearMouse),
    }),
    check: (game) => {
      expectThat(hasCard(handOf(game, MARQUISE_SEAT), CARD.travelGearMouse), 'Travel Gear given')
      expectThat(handOf(game, ALLIANCE_SEAT).length === 3, 'Alliance hand 3')
      expectThat(!legalTypes(game).includes('swapMeet'), 'Swap Meet used')
      expectThat(!legalTypes(game).includes('saboteurs'), 'start of Birdsong over')
    },
  },
  {
    title: '6–7 False Orders: Marquise 1 → 5',
    next: () => ({
      type: 'falseOrders',
      target: MARQUISE_SEAT,
      from: FALSE_ORDERS_ORIGIN,
      to: FALSE_ORDERS_DESTINATION,
    }),
    check: (game) => {
      expectThat(warriorsOn(game, FALSE_ORDERS_ORIGIN, MARQUISE_SEAT) === 1, '1 Cat left on 1')
      expectThat(warriorsOn(game, FALSE_ORDERS_DESTINATION, MARQUISE_SEAT) === 2, '2 Cats on 5')
      expectThat(game.state.deck.discard.length === 5, 'Discarded pile 5')
    },
  },
  { title: '8a End phase: revolt → spread sympathy step', next: endPhase },
  {
    title: '8b End phase: Birdsong is held, Eyrie Émigré forces a move',
    next: endPhase,
    check: (game) => {
      expectThat(game.state.phase === 'birdsong', 'still Birdsong')
      expectThat(legalTypes(game).join() === 'eyrieEmigre', 'only the forced move')
    },
  },
  {
    title: '9a Eyrie Émigré: 9 → 1, 3 warriors, battle the Marquise',
    next: () => ({
      type: 'eyrieEmigre',
      from: ALLIANCE_CLEARING,
      to: FALSE_ORDERS_ORIGIN,
      count: 3,
      defender: MARQUISE_SEAT,
    }),
    check: (game) => {
      expectThat(game.state.pending[0]?.type === 'battle', 'battle pending')
    },
  },
  { title: '9b Marquise skips ambush', next: declineEvent },
  {
    title: '9c Marquise declines Field Hospitals',
    next: (game) => {
      const event = game.state.pending[0]
      if (event?.type === 'battle') {
        return {
          type: 'resolveEvent',
          pieceIds: [`w-qa-${String(MARQUISE_SEAT)}-${String(FALSE_ORDERS_ORIGIN)}-2`],
        }
      }
      return { type: 'resolveEvent', decline: true }
    },
  },
  {
    title: '9d battle done → only End phase is left',
    next: (game) => {
      if (game.state.pending.length > 0) return { type: 'resolveEvent', decline: true }
      return { type: 'endPhase' }
    },
  },
]

const DAYLIGHT_AND_EVENING: readonly SimulationStep[] = [
  {
    title: '10 Daylight tray',
    next: (game) => {
      expectThat(game.state.phase === 'daylight', `Daylight, got ${describe(game)}`)
      expectThat(warriorsOn(game, FALSE_ORDERS_ORIGIN, MARQUISE_SEAT) === 0, 'Cat warrior removed from 1')
      expectThat(warriorsOn(game, FALSE_ORDERS_ORIGIN, ALLIANCE_SEAT) === 3, '3 Alliance on 1')
      expectThat(coffinMakersCount(game) === 1, 'Coffin Makers holds 1')
      expectThat(hasCard(playAreaOf(game, ALLIANCE_SEAT), CARD.eyrieEmigre), 'Émigré kept')
      const types = legalTypes(game)
      expectThat(types.includes('leagueMove'), 'league: move offered')
      expectThat(types.includes('propagandaBureau'), 'propaganda bureau offered')
      expectThat(!types.includes('leagueBattle'), 'no league: battle')
      return {
        type: 'leagueMove',
        itemIndex: 0,
        from: FALSE_ORDERS_ORIGIN,
        to: LEAGUE_DESTINATION,
        count: 1,
      }
    },
    check: (game) => {
      expectThat(warriorsOn(game, LEAGUE_DESTINATION, ALLIANCE_SEAT) === 1, '1 Alliance on 4')
      expectThat(
        game.state.players[ALLIANCE_SEAT]!.craftedItems[0]!.exhausted,
        'boot exhausted',
      )
      expectThat(!legalTypes(game).includes('leagueMove'), 'League used')
    },
  },
  {
    title: '13–14 Propaganda Bureau on 6',
    next: (game) => {
      const spec = game.legalActions().find((candidate) => candidate.type === 'propagandaBureau')
      const clearings = [
        ...new Set((spec?.params?.options ?? []).map((option) => Reflect.get(option, 'clearing'))),
      ]
      expectThat(clearings.join() === String(PROPAGANDA_CLEARING), `only clearing 6, got ${clearings.join()}`)
      return {
        type: 'propagandaBureau',
        cardId: cardIdOf(handOf(game, ALLIANCE_SEAT), CARD.mouseInASack),
        clearing: PROPAGANDA_CLEARING,
        pieceId: `w-qa-${String(MARQUISE_SEAT)}-${String(PROPAGANDA_CLEARING)}-0`,
      }
    },
    check: (game) => {
      expectThat(game.state.pending[0]?.type === 'fieldHospital', 'Field Hospitals offered')
    },
  },
  {
    title: '14b Marquise declines Field Hospitals',
    next: declineEvent,
    check: (game) => {
      expectThat(warriorsOn(game, PROPAGANDA_CLEARING, MARQUISE_SEAT) === 1, '1 Cat on 6')
      expectThat(warriorsOn(game, PROPAGANDA_CLEARING, ALLIANCE_SEAT) === 1, '1 Alliance on 6')
      expectThat(coffinMakersCount(game) === 1, 'Coffin Makers still 1')
      expectThat(game.state.deck.discard.length === 6, 'Discarded pile 6')
    },
  },
  {
    title: '15 End phase → Evening',
    next: endPhase,
    check: (game) => {
      expectThat(game.state.phase === 'evening', 'Evening')
      expectThat(legalTypes(game).includes('charmOffensive'), 'charm offensive offered')
    },
  },
  {
    title: '16 Charm Offensive: the Marquise scores',
    next: () => ({ type: 'charmOffensive', target: MARQUISE_SEAT }),
    check: (game) => {
      expectThat(game.state.players[MARQUISE_SEAT]!.vp === 1, 'Marquise +1 VP')
      expectThat(handOf(game, ALLIANCE_SEAT).length === 3, 'Alliance hand 3')
    },
  },
  {
    title: '17 End phase to the draw step',
    next: endPhase,
    check: (game) => {
      const types = legalTypes(game)
      expectThat(types.includes('informantsTakeAmbush'), 'informants offered')
      expectThat(types.includes('eveningDraw'), 'draw offered, not done by itself')
    },
  },
  {
    title: '18 Informants takes the fox Ambush',
    next: (game) => ({
      type: 'informantsTakeAmbush',
      cardId: cardIdOf(game.state.deck.discard, CARD.ambushFox),
    }),
    check: (game) => {
      expectThat(hasCard(handOf(game, ALLIANCE_SEAT), CARD.ambushFox), 'Ambush in hand')
      expectThat(handOf(game, ALLIANCE_SEAT).length === 4, 'Alliance hand 4')
      expectThat(game.state.deck.discard.length === 5, 'Discarded pile 5')
    },
  },
]

/** Play the plan on the engine: a step that is illegal or off-plan stops it. */
function simulate(snapshot: GameSnapshot): boolean {
  const game = Game.fromJSON(structuredClone(snapshot))
  console.log(`start: ${describe(game)}`)
  for (const step of [...SIMULATION, ...DAYLIGHT_AND_EVENING]) {
    try {
      game.apply(step.next(game))
      step.check?.(game)
      console.log(`ok   ${step.title} → ${describe(game)}`)
    } catch (error: unknown) {
      console.log(`FAIL ${step.title}: ${String(error)} | at ${describe(game)}`)
      console.log(JSON.stringify(game.legalActions()).slice(0, 1500))
      return false
    }
  }
  return true
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
        phase: `${restored.state.phase}/${restored.state.step}`,
        legal: restored.legalActions().map((spec) => spec.type),
        plan: 'resources/notes/QA-plan-card-fe-support.md',
      },
      null,
      2,
    ),
  )
  if (process.argv[2] === SIMULATE_ARGUMENT && !simulate(snapshot)) {
    process.exitCode = 1
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
