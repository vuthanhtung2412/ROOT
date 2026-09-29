/**
 * Build GameSnapshots for BUG.md frontend QA videos.
 * Run from repo root:
 *   cd lib && npx tsx ../.agents/skills/QA/make-bug-snapshots.ts
 *
 * Snapshots start *before* the featured action so videos can play:
 * setup → action → dice/resolve → result (not mid-pending).
 */
import { writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Game } from '../../../lib/src/index.ts'
import { FALL } from '../../../lib/src/map/fall.ts'
import { makeViziers } from '../../../lib/src/factions/eyrie/viziers.ts'
import { SeededRng } from '../../../lib/src/rules/Rng.ts'
import { eyrieLeaderPools } from '../../../lib/src/state/boards.ts'

const skillDirectory = path.dirname(fileURLToPath(import.meta.url))
const rootDirectory = path.resolve(skillDirectory, '../../..')
const outDirectory = path.join(rootDirectory, 'tmp/qa/snapshots/bugs')

function lobbyTwoPlaying(seed: number): Game {
  const game = Game.create({ seed })
  game.join('marquise')
  game.join('eyrie')
  game.start()
  game.apply({ type: 'resolveEvent', clearing: FALL.corners[0]! })
  while (game.state.pending.length > 0) {
    const pending = game.state.pending[0]
    if (pending === undefined) {
      break
    }
    if (pending.type === 'chooseLeader') {
      game.apply({ type: 'resolveEvent', leader: 'builder' })
      continue
    }
    if (pending.type === 'chooseForest') {
      game.apply({ type: 'resolveEvent', forest: FALL.vagabondForest })
      continue
    }
    const legal = game.legalActions()[0]
    const clearing = legal?.params?.clearing?.[0]
    const building = legal?.params?.building?.[0]
    if (typeof clearing !== 'number') {
      break
    }
    if (typeof building === 'string') {
      game.apply({ type: 'resolveEvent', clearing, building })
    } else {
      game.apply({ type: 'resolveEvent', clearing })
    }
  }
  return game
}

function advanceToActions(game: Game): void {
  if (game.state.phase === 'birdsong') {
    game.apply({ type: 'endPhase' })
  }
  if (game.state.step === 'craft') {
    game.apply({ type: 'endPhase' })
  }
}

/** Next two battle dice rolls = [first, second]. */
function findDiceSeed(first: number, second: number): number {
  for (let seed = 0; seed < 50_000; seed++) {
    const probe = new SeededRng({ seed, cursor: 0 })
    if (probe.roll() === first && probe.roll() === second) {
      return seed
    }
  }
  throw new Error(`no seed with rolls ${String(first)},${String(second)}`)
}

async function writeSnapshot(name: string, game: Game): Promise<void> {
  const snapshot = game.toJSON()
  const filePath = path.join(outDirectory, name)
  await writeFile(filePath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8')
  const actions = game.legalActions().map((spec) => spec.type)
  const pending = game.state.pending[0]
  console.log(
    `${name}: status=${game.state.status} ${game.state.phase}/${game.state.step} seat=${String(game.state.currentSeat)} pending=${pending?.type ?? 'none'} actions=${actions.join(',') || '(none)'}`,
  )
}

/** Marquise daylight — roost-only enemy in C4 (defenseless target). */
async function makeDefenselessBattle(): Promise<void> {
  const game = lobbyTwoPlaying(11)
  advanceToActions(game)
  const snap = game.toJSON()
  snap.state.clearings[4]!.pieces = [
    { id: 'w-atk', kind: 'warrior', owner: 0 },
    { id: 'w-atk2', kind: 'warrior', owner: 0 },
    {
      id: 'b-def',
      kind: 'building',
      owner: 1,
      type: 'roost',
      used: false,
    },
  ]
  snap.state.players[0]!.hand = []
  snap.state.players[1]!.hand = []
  // 1 attacker hit + defenseless → roost dies.
  snap.rng = { seed: findDiceSeed(1, 0), cursor: 0 }
  const restored = Game.fromJSON(snap)
  const battle = restored.legalActions().find((spec) => spec.type === 'battle')
  const targets = battle?.params?.targets ?? []
  if (!targets.some((target) => target.clearing === 4 && target.defender === 1)) {
    throw new Error(
      `expected battle vs building-only at C4, got ${JSON.stringify(targets)}`,
    )
  }
  await writeSnapshot('01-defenseless-battle.json', restored)
}

/**
 * Marquise at 29 VP; roost-only enemy in C4. Battle then remove roost → +1 VP → win.
 */
async function makeWinnerMenu(): Promise<void> {
  const game = lobbyTwoPlaying(13)
  advanceToActions(game)
  const snap = game.toJSON()
  snap.state.status = 'playing'
  delete snap.state.winner
  snap.state.players[0]!.vp = 29
  snap.state.players[1]!.vp = 0
  snap.state.pending = []
  snap.state.clearings[4]!.pieces = [
    { id: 'w-atk', kind: 'warrior', owner: 0 },
    {
      id: 'b-def',
      kind: 'building',
      owner: 1,
      type: 'roost',
      used: false,
    },
  ]
  snap.state.players[0]!.hand = []
  snap.state.players[1]!.hand = []
  snap.rng = { seed: findDiceSeed(1, 0), cursor: 0 }

  const restored = Game.fromJSON(snap)
  if (restored.state.status !== 'playing' || restored.state.winner !== undefined) {
    throw new Error('winner snapshot must start unfinished')
  }
  await writeSnapshot('02-winner-menu.json', restored)
}

/**
 * Field Hospitals: Marquise daylight, 2v2 at rabbit C4, rabbit card in hand.
 * Dice [2,2] → both take 2 hits → FH → pay → warriors return to keep (C0).
 */
async function makeFieldHospital(): Promise<void> {
  const game = lobbyTwoPlaying(17)
  advanceToActions(game)
  const snap = game.toJSON()
  snap.state.clearings[4]!.pieces = [
    { id: 'w-m1', kind: 'warrior', owner: 0 },
    { id: 'w-m2', kind: 'warrior', owner: 0 },
    { id: 'w-e1', kind: 'warrior', owner: 1 },
    { id: 'w-e2', kind: 'warrior', owner: 1 },
  ]
  // Rabbit card matches C4 suit for Field Hospitals pay.
  snap.state.players[0]!.hand = [{ id: 'ROOT-212#fh', defId: 'ROOT-212' }]
  snap.state.players[1]!.hand = []
  snap.state.pending = []
  snap.rng = { seed: findDiceSeed(2, 2), cursor: 0 }

  const restored = Game.fromJSON(snap)
  const battle = restored.legalActions().find((spec) => spec.type === 'battle')
  const targets = battle?.params?.targets ?? []
  if (!targets.some((target) => target.clearing === 4 && target.defender === 1)) {
    throw new Error(`expected battle at C4, got ${JSON.stringify(targets)}`)
  }
  const keepClearing = restored.state.clearings.findIndex((clearing) =>
    clearing.pieces.some(
      (piece) => piece.kind === 'token' && piece.type === 'keep' && piece.owner === 0,
    ),
  )
  if (keepClearing < 0) {
    throw new Error('expected Marquise keep on map')
  }
  await writeSnapshot('03-field-hospital.json', restored)
}

/** Daylight actions — drawer should show Discard + End game, no Undo. */
async function makeNoUndoDrawer(): Promise<void> {
  const game = lobbyTwoPlaying(19)
  advanceToActions(game)
  await writeSnapshot('04-no-undo-drawer.json', game)
}

/** Discard pile with several cards. */
async function makeDiscardPile(): Promise<void> {
  const game = lobbyTwoPlaying(23)
  advanceToActions(game)
  const snap = game.toJSON()
  snap.state.deck.discard = [
    { id: 'ROOT-72#d1', defId: 'ROOT-72' },
    { id: 'ROOT-57#d1', defId: 'ROOT-57' },
    { id: 'ROOT-205#d1', defId: 'ROOT-205' },
    { id: 'ROOT-204#d1', defId: 'ROOT-204' },
    { id: 'ROOT-81#d1', defId: 'ROOT-81' },
  ]
  await writeSnapshot('05-discard-pile.json', Game.fromJSON(snap))
}

/** Evening discard with hand > 5 — raise cards then confirm. */
async function makeDiscardRaise(): Promise<void> {
  const game = lobbyTwoPlaying(29)
  const snap = game.toJSON()
  snap.state.currentSeat = 0
  snap.state.phase = 'evening'
  snap.state.step = 'discard'
  snap.state.pending = []
  snap.state.players[0]!.hand = [
    { id: 'c1', defId: 'ROOT-72' },
    { id: 'c2', defId: 'ROOT-57' },
    { id: 'c3', defId: 'ROOT-205' },
    { id: 'c4', defId: 'ROOT-204' },
    { id: 'c5', defId: 'ROOT-81' },
    { id: 'c6', defId: 'ROOT-71' },
    { id: 'c7', defId: 'ROOT-73' },
  ]
  const restored = Game.fromJSON(snap)
  if (!restored.legalActions().some((spec) => spec.type === 'discard')) {
    throw new Error('expected discard legal')
  }
  await writeSnapshot('06-discard-raise.json', restored)
}

/**
 * Ambush window: Marquise daylight battle into fox C0; Eyrie holds fox Ambush.
 * Video: battle → auto-open ambush → play → 2 hits on attacker.
 */
async function makeAmbushWindow(): Promise<void> {
  const game = lobbyTwoPlaying(31)
  advanceToActions(game)
  const snap = game.toJSON()
  snap.state.clearings[0]!.pieces = [
    { id: 'w-m1', kind: 'warrior', owner: 0 },
    { id: 'w-m2', kind: 'warrior', owner: 0 },
    { id: 'w-m3', kind: 'warrior', owner: 0 },
    { id: 'w-e', kind: 'warrior', owner: 1 },
  ]
  snap.state.players[0]!.hand = []
  snap.state.players[1]!.hand = [{ id: 'ROOT-202#amb', defId: 'ROOT-202' }]
  snap.state.pending = []
  snap.rng = { seed: findDiceSeed(1, 0), cursor: 0 }
  const restored = Game.fromJSON(snap)
  const battle = restored.legalActions().find((spec) => spec.type === 'battle')
  const targets = battle?.params?.targets ?? []
  if (!targets.some((target) => target.clearing === 0 && target.defender === 1)) {
    throw new Error(`expected battle at C0, got ${JSON.stringify(targets)}`)
  }
  await writeSnapshot('07-ambush-window.json', restored)
}

/** Only endPhase legal (evening discard hand ≤5). */
async function makeAutoEndPhase(): Promise<void> {
  const game = lobbyTwoPlaying(37)
  const snap = game.toJSON()
  snap.state.currentSeat = 0
  snap.state.phase = 'evening'
  snap.state.step = 'discard'
  snap.state.pending = []
  snap.state.players[0]!.hand = [
    { id: 'c1', defId: 'ROOT-72' },
    { id: 'c2', defId: 'ROOT-57' },
  ]
  const restored = Game.fromJSON(snap)
  const types = restored.legalActions().map((spec) => spec.type)
  if (types.length !== 1 || types[0] !== 'endPhase') {
    throw new Error(`expected sole endPhase, got ${types.join(',')}`)
  }
  await writeSnapshot('08-auto-end-phase.json', restored)
}

/**
 * Auto-remove warriors: daylight battle, dice [2,0], warrior-only (single combo).
 * Video: battle → dice → auto-remove (no chooser) → clear.
 */
async function makeAutoRemoveWarriors(): Promise<void> {
  const game = lobbyTwoPlaying(41)
  advanceToActions(game)
  const snap = game.toJSON()
  snap.state.clearings[4]!.pieces = [
    { id: 'w-atk1', kind: 'warrior', owner: 0 },
    { id: 'w-atk2', kind: 'warrior', owner: 0 },
    { id: 'w-d1', kind: 'warrior', owner: 1 },
    { id: 'w-d2', kind: 'warrior', owner: 1 },
  ]
  snap.state.players[0]!.hand = []
  snap.state.players[1]!.hand = []
  snap.state.pending = []
  snap.rng = { seed: findDiceSeed(2, 0), cursor: 0 }
  const restored = Game.fromJSON(snap)
  if (!restored.legalActions().some((spec) => spec.type === 'battle')) {
    throw new Error('expected battle')
  }
  await writeSnapshot('09-auto-remove-warriors.json', restored)
}

/** Zero-hit: daylight battle, forced 0–0 dice → flash. */
async function makeZeroHitBattle(): Promise<void> {
  const game = lobbyTwoPlaying(43)
  advanceToActions(game)
  const snap = game.toJSON()
  snap.state.clearings[9]!.pieces = [
    { id: 'w-a', kind: 'warrior', owner: 0 },
    { id: 'w-d', kind: 'warrior', owner: 1 },
  ]
  snap.state.players[0]!.hand = []
  snap.state.players[1]!.hand = []
  snap.state.pending = []
  snap.rng = { seed: findDiceSeed(0, 0), cursor: 0 }
  const restored = Game.fromJSON(snap)
  const battle = restored.legalActions().find((spec) => spec.type === 'battle')
  const targets = battle?.params?.targets ?? []
  if (!targets.some((target) => target.clearing === 9 && target.defender === 1)) {
    throw new Error(`expected battle at C9, got ${JSON.stringify(targets)}`)
  }
  await writeSnapshot('10-zero-hit-battle.json', restored)
}

/** Battle clearing highlight — start from daylight, battle into C10. */
async function makeBattleHighlight(): Promise<void> {
  const game = lobbyTwoPlaying(47)
  advanceToActions(game)
  const snap = game.toJSON()
  snap.state.clearings[10]!.pieces = [
    { id: 'w-a', kind: 'warrior', owner: 0 },
    { id: 'w-d', kind: 'warrior', owner: 1 },
  ]
  snap.state.players[0]!.hand = []
  snap.state.players[1]!.hand = []
  snap.state.pending = []
  snap.rng = { seed: findDiceSeed(1, 1), cursor: 0 }
  await writeSnapshot('11-battle-highlight.json', Game.fromJSON(snap))
}

/**
 * Banner prompts — same setup as Field Hospitals so video shows banner copy
 * through combat → FH prompt (specific event text, not generic).
 */
async function makeBannerPrompt(): Promise<void> {
  const game = lobbyTwoPlaying(53)
  advanceToActions(game)
  const snap = game.toJSON()
  snap.state.clearings[4]!.pieces = [
    { id: 'w-m1', kind: 'warrior', owner: 0 },
    { id: 'w-m2', kind: 'warrior', owner: 0 },
    { id: 'w-e1', kind: 'warrior', owner: 1 },
    { id: 'w-e2', kind: 'warrior', owner: 1 },
  ]
  snap.state.players[0]!.hand = [{ id: 'ROOT-212#banner', defId: 'ROOT-212' }]
  snap.state.players[1]!.hand = []
  snap.state.pending = []
  snap.rng = { seed: findDiceSeed(2, 2), cursor: 0 }
  await writeSnapshot('12-banner-prompt.json', Game.fromJSON(snap))
}

/** Ruins still on map (default setup has them). */
async function makeRuins(): Promise<void> {
  const game = lobbyTwoPlaying(59)
  advanceToActions(game)
  const withRuin = game.state.clearings.some((clearing) => clearing.ruin !== undefined)
  if (!withRuin) {
    throw new Error('expected ruins after setup')
  }
  await writeSnapshot('13-ruins.json', game)
}

/** Duplicate crafted items for grouping on faction board (bags×2, boots×2 exhausted). */
async function makeCraftedCounts(): Promise<void> {
  const game = lobbyTwoPlaying(61)
  advanceToActions(game)
  const snap = game.toJSON()
  snap.state.players[0]!.craftedItems = [
    { type: 'bag', exhausted: false },
    { type: 'tea', exhausted: false },
    { type: 'bag', exhausted: false },
    { type: 'boot', exhausted: true },
    { type: 'boot', exhausted: true },
  ]
  await writeSnapshot('14-crafted-counts.json', Game.fromJSON(snap))
}

/** March legal — tray locks once march started. */
async function makeMarchLock(): Promise<void> {
  const game = lobbyTwoPlaying(67)
  advanceToActions(game)
  if (!game.legalActions().some((spec) => spec.type === 'march')) {
    throw new Error('expected march')
  }
  await writeSnapshot('15-march-lock.json', game)
}

/** Eyrie decree with battle card — show suit in tray, then resolve. */
async function makeDecreeSuit(): Promise<void> {
  const game = lobbyTwoPlaying(71)
  const snap = game.toJSON()
  const [vizierRecruit, vizierMove] = makeViziers()
  const foxCard = { id: 'ROOT-72#decree', defId: 'ROOT-72' }
  snap.state.currentSeat = 1
  snap.state.phase = 'daylight'
  snap.state.step = 'decree'
  snap.state.pending = []
  snap.state.turnScratch = {
    ...snap.state.turnScratch,
    decree: { column: 'battle', remaining: [foxCard.id] },
    decreeDone: false,
  }
  const pools = eyrieLeaderPools('builder')
  snap.state.players[1]!.board = {
    kind: 'eyrie',
    supply: { warriors: 10 },
    leader: 'builder',
    leadersFaceUp: pools.leadersFaceUp,
    leadersFaceDown: pools.leadersFaceDown,
    decree: {
      recruit: [vizierRecruit],
      move: [vizierMove],
      battle: [foxCard],
      build: [],
    },
    roostTrack: { placed: 5 },
  }
  snap.state.players[0]!.hand = []
  snap.state.players[1]!.hand = []
  snap.state.clearings[0]!.pieces = [
    { id: 'r', kind: 'building', owner: 1, type: 'roost', used: false },
    { id: 'w1', kind: 'warrior', owner: 1 },
    { id: 'w0', kind: 'warrior', owner: 0 },
  ]
  snap.rng = { seed: findDiceSeed(1, 0), cursor: 0 }
  const restored = Game.fromJSON(snap)
  if (!restored.legalActions().some((spec) => spec.type === 'decree')) {
    throw new Error(
      `expected decree, got ${restored.legalActions().map((spec) => spec.type).join(',')}`,
    )
  }
  await writeSnapshot('16-decree-suit.json', restored)
}

/** Open slots visible — strip some buildings. */
async function makeSlotCounts(): Promise<void> {
  const game = lobbyTwoPlaying(73)
  advanceToActions(game)
  await writeSnapshot('17-slot-counts.json', game)
}

/** Eyrie craft step with roosts — craft the card. */
async function makeEyrieCraft(): Promise<void> {
  const game = lobbyTwoPlaying(79)
  const snap = game.toJSON()
  snap.state.currentSeat = 1
  snap.state.phase = 'daylight'
  snap.state.step = 'craft'
  snap.state.pending = []
  snap.state.players[1]!.hand = [{ id: 'ROOT-204#craft', defId: 'ROOT-204' }]
  snap.state.clearings[0]!.pieces = [
    { id: 'r', kind: 'building', owner: 1, type: 'roost', used: false },
    { id: 'w', kind: 'warrior', owner: 1 },
  ]
  const restored = Game.fromJSON(snap)
  if (!restored.legalActions().some((spec) => spec.type === 'craft')) {
    throw new Error(
      `expected craft, got ${restored.legalActions().map((spec) => spec.type).join(',')}`,
    )
  }
  await writeSnapshot('18-eyrie-craft.json', restored)
}

/** Board with mixed pieces — no rings on icons. */
async function makePieceRings(): Promise<void> {
  const game = lobbyTwoPlaying(83)
  advanceToActions(game)
  await writeSnapshot('19-piece-rings.json', game)
}

async function main(): Promise<void> {
  await mkdir(outDirectory, { recursive: true })
  await makeDefenselessBattle()
  await makeWinnerMenu()
  await makeFieldHospital()
  await makeNoUndoDrawer()
  await makeDiscardPile()
  await makeDiscardRaise()
  await makeAmbushWindow()
  await makeAutoEndPhase()
  await makeAutoRemoveWarriors()
  await makeZeroHitBattle()
  await makeBattleHighlight()
  await makeBannerPrompt()
  await makeRuins()
  await makeCraftedCounts()
  await makeMarchLock()
  await makeDecreeSuit()
  await makeSlotCounts()
  await makeEyrieCraft()
  await makePieceRings()
  console.log(`wrote bug snapshots under ${outDirectory}`)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
