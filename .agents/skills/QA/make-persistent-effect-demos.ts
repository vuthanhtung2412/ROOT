/**
 * Build effect-demo snapshots for persistent cards (Frontend QA videos).
 * Run: cd lib && pnpm exec tsx ../.cursor/skills/QA/make-persistent-effect-demos.ts
 */
import { writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Game } from '../../../lib/src/index.ts'
import { FALL } from '../../../lib/src/map/fall.ts'

const skillDirectory = path.dirname(fileURLToPath(import.meta.url))
const rootDirectory = path.resolve(skillDirectory, '../../..')
const outDirectory = path.join(rootDirectory, 'tmp/qa/snapshots/persistent-effects')

export type EffectDemo = {
  slug: string
  defId: string
  name: string
  /** What reviewer should see. */
  effect: string
  prepare: (game: Game) => void
  /** Full action submitted after Continue (UI may click tray first). */
  action: Record<string, unknown>
  /** Post-condition checked via GET /game. */
  assert: (game: {
    state: {
      players: Array<{
        seat: number
        vp: number
        hand: Array<{ id: string; defId: string }>
        playArea: Array<{ id: string; defId: string; heldWarriors?: number }>
        craftedItems: Array<{ type: string; exhausted: boolean }>
      }>
      clearings: Array<{ pieces: Array<{ id: string; kind: string; owner: number }> }>
      deck: { discard: Array<{ id: string; defId: string }> }
      turnScratch: Record<string, unknown>
      pending: Array<{ type: string }>
    }
  }) => boolean
}

function lobbyTwo(seed: number): Game {
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

function toActions(game: Game): void {
  if (game.state.phase === 'birdsong') game.apply({ type: 'endPhase' })
  if (game.state.step === 'craft') game.apply({ type: 'endPhase' })
}

function toEvening(game: Game): void {
  toActions(game)
  game.apply({ type: 'endPhase' })
}

function putCard(game: Game, defId: string, seat = 0): void {
  game.state.players[seat]!.playArea.push({ id: `${defId}#demo`, defId })
}

function warriors(game: Game, clearing: number, seat: number): number {
  return game.state.clearings[clearing]!.pieces.filter(
    (piece) => piece.kind === 'warrior' && piece.owner === seat,
  ).length
}

/** Apply any one legal action preferring endPhase; used to skip AI turns in demos. */
function autoAdvanceOnce(game: Game): boolean {
  const actions = game.legalActions()
  if (actions.length === 0) return false

  const resolveEvent = actions.find((action) => action.type === 'resolveEvent')
  if (resolveEvent?.params?.leaders && resolveEvent.params.leaders.length > 0) {
    game.apply({ type: 'resolveEvent', leader: resolveEvent.params.leaders[0]! })
    return true
  }
  if (resolveEvent?.params?.decline) {
    game.apply({ type: 'resolveEvent', decline: true })
    return true
  }
  if (resolveEvent?.params?.clearing && resolveEvent.params.clearing.length > 0) {
    game.apply({ type: 'resolveEvent', clearing: resolveEvent.params.clearing[0]! })
    return true
  }

  const endPhase = actions.find((action) => action.type === 'endPhase')
  if (endPhase) {
    game.apply({ type: 'endPhase' })
    return true
  }

  const addToDecree = actions.find((action) => action.type === 'addToDecree')
  if (addToDecree?.params?.options && addToDecree.params.options.length > 0) {
    const option = addToDecree.params.options[0]!
    game.apply({
      type: 'addToDecree',
      cards: [{ cardId: option.cardId, column: option.column }],
    })
    return true
  }

  const decree = actions.find((action) => action.type === 'decree')
  if (decree?.params) {
    const column = decree.params.column?.[0]
    const cardId = decree.params.cardIds?.[0]
    if (column !== undefined && cardId !== undefined) {
      const clearing =
        decree.params.clearings?.[0] ?? decree.params.clearing?.[0]
      const battleTarget = decree.params.targets?.[0]
      try {
        game.apply({
          type: 'decree',
          column,
          cardId,
          clearing,
          defender: battleTarget?.defender,
          moves: decree.params.moves?.slice(0, 1),
        })
        return true
      } catch (error: unknown) {
        console.warn('decree apply failed', error)
      }
    }
  }

  const turmoil = actions.find((action) => action.type === 'turmoil')
  if (turmoil) {
    game.apply({ type: 'turmoil' })
    return true
  }

  const eveningDraw = actions.find((action) => action.type === 'eveningDraw')
  if (eveningDraw) {
    game.apply({ type: 'eveningDraw' })
    return true
  }

  const eveningScore = actions.find((action) => action.type === 'eveningScore')
  if (eveningScore) {
    game.apply({ type: 'eveningScore' })
    return true
  }

  return false
}

/** Leave snapshot just before seat 0's next Birdsong so recorder endPhase triggers score. */
function leaveBeforeOwnerNextBirdsong(game: Game): void {
  for (let guard = 0; guard < 100; guard++) {
    const atSeat1EveningDiscard =
      game.state.currentSeat === 1 &&
      game.state.phase === 'evening' &&
      game.state.step === 'discard'
    if (atSeat1EveningDiscard) return
    if (!autoAdvanceOnce(game)) {
      throw new Error(
        `cannot auto-advance coffin setup (${game.state.phase}/${game.state.step} seat=${String(game.state.currentSeat)})`,
      )
    }
  }
  throw new Error('coffin setup: guard exceeded')
}

const DEMOS: EffectDemo[] = [
  {
    slug: 'boat-builders',
    defId: 'ROOT-57',
    name: 'Boat Builders',
    effect: 'March across river 3→6 (rivers as paths)',
    prepare(game) {
      toActions(game)
      putCard(game, 'ROOT-57')
      // Clear river ends; seat 0 rules origin with warriors.
      game.state.clearings[3]!.pieces = [
        { id: 'w3a', kind: 'warrior', owner: 0 },
        { id: 'w3b', kind: 'warrior', owner: 0 },
      ]
      game.state.clearings[6]!.pieces = []
    },
    action: {
      type: 'march',
      moves: [{ from: 3, to: 6, count: 1 }],
    },
    assert: (g) =>
      g.state.clearings[6]!.pieces.some(
        (piece) => piece.kind === 'warrior' && piece.owner === 0,
      ),
  },
  {
    slug: 'charm-offensive',
    defId: 'ROOT-59',
    name: 'Charm Offensive',
    effect: 'Evening: draw 1 + give enemy +1 VP',
    prepare(game) {
      toEvening(game)
      putCard(game, 'ROOT-59')
      game.state.deck.draw.push({ id: 'ROOT-209#demo', defId: 'ROOT-209' })
    },
    action: { type: 'charmOffensive', target: 1 },
    assert: (g) =>
      g.state.turnScratch.charmOffensiveUsed === true && g.state.players[1]!.vp >= 1,
  },
  {
    slug: 'coffin-makers',
    defId: 'ROOT-62',
    name: 'Coffin Makers',
    effect: 'Birdsong: score 2 VP from 11 warriors on card, clear pile',
    prepare(game) {
      putCard(game, 'ROOT-62')
      game.state.players[0]!.playArea[0]!.heldWarriors = 11
      game.state.players[0]!.vp = 0
      // Snapshot stops at Eyrie evening discard; next endPhase → Marquise Birdsong scores.
      leaveBeforeOwnerNextBirdsong(game)
    },
    action: { type: 'endPhase' },
    assert: (g) => g.state.players[0]!.vp === 2,
  },
  {
    slug: 'corvid-planners',
    defId: 'ROOT-64',
    name: 'Corvid Planners',
    effect: 'Move 1→5 without ruling either clearing',
    prepare(game) {
      toActions(game)
      putCard(game, 'ROOT-64')
      game.state.clearings[1]!.pieces = [
        { id: 'w0', kind: 'warrior', owner: 0 },
        { id: 'e1', kind: 'warrior', owner: 1 },
        { id: 'e2', kind: 'warrior', owner: 1 },
      ]
      game.state.clearings[5]!.pieces = [
        { id: 'e3', kind: 'warrior', owner: 1 },
        { id: 'e4', kind: 'warrior', owner: 1 },
      ]
    },
    action: {
      type: 'march',
      moves: [{ from: 1, to: 5, count: 1 }],
    },
    assert: (g) =>
      g.state.clearings[5]!.pieces.some(
        (piece) => piece.id === 'w0' || (piece.kind === 'warrior' && piece.owner === 0),
      ),
  },
  {
    slug: 'eyrie-emigre',
    defId: 'ROOT-71',
    name: 'Eyrie Émigré',
    effect: 'Birdsong: forced move 0→4 then battle (pending battle)',
    prepare(game) {
      putCard(game, 'ROOT-71')
      if (warriors(game, 0, 0) < 1) {
        game.state.clearings[0]!.pieces.push({ id: 'ow', kind: 'warrior', owner: 0 })
      }
      game.state.clearings[4]!.pieces.push({ id: 'enemy', kind: 'warrior', owner: 1 })
    },
    action: {
      type: 'eyrieEmigre',
      from: 0,
      to: 4,
      count: 1,
      defender: 1,
    },
    assert: (g) =>
      g.state.turnScratch.eyrieEmigreCompleted === true &&
      g.state.pending.some((event) => event.type === 'battle'),
  },
  {
    slug: 'false-orders',
    defId: 'ROOT-72',
    name: 'False Orders',
    effect: 'Discard self; force 2 of 3 enemy warriors 2→5',
    prepare(game) {
      putCard(game, 'ROOT-72')
      game.state.clearings[2]!.pieces = [
        { id: 'e1', kind: 'warrior', owner: 1 },
        { id: 'e2', kind: 'warrior', owner: 1 },
        { id: 'e3', kind: 'warrior', owner: 1 },
      ]
      game.state.clearings[5]!.pieces = game.state.clearings[5]!.pieces.filter(
        (piece) => piece.owner !== 1,
      )
    },
    action: { type: 'falseOrders', target: 1, from: 2, to: 5 },
    assert: (g) =>
      g.state.clearings[2]!.pieces.filter((piece) => piece.owner === 1).length === 1 &&
      g.state.clearings[5]!.pieces.filter((piece) => piece.owner === 1).length === 2,
  },
  {
    slug: 'informants',
    defId: 'ROOT-79',
    name: 'Informants',
    effect: 'Evening: take ambush from discard instead of draw',
    prepare(game) {
      putCard(game, 'ROOT-79')
      game.state.deck.discard.push({ id: 'ROOT-200#demo', defId: 'ROOT-200' })
      game.state.deck.draw = []
      toEvening(game)
    },
    action: { type: 'informantsTakeAmbush', cardId: 'ROOT-200#demo' },
    assert: (g) =>
      g.state.players[0]!.hand.some((card) => card.id === 'ROOT-200#demo') &&
      !g.state.deck.discard.some((card) => card.id === 'ROOT-200#demo'),
  },
  {
    slug: 'league-mice',
    defId: 'ROOT-81',
    name: 'League of Adventurous Mice',
    effect: 'Exhaust boot → free move (no action spent)',
    prepare(game) {
      toActions(game)
      putCard(game, 'ROOT-81')
      game.state.players[0]!.craftedItems = [{ type: 'boot', exhausted: false }]
      if (warriors(game, 0, 0) < 1) {
        game.state.clearings[0]!.pieces.push({ id: 'lw', kind: 'warrior', owner: 0 })
      }
    },
    action: {
      type: 'leagueMove',
      itemIndex: 0,
      from: 0,
      to: 4,
      count: 1,
    },
    assert: (g) =>
      g.state.players[0]!.craftedItems[0]?.exhausted === true &&
      g.state.turnScratch.leagueUsed === true,
  },
  {
    slug: 'master-engravers',
    defId: 'ROOT-82',
    name: 'Master Engravers',
    effect: 'Craft item → printed VP + 1 extra',
    prepare(game) {
      if (game.state.phase === 'birdsong') game.apply({ type: 'endPhase' })
      putCard(game, 'ROOT-82')
      game.state.players[0]!.vp = 0
      // Hammer ROOT-204 needs fox workshop (Fall fox: 0,5,7,11).
      game.state.players[0]!.hand = [{ id: 'ROOT-204#demo', defId: 'ROOT-204' }]
      game.state.itemSupply.hammer = 1
      const FOX_CLEARING_ID = 0
      for (let clearing = 0; clearing < 12; clearing++) {
        game.state.clearings[clearing]!.pieces = game.state.clearings[clearing]!.pieces.filter(
          (piece) =>
            !(
              piece.kind === 'building' &&
              piece.type === 'workshop' &&
              piece.owner === 0
            ),
        )
      }
      game.state.clearings[FOX_CLEARING_ID]!.pieces.push({
        id: 'ws-fox-demo',
        kind: 'building',
        owner: 0,
        type: 'workshop',
        used: false,
      })
    },
    action: { type: 'craft', cardId: 'ROOT-204#demo' },
    assert: (g) => g.state.players[0]!.vp >= 3,
  },
  {
    slug: 'murine-broker',
    defId: 'ROOT-85',
    name: 'Murine Broker',
    effect: 'You craft item → holder draws (enemy has Broker)',
    prepare(game) {
      if (game.state.phase === 'birdsong') game.apply({ type: 'endPhase' })
      putCard(game, 'ROOT-85', 1)
      game.state.players[0]!.hand = [{ id: 'ROOT-204#demo', defId: 'ROOT-204' }]
      game.state.players[1]!.hand = []
      game.state.itemSupply.hammer = 1
      game.state.deck.draw.push({ id: 'ROOT-209#draw', defId: 'ROOT-209' })
      const FOX_CLEARING_ID = 0
      for (let clearing = 0; clearing < 12; clearing++) {
        game.state.clearings[clearing]!.pieces = game.state.clearings[clearing]!.pieces.filter(
          (piece) =>
            !(
              piece.kind === 'building' &&
              piece.type === 'workshop' &&
              piece.owner === 0
            ),
        )
      }
      game.state.clearings[FOX_CLEARING_ID]!.pieces.push({
        id: 'ws-fox-demo',
        kind: 'building',
        owner: 0,
        type: 'workshop',
        used: false,
      })
    },
    action: { type: 'craft', cardId: 'ROOT-204#demo' },
    assert: (g) =>
      g.state.players[1]!.hand.some((card) => card.id === 'ROOT-209#draw'),
  },
  {
    slug: 'propaganda-bureau',
    defId: 'ROOT-86',
    name: 'Propaganda Bureau',
    effect: 'Spend fox card → replace enemy warrior at fox clearing 0',
    prepare(game) {
      toActions(game)
      putCard(game, 'ROOT-86')
      game.state.clearings[0]!.pieces.push({
        id: 'enemy-w',
        kind: 'warrior',
        owner: 1,
      })
      game.state.players[0]!.hand.push({ id: 'ROOT-72#pay', defId: 'ROOT-72' })
    },
    action: {
      type: 'propagandaBureau',
      cardId: 'ROOT-72#pay',
      clearing: 0,
      pieceId: 'enemy-w',
    },
    assert: (g) =>
      !g.state.clearings[0]!.pieces.some((piece) => piece.id === 'enemy-w') &&
      g.state.turnScratch.propagandaUsed === true,
  },
  {
    slug: 'saboteurs',
    defId: 'ROOT-93',
    name: 'Saboteurs',
    effect: 'Discard self + discard enemy Boat Builders',
    prepare(game) {
      putCard(game, 'ROOT-93')
      game.state.players[1]!.playArea.push({
        id: 'ROOT-57#enemy',
        defId: 'ROOT-57',
      })
    },
    action: { type: 'saboteurs', target: 1, cardId: 'ROOT-57#enemy' },
    assert: (g) =>
      !g.state.players[0]!.playArea.some((card) => card.defId === 'ROOT-93') &&
      !g.state.players[1]!.playArea.some((card) => card.id === 'ROOT-57#enemy'),
  },
  {
    slug: 'soup-kitchens',
    defId: 'ROOT-97',
    name: 'Soup Kitchens',
    effect: 'Token counts ×2 toward rule — battle where wood tips rule',
    prepare(game) {
      toActions(game)
      putCard(game, 'ROOT-97')
      // Clearing 4: seat0 has 1 warrior + 1 wood; seat1 has 2 warriors.
      // Without soup: seat1 rules (2>1). With soup tokens×2: seat0 has 1+2=3 > 2.
      game.state.clearings[4]!.pieces = [
        { id: 'w0', kind: 'warrior', owner: 0 },
        { id: 'wood', kind: 'token', owner: 0, type: 'wood' },
        { id: 'e1', kind: 'warrior', owner: 1 },
        { id: 'e2', kind: 'warrior', owner: 1 },
      ]
    },
    action: { type: 'battle', clearing: 4, defender: 1 },
    assert: (g) => g.state.pending.some((event) => event.type === 'battle'),
  },
  {
    slug: 'swap-meet',
    defId: 'ROOT-103',
    name: 'Swap Meet',
    effect: 'Birdsong: take random enemy card, give one back',
    prepare(game) {
      putCard(game, 'ROOT-103')
      game.state.players[0]!.hand.push({ id: 'ROOT-209#give', defId: 'ROOT-209' })
      game.state.players[1]!.hand = [{ id: 'ROOT-211#take', defId: 'ROOT-211' }]
    },
    action: { type: 'swapMeet', target: 1, giveCardId: 'ROOT-209#give' },
    assert: (g) =>
      g.state.players[0]!.hand.some((card) => card.id === 'ROOT-211#take') &&
      g.state.turnScratch.swapMeetUsed === true,
  },
  {
    slug: 'tunnels',
    defId: 'ROOT-108',
    name: 'Tunnels',
    effect: 'Move 0→2 via workshops (non-adjacent clearings)',
    prepare(game) {
      toActions(game)
      putCard(game, 'ROOT-108')
      game.state.clearings[0]!.pieces = [
        { id: 'w0', kind: 'warrior', owner: 0 },
        {
          id: 'ws0',
          kind: 'building',
          owner: 0,
          type: 'workshop',
          used: false,
        },
      ]
      game.state.clearings[2]!.pieces = [
        { id: 'w2', kind: 'warrior', owner: 0 },
        {
          id: 'ws2',
          kind: 'building',
          owner: 0,
          type: 'workshop',
          used: false,
        },
      ]
    },
    action: {
      type: 'march',
      moves: [{ from: 0, to: 2, count: 1 }],
    },
    assert: (g) =>
      g.state.clearings[2]!.pieces.filter(
        (piece) => piece.kind === 'warrior' && piece.owner === 0,
      ).length >= 2,
  },
]

async function writeSnapshot(slug: string, game: Game): Promise<void> {
  const filePath = path.join(outDirectory, `${slug}.json`)
  await writeFile(filePath, `${JSON.stringify(game.toJSON(), null, 2)}\n`, 'utf8')
  console.log(
    `${slug}: ${game.state.phase}/${game.state.step} actions=${game
      .legalActions()
      .map((spec) => spec.type)
      .join(',')}`,
  )
}

async function main(): Promise<void> {
  await mkdir(outDirectory, { recursive: true })
  const manifest = []

  for (const [index, demo] of DEMOS.entries()) {
    const game = lobbyTwo(2000 + index)
    demo.prepare(game)
    await writeSnapshot(demo.slug, game)
    manifest.push({
      slug: demo.slug,
      defId: demo.defId,
      name: demo.name,
      effect: demo.effect,
      snapshot: `persistent-effects/${demo.slug}.json`,
      action: demo.action,
    })
  }

  await writeFile(
    path.join(outDirectory, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  )
  // Assert helpers cannot serialize — re-import demos in recorder via duplicated checks.
  console.log(`wrote ${String(manifest.length)} effect demos → ${outDirectory}`)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
