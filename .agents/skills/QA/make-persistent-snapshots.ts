/**
 * Build GameSnapshots for Frontend QA of each E&P persistent card.
 * Run from repo root:
 *   pnpm --filter @root/lib exec tsx ../../.cursor/skills/QA/make-persistent-snapshots.ts
 */
import { writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Game } from '../../../lib/src/index.ts'
import { FALL } from '../../../lib/src/map/fall.ts'

const skillDirectory = path.dirname(fileURLToPath(import.meta.url))
const rootDirectory = path.resolve(skillDirectory, '../../..')
const outDirectory = path.join(rootDirectory, 'tmp/qa/snapshots/persistent')

type PersistentScenario = {
  slug: string
  defId: string
  name: string
  /** Prepare state so card is in playArea and relevant grant/hook is live. */
  prepare: (game: Game) => void
  expectedActionTypes?: string[]
}

function lobbyTwoPlaying(seed: number): Game {
  const game = Game.create({ seed })
  game.join('marquise')
  game.join('eyrie')
  game.start()
  game.apply({ type: 'resolveEvent', clearing: FALL.corners[0]! })
  while (game.state.pending[0]?.type === 'placeStartingBuilding') {
    const clearings = game.legalActions()[0]?.params?.clearing
    if (clearings === undefined || clearings.length === 0) {
      throw new Error('no legal starting building clearings')
    }
    game.apply({ type: 'resolveEvent', clearing: clearings[0]! })
  }
  game.apply({ type: 'resolveEvent', leader: 'builder' })
  return game
}

function advanceToDaylightActions(game: Game): void {
  if (game.state.phase === 'birdsong') game.apply({ type: 'endPhase' })
  if (game.state.step === 'craft') game.apply({ type: 'endPhase' })
}

function advanceToEveningDraw(game: Game): void {
  advanceToDaylightActions(game)
  game.apply({ type: 'endPhase' })
}

function putPersistent(game: Game, defId: string, seat = 0): void {
  game.state.players[seat]!.playArea.push({
    id: `${defId}#qa`,
    defId,
  })
}

async function writeSnapshot(slug: string, game: Game): Promise<void> {
  const snapshot = game.toJSON()
  const filePath = path.join(outDirectory, `${slug}.json`)
  await writeFile(filePath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8')
  const actions = game.legalActions().map((spec) => spec.type)
  console.log(
    `${slug}: phase=${game.state.phase}/${game.state.step} seat=${String(game.state.currentSeat)} actions=${actions.join(',')}`,
  )
}

const SCENARIOS: PersistentScenario[] = [
  {
    slug: 'boat-builders',
    defId: 'ROOT-57',
    name: 'Boat Builders',
    prepare(game) {
      advanceToDaylightActions(game)
      putPersistent(game, 'ROOT-57')
    },
  },
  {
    slug: 'charm-offensive',
    defId: 'ROOT-59',
    name: 'Charm Offensive',
    prepare(game) {
      advanceToEveningDraw(game)
      putPersistent(game, 'ROOT-59')
      game.state.deck.draw.push({ id: 'ROOT-209#qa-draw', defId: 'ROOT-209' })
    },
    expectedActionTypes: ['charmOffensive'],
  },
  {
    slug: 'coffin-makers',
    defId: 'ROOT-62',
    name: 'Coffin Makers',
    prepare(game) {
      putPersistent(game, 'ROOT-62')
      game.state.players[0]!.playArea[0]!.heldWarriors = 7
    },
  },
  {
    slug: 'corvid-planners',
    defId: 'ROOT-64',
    name: 'Corvid Planners',
    prepare(game) {
      advanceToDaylightActions(game)
      putPersistent(game, 'ROOT-64')
    },
  },
  {
    slug: 'eyrie-emigre',
    defId: 'ROOT-71',
    name: 'Eyrie Émigré',
    prepare(game) {
      putPersistent(game, 'ROOT-71')
      // Enemy at path-adjacent clearing so grant can appear.
      game.state.clearings[4]!.pieces.push({
        id: 'enemy-qa',
        kind: 'warrior',
        owner: 1,
      })
      if (
        !game.state.clearings[0]!.pieces.some(
          (piece) => piece.kind === 'warrior' && piece.owner === 0,
        )
      ) {
        game.state.clearings[0]!.pieces.push({
          id: 'own-qa',
          kind: 'warrior',
          owner: 0,
        })
      }
    },
    expectedActionTypes: ['eyrieEmigre'],
  },
  {
    slug: 'false-orders',
    defId: 'ROOT-72',
    name: 'False Orders',
    prepare(game) {
      putPersistent(game, 'ROOT-72')
      game.state.clearings[2]!.pieces = [
        { id: 'e1', kind: 'warrior', owner: 1 },
        { id: 'e2', kind: 'warrior', owner: 1 },
        { id: 'e3', kind: 'warrior', owner: 1 },
      ]
    },
    expectedActionTypes: ['falseOrders'],
  },
  {
    slug: 'informants',
    defId: 'ROOT-79',
    name: 'Informants',
    prepare(game) {
      putPersistent(game, 'ROOT-79')
      game.state.deck.discard.push({ id: 'ROOT-200#qa', defId: 'ROOT-200' })
      advanceToEveningDraw(game)
    },
    expectedActionTypes: ['informantsTakeAmbush', 'eveningDraw'],
  },
  {
    slug: 'league-mice',
    defId: 'ROOT-81',
    name: 'League of Adventurous Mice',
    prepare(game) {
      advanceToDaylightActions(game)
      putPersistent(game, 'ROOT-81')
      game.state.players[0]!.craftedItems.push({ type: 'boot', exhausted: false })
    },
    expectedActionTypes: ['leagueMove'],
  },
  {
    slug: 'master-engravers',
    defId: 'ROOT-82',
    name: 'Master Engravers',
    prepare(game) {
      if (game.state.phase === 'birdsong') game.apply({ type: 'endPhase' })
      putPersistent(game, 'ROOT-82')
    },
  },
  {
    slug: 'murine-broker',
    defId: 'ROOT-85',
    name: 'Murine Broker',
    prepare(game) {
      if (game.state.phase === 'birdsong') game.apply({ type: 'endPhase' })
      // Broker on enemy so current seat craft would trigger draw.
      putPersistent(game, 'ROOT-85', 1)
    },
  },
  {
    slug: 'propaganda-bureau',
    defId: 'ROOT-86',
    name: 'Propaganda Bureau',
    prepare(game) {
      advanceToDaylightActions(game)
      putPersistent(game, 'ROOT-86')
      game.state.clearings[0]!.pieces.push({
        id: 'enemy-w',
        kind: 'warrior',
        owner: 1,
      })
      game.state.players[0]!.hand.push({ id: 'ROOT-72#pay', defId: 'ROOT-72' })
    },
    expectedActionTypes: ['propagandaBureau'],
  },
  {
    slug: 'saboteurs',
    defId: 'ROOT-93',
    name: 'Saboteurs',
    prepare(game) {
      putPersistent(game, 'ROOT-93')
      game.state.players[1]!.playArea.push({
        id: 'ROOT-57#enemy',
        defId: 'ROOT-57',
      })
    },
    expectedActionTypes: ['saboteurs'],
  },
  {
    slug: 'soup-kitchens',
    defId: 'ROOT-97',
    name: 'Soup Kitchens',
    prepare(game) {
      advanceToDaylightActions(game)
      putPersistent(game, 'ROOT-97')
    },
  },
  {
    slug: 'swap-meet',
    defId: 'ROOT-103',
    name: 'Swap Meet',
    prepare(game) {
      putPersistent(game, 'ROOT-103')
      game.state.players[0]!.hand.push({ id: 'ROOT-209#give', defId: 'ROOT-209' })
      game.state.players[1]!.hand = [{ id: 'ROOT-211#take', defId: 'ROOT-211' }]
    },
    expectedActionTypes: ['swapMeet'],
  },
  {
    slug: 'tunnels',
    defId: 'ROOT-108',
    name: 'Tunnels',
    prepare(game) {
      advanceToDaylightActions(game)
      putPersistent(game, 'ROOT-108')
    },
  },
]

async function main(): Promise<void> {
  await mkdir(outDirectory, { recursive: true })
  const manifest: Array<{
    slug: string
    defId: string
    name: string
    snapshot: string
    expectedActionTypes?: string[]
  }> = []

  for (const scenario of SCENARIOS) {
    const game = lobbyTwoPlaying(1000 + SCENARIOS.indexOf(scenario))
    scenario.prepare(game)
    if (scenario.expectedActionTypes !== undefined) {
      const types = new Set(game.legalActions().map((spec) => spec.type))
      for (const expected of scenario.expectedActionTypes) {
        if (!types.has(expected)) {
          console.warn(
            `WARN ${scenario.slug}: missing action ${expected}; have ${[...types].join(',')}`,
          )
        }
      }
    }
    await writeSnapshot(scenario.slug, game)
    manifest.push({
      slug: scenario.slug,
      defId: scenario.defId,
      name: scenario.name,
      snapshot: `persistent/${scenario.slug}.json`,
      expectedActionTypes: scenario.expectedActionTypes,
    })
  }

  await writeFile(
    path.join(outDirectory, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  )
  console.log(`wrote ${String(manifest.length)} snapshots under ${outDirectory}`)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
