/**
 * One loaded state for the action dock demo: Marquise + Eyrie + Woodland
 * Alliance, stopped at the start of the first Marquise turn. The Marquise owns
 * crafted cards of every phase, the Eyrie holds two cards to add to its Decree,
 * the Alliance has two officers and a base.
 *
 * From repo:
 *   cd lib && pnpm exec tsx ../.agents/skills/QA/make-action-dock-qa-run.ts
 *   cd lib && pnpm exec tsx ../.agents/skills/QA/make-action-dock-qa-run.ts simulate
 *
 * Writes: tmp/qa/snapshots/action-dock-qa-run.json
 * Steps: resources/notes/QA-plan-action-dock.md
 * `simulate` plays the whole plan on the engine and checks each step (no UI).
 */
import { writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Game } from '../../../lib/src/index.ts'
import type { Action } from '../../../lib/src/actions/types.ts'
import type { GameSnapshot } from '../../../lib/src/state/snapshot.ts'
import type { Card } from '../../../lib/src/cards/types.ts'
import type { Piece, Seat } from '../../../lib/src/pieces/types.ts'

const skillDirectory = path.dirname(fileURLToPath(import.meta.url))
const rootDirectory = path.resolve(skillDirectory, '../../..')
const outDirectory = path.join(rootDirectory, 'tmp/qa/snapshots')
const OUT_NAME = 'action-dock-qa-run.json'
const SEED = 20261012
const SIMULATE_ARGUMENT = 'simulate'

const MARQUISE_SEAT: Seat = 0
const EYRIE_SEAT: Seat = 1
const ALLIANCE_SEAT: Seat = 2

/** Board layout (Fall suits): fox 0/5/7/11, rabbit 2/3/4/9, mouse 1/6/8/10. */
const KEEP_CLEARING = 2 // rabbit corner; the Eyrie roost starts opposite, on 0
const WORKSHOP_CLEARING = 6 // mouse
const RECRUITER_CLEARING = 10 // mouse
const MARCH_DESTINATION = 5 // fox, next to the keep
const LEAGUE_ORIGIN = 10
const LEAGUE_DESTINATION = 11
const ROOST_CLEARING = 0 // fox corner
const EYRIE_FIRST_MOVE_DESTINATION = 4
const EYRIE_SECOND_MOVE_DESTINATION = 8
const BASE_CLEARING = 9 // rabbit — Alliance base, sympathy, 2 warriors
const ORGANIZE_CLEARING = 1 // mouse — 1 Alliance warrior, no sympathy
const ALLIANCE_MOVE_DESTINATION = 11

const STARTING_BUILDING_CLEARINGS: Readonly<Record<string, number>> = {
  sawmill: KEEP_CLEARING,
  workshop: WORKSHOP_CLEARING,
  recruiter: RECRUITER_CLEARING,
}
const EYRIE_LEADER = 'builder' // Loyal Viziers on recruit and move: no battle

/** Cat warriors added to the keep: three march out in a line. */
const EXTRA_KEEP_WARRIORS = 2
const MARCH_WARRIORS = 3
const EYRIE_MOVE_WARRIORS = 3
const ALLIANCE_OFFICERS = 2
const ALLIANCE_BASE_WARRIORS = 2
const ALLIANCE_MOVE_WARRIORS = 2
const ALLIANCE_WARRIOR_TOTAL = 10
const BASE_SUIT = 'rabbit'

/** Cards by definition (lib/src/cards/ep.generated.ts). */
const CARD = {
  anvil: 'ROOT-204', // fox, costs a fox workshop: the Marquise cannot craft it
  foxfolkSteel: 'ROOT-215', // fox — the card the Eyrie adds to its Decree
  bakeSale: 'ROOT-207', // rabbit — stays in the Eyrie hand
  charmOffensive: 'ROOT-59',
  league: 'ROOT-81',
  propagandaBureau: 'ROOT-86',
  swapMeet: 'ROOT-103',
} as const

/** Card actions of all three phases, so the Cards panel has lines that are off. */
const MARQUISE_PLAY_AREA: readonly string[] = [
  CARD.swapMeet,
  CARD.league,
  CARD.propagandaBureau,
  CARD.charmOffensive,
]
const MARQUISE_HAND: readonly string[] = [CARD.anvil]
const EYRIE_HAND: readonly string[] = [CARD.foxfolkSteel, CARD.bakeSale]

const MAX_SETUP_EVENTS = 20

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
    } else if (event.type === 'chooseLeader') {
      game.apply({ type: 'resolveEvent', leader: EYRIE_LEADER })
    } else {
      throw new Error(`setup pending: ${JSON.stringify(event)}`)
    }
  }
}

function createThreePlayerGame(): Game {
  const game = Game.create({
    seed: SEED,
    factions: ['marquise', 'eyrie', 'alliance'],
  })
  game.join('marquise')
  game.join('eyrie')
  game.join('alliance')
  game.start()
  finishSetup(game)
  return game
}

function addPieces(snap: GameSnapshot, clearingId: number, pieces: Piece[]): void {
  const clearing = snap.state.clearings[clearingId]!
  clearing.pieces = [...clearing.pieces, ...pieces]
}

function warriorPieces(owner: Seat, clearingId: number, count: number): Piece[] {
  return Array.from(
    { length: count },
    (_: undefined, index: number): Piece => ({
      id: `w-qa-${String(owner)}-${String(clearingId)}-${String(index)}`,
      kind: 'warrior',
      owner,
    }),
  )
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
  const snap = createThreePlayerGame().toJSON()

  const marquise = snap.state.players[MARQUISE_SEAT]!
  if (marquise.board.kind !== 'marquise') throw new Error('marquise board missing')
  addPieces(snap, KEEP_CLEARING, warriorPieces(MARQUISE_SEAT, KEEP_CLEARING, EXTRA_KEEP_WARRIORS))
  marquise.board.supply.warriors -= EXTRA_KEEP_WARRIORS

  const alliance = snap.state.players[ALLIANCE_SEAT]!
  if (alliance.board.kind !== 'alliance') throw new Error('alliance board missing')
  addPieces(snap, BASE_CLEARING, [
    { id: 'base-qa', kind: 'building', type: 'base', owner: ALLIANCE_SEAT, used: false },
    { id: 'sympathy-qa', kind: 'token', type: 'sympathy', owner: ALLIANCE_SEAT },
    ...warriorPieces(ALLIANCE_SEAT, BASE_CLEARING, ALLIANCE_BASE_WARRIORS),
  ])
  addPieces(snap, ORGANIZE_CLEARING, warriorPieces(ALLIANCE_SEAT, ORGANIZE_CLEARING, 1))
  alliance.board.officers = ALLIANCE_OFFICERS
  alliance.board.bases = alliance.board.bases.filter((suit) => suit !== BASE_SUIT)
  alliance.board.sympathyTrack.placed -= 1
  alliance.board.supply.warriors =
    ALLIANCE_WARRIOR_TOTAL - ALLIANCE_OFFICERS - ALLIANCE_BASE_WARRIORS - 1

  returnCardsToDeck(snap)
  marquise.hand = takeFromDeck(snap, MARQUISE_HAND)
  marquise.playArea = takeFromDeck(snap, MARQUISE_PLAY_AREA)
  snap.state.players[EYRIE_SEAT]!.hand = takeFromDeck(snap, EYRIE_HAND)

  // League of Adventurous Mice exhausts it.
  marquise.craftedItems = [{ type: 'boot', exhausted: false }]
  snap.state.itemSupply.boot -= 1

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

function warriorsOn(game: Game, clearingId: number, owner: Seat): number {
  return game.state.clearings[clearingId]!.pieces.filter(
    (piece: Piece): boolean => piece.kind === 'warrior' && piece.owner === owner,
  ).length
}

function legalTypes(game: Game): string[] {
  return [...new Set(game.legalActions().map((spec) => spec.type))]
}

function expectOnlyEndPhase(game: Game, label: string): void {
  expectThat(legalTypes(game).join() === 'endPhase', `${label}: only End phase, got ${legalTypes(game).join()}`)
}

function decreeCardId(game: Game, column: 'recruit' | 'move', index: number): string {
  const board = game.state.players[EYRIE_SEAT]!.board
  if (board.kind !== 'eyrie') throw new Error('eyrie board missing')
  const card = board.decree[column][index]
  if (card === undefined) throw new Error(`no card ${String(index)} in ${column}`)
  return card.id
}

function describe(game: Game): string {
  const state = game.state
  const pending = state.pending.map((event) => event.type).join(',')
  const hands = state.players.map((player) => player.hand.length).join('/')
  return `seat ${String(state.currentSeat)} ${state.phase}/${state.step} pending[${pending}] hands ${hands} legal[${legalTypes(game).join(',')}]`
}

const endPhase: SimulationStep['next'] = () => ({ type: 'endPhase' })
/** A step the UI ends by itself: End phase is the only action. */
function automaticEndPhase(title: string): SimulationStep {
  return {
    title: `${title} (UI ends it alone)`,
    next: (game) => {
      expectOnlyEndPhase(game, title)
      return { type: 'endPhase' }
    },
  }
}

const MARQUISE_TURN: readonly SimulationStep[] = [
  {
    title: '1–2 Marquise Birdsong: Swap Meet holds the phase; End phase',
    next: (game) => {
      expectThat(legalTypes(game).includes('swapMeet'), 'swap meet offered')
      return { type: 'endPhase' }
    },
  },
  {
    title: '2b Craft step: the Daylight card actions hold it; End phase',
    next: (game) => {
      expectThat(game.state.step === 'craft', `craft step, got ${describe(game)}`)
      expectThat(legalTypes(game).includes('leagueMove'), 'league: move offered')
      return { type: 'endPhase' }
    },
  },
  {
    title: '3 Recruit',
    next: (game) => {
      expectThat(game.state.step === 'actions', `Daylight actions, got ${describe(game)}`)
      return { type: 'recruit' }
    },
    check: (game) => {
      expectThat(!legalTypes(game).includes('recruit'), 'recruit spent')
      expectThat(game.state.turnScratch.actionsLeft === 2, '2 actions left')
    },
  },
  {
    title: '4 March 2 → 5 with 3 warriors',
    next: () => ({
      type: 'march',
      moves: [{ from: KEEP_CLEARING, to: MARCH_DESTINATION, count: MARCH_WARRIORS }],
    }),
    check: (game) => {
      expectThat(warriorsOn(game, MARCH_DESTINATION, MARQUISE_SEAT) === MARCH_WARRIORS + 1, '4 Cats on 5')
      expectThat(game.state.turnScratch.actionsLeft === 1, '1 action left')
    },
  },
  {
    title: '5 League: move 10 → 11, Boot exhausted',
    next: () => ({
      type: 'leagueMove',
      itemIndex: 0,
      from: LEAGUE_ORIGIN,
      to: LEAGUE_DESTINATION,
      count: 1,
    }),
    check: (game) => {
      expectThat(game.state.turnScratch.leagueUsed === true, 'League used')
      expectThat(legalTypes(game).includes('propagandaBureau'), 'propaganda bureau still offered')
      expectThat(game.state.turnScratch.actionsLeft === 1, 'card action costs no action')
    },
  },
  { title: '6a Marquise ends Daylight', next: endPhase },
  {
    title: '6b Evening: Charm Offensive offered next to the draw; draw',
    next: (game) => {
      expectThat(legalTypes(game).includes('charmOffensive'), 'charm offensive offered')
      return { type: 'eveningDraw' }
    },
  },
]

const EYRIE_TURN: readonly SimulationStep[] = [
  {
    title: '7–8 Eyrie adds Foxfolk Steel to the move column',
    next: (game) => {
      expectThat(game.state.currentSeat === EYRIE_SEAT, `Eyrie turn, got ${describe(game)}`)
      expectThat(game.state.step === 'decreeAdd', `decreeAdd step, got ${describe(game)}`)
      return {
        type: 'addToDecree',
        cards: [
          {
            cardId: cardIdOf(game.state.players[EYRIE_SEAT]!.hand, CARD.foxfolkSteel),
            column: 'move',
          },
        ],
      }
    },
  },
  automaticEndPhase('Eyrie new roost step'),
  automaticEndPhase('Eyrie craft step'),
  {
    title: '9 Decree recruit on the roost',
    next: (game) => {
      expectThat(game.state.step === 'decree', `decree step, got ${describe(game)}`)
      return {
        type: 'decree',
        column: 'recruit',
        cardId: decreeCardId(game, 'recruit', 0),
        clearing: ROOST_CLEARING,
      }
    },
  },
  {
    title: '10 Decree move (fox card) 0 → 4 with 3 warriors',
    next: (game) => ({
      type: 'decree',
      column: 'move',
      cardId: cardIdOf(
        [decreeCardId(game, 'move', 0), decreeCardId(game, 'move', 1)].map(
          (id: string): Card => ({ id, defId: id.split('#')[0]! }),
        ),
        CARD.foxfolkSteel,
      ),
      moves: [
        {
          from: ROOST_CLEARING,
          to: EYRIE_FIRST_MOVE_DESTINATION,
          count: EYRIE_MOVE_WARRIORS,
        },
      ],
    }),
    check: (game) => {
      expectThat(
        warriorsOn(game, EYRIE_FIRST_MOVE_DESTINATION, EYRIE_SEAT) === EYRIE_MOVE_WARRIORS,
        '3 Eyrie warriors on 4',
      )
      expectThat(legalTypes(game).includes('decree'), 'one move card left')
    },
  },
  {
    title: '11 Decree move (Loyal Vizier) 0 → 8',
    next: (game) => {
      const spec = game.legalActions().find((candidate) => candidate.type === 'decree')
      const cardId = spec?.params?.cardIds?.[0]
      if (cardId === undefined) throw new Error('no decree card left')
      return {
        type: 'decree',
        column: 'move',
        cardId,
        moves: [{ from: ROOST_CLEARING, to: EYRIE_SECOND_MOVE_DESTINATION, count: 1 }],
      }
    },
  },
]

const ALLIANCE_TURN: readonly SimulationStep[] = [
  {
    title: '12 Alliance Evening: four military operations, 2 left',
    next: (game) => {
      expectThat(game.state.currentSeat === ALLIANCE_SEAT, `Alliance turn, got ${describe(game)}`)
      expectThat(game.state.step === 'military', `military step, got ${describe(game)}`)
      const operations = game
        .legalActions()
        .filter((spec) => spec.type === 'militaryOp')
        .map((spec) => spec.params?.op?.[0])
      expectThat(
        operations.join() === 'move,battle,recruit,organize',
        `operations ${operations.join()}`,
      )
      return {
        type: 'militaryOp',
        op: 'move',
        from: BASE_CLEARING,
        to: ALLIANCE_MOVE_DESTINATION,
        count: ALLIANCE_MOVE_WARRIORS,
      }
    },
    check: (game) => {
      expectThat(game.state.turnScratch.militaryOpsLeft === 1, '1 operation left')
      expectThat(
        warriorsOn(game, ALLIANCE_MOVE_DESTINATION, ALLIANCE_SEAT) === ALLIANCE_MOVE_WARRIORS,
        '2 Alliance warriors on 11',
      )
    },
  },
]

const MAX_AUTOMATIC_PHASES = 12

/** End the phases the UI ends alone until `seat` has something to choose. */
function skipAutomaticPhases(game: Game, seat: Seat): void {
  let phases = 0
  while (
    phases++ < MAX_AUTOMATIC_PHASES &&
    legalTypes(game).join() === 'endPhase' &&
    !(game.state.currentSeat === seat && game.state.step === 'military')
  ) {
    game.apply({ type: 'endPhase' })
  }
}

/** Play the plan on the engine: a step that is illegal or off-plan stops it. */
function simulate(snapshot: GameSnapshot): boolean {
  const game = Game.fromJSON(structuredClone(snapshot))
  console.log(`start: ${describe(game)}`)
  const turns: ReadonlyArray<readonly [Seat, readonly SimulationStep[]]> = [
    [MARQUISE_SEAT, MARQUISE_TURN],
    [EYRIE_SEAT, EYRIE_TURN],
    [ALLIANCE_SEAT, ALLIANCE_TURN],
  ]
  for (const [seat, steps] of turns) {
    skipAutomaticPhases(game, seat)
    console.log(`turn of seat ${String(seat)}: ${describe(game)}`)
    for (const step of steps) {
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
        plan: 'resources/notes/QA-plan-action-dock.md',
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
