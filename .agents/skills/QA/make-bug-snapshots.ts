/**
 * Build GameSnapshots for BUG.md frontend QA videos.
 * Run from repo root:
 *   cd lib && npx tsx ../.cursor/skills/QA/make-bug-snapshots.ts
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

/** Marquise daylight actions with building-only enemy in clearing 4. */
async function makeDefenselessBattle(): Promise<void> {
  const game = lobbyTwoPlaying(11)
  advanceToActions(game)
  const snap = game.toJSON()
  // Clearing 4: marquise warriors + eyrie roost only (no eyrie warriors = defenseless).
  // Must use roost (not sawmill) — sawmill art is Marquise-only and looks like own building.
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
 * Starts unfinished so the QA video can play into the winner overlay.
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
  // Next two battle dice = 1, 0 → one attacker hit on the roost.
  let foundSeed: number | null = null
  for (let seed = 0; seed < 50_000; seed++) {
    const probe = new SeededRng({ seed, cursor: 0 })
    if (probe.roll() === 1 && probe.roll() === 0) {
      foundSeed = seed
      break
    }
  }
  if (foundSeed === null) {
    throw new Error('no seed with rolls 1 then 0')
  }
  snap.rng = { seed: foundSeed, cursor: 0 }

  const restored = Game.fromJSON(snap)
  if (restored.state.status !== 'playing' || restored.state.winner !== undefined) {
    throw new Error('winner snapshot must start unfinished')
  }
  if (restored.state.players[0]!.vp !== 29) {
    throw new Error('expected marquise at 29 VP')
  }
  const battle = restored.legalActions().find((spec) => spec.type === 'battle')
  const targets = battle?.params?.targets ?? []
  if (!targets.some((target) => target.clearing === 4 && target.defender === 1)) {
    throw new Error(
      `expected battle vs roost at C4, got ${JSON.stringify(targets)}`,
    )
  }
  await writeSnapshot('02-winner-menu.json', restored)
}

/** Field Hospitals pending for Marquise (victim 0). */
async function makeFieldHospital(): Promise<void> {
  const game = lobbyTwoPlaying(17)
  advanceToActions(game)
  const snap = game.toJSON()
  snap.state.pending = [
    { type: 'fieldHospital', victim: 0, clearing: 10, count: 2 },
  ]
  // Matching fox card in hand for pay option (clearing 10 = mouse though — use mouse card).
  // C10 is mouse. Put mouse card in hand.
  snap.state.players[0]!.hand = [
    { id: 'ROOT-205#fh', defId: 'ROOT-205' }, // mouse ambush? check suits
    { id: 'ROOT-72#fh', defId: 'ROOT-72' }, // fox
  ]
  // Use clearing suit: FALL.clearings[10] = mouse. Need mouse-matching card.
  // ROOT-203 is mouse ambush typically. Put several suits.
  const restored = Game.fromJSON(snap)
  const legal = restored.legalActions()
  if (!legal.some((spec) => spec.type === 'resolveEvent')) {
    throw new Error('expected fieldHospital resolveEvent legal')
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

/** Evening discard with hand > 5. */
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

/** Battle ambush pending — defender has matching ambush. */
async function makeAmbushWindow(): Promise<void> {
  const game = lobbyTwoPlaying(31)
  advanceToActions(game)
  const snap = game.toJSON()
  // C0 fox — put fox ambush in marquise hand (defender).
  snap.state.clearings[0]!.pieces = [
    { id: 'w-e', kind: 'warrior', owner: 1 },
    { id: 'w-m', kind: 'warrior', owner: 0 },
  ]
  snap.state.players[0]!.hand = [{ id: 'ROOT-202#amb', defId: 'ROOT-202' }] // fox ambush
  snap.state.currentSeat = 1
  snap.state.pending = [
    {
      type: 'battle',
      clearing: 0,
      attacker: 1,
      defender: 0,
      stage: 'ambush',
      hits: { attacker: 0, defender: 0 },
    },
  ]
  const restored = Game.fromJSON(snap)
  const legal = restored.legalActions()
  if (legal[0]?.actor !== 0) {
    throw new Error(`expected defender actor, got ${JSON.stringify(legal)}`)
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

/** Battle removeDefender — warrior-only hits (single combo → auto-remove). */
async function makeAutoRemoveWarriors(): Promise<void> {
  const game = lobbyTwoPlaying(41)
  advanceToActions(game)
  const snap = game.toJSON()
  snap.state.clearings[4]!.pieces = [
    { id: 'w-atk', kind: 'warrior', owner: 1 },
    { id: 'w-d1', kind: 'warrior', owner: 0 },
    { id: 'w-d2', kind: 'warrior', owner: 0 },
  ]
  snap.state.pending = [
    {
      type: 'battle',
      clearing: 4,
      attacker: 1,
      defender: 0,
      stage: 'removeDefender',
      rolls: [2, 0],
      hits: { attacker: 2, defender: 0 },
      effectsOrder: [1, 0],
      effectsUsed: { attacker: false, defender: false },
    },
  ]
  const restored = Game.fromJSON(snap)
  if (
    !restored
      .legalActions()
      .some((spec) => spec.type === 'resolveEvent' && spec.params?.pieceIds)
  ) {
    throw new Error('expected removal specs')
  }
  await writeSnapshot('09-auto-remove-warriors.json', restored)
}

/** Battle about to resolve with forced 0–0 dice → zero-hit flash. */
async function makeZeroHitBattle(): Promise<void> {
  const game = lobbyTwoPlaying(43)
  advanceToActions(game)
  const snap = game.toJSON()
  snap.state.clearings[9]!.pieces = [
    { id: 'w-a', kind: 'warrior', owner: 1 },
    { id: 'w-d', kind: 'warrior', owner: 0 },
  ]
  snap.state.pending = [
    {
      type: 'battle',
      clearing: 9,
      attacker: 1,
      defender: 0,
      stage: 'ambush',
      hits: { attacker: 0, defender: 0 },
    },
  ]
  snap.state.players[0]!.hand = []
  snap.state.players[1]!.hand = []
  // Find seed whose next two rolls are 0,0 (attacker then defender die).
  let foundSeed: number | null = null
  for (let seed = 0; seed < 50_000; seed++) {
    const probe = new SeededRng({ seed, cursor: 0 })
    if (probe.roll() === 0 && probe.roll() === 0) {
      foundSeed = seed
      break
    }
  }
  if (foundSeed === null) {
    throw new Error('no seed with consecutive 0,0 rolls')
  }
  snap.rng = { seed: foundSeed, cursor: 0 }
  const restored = Game.fromJSON(snap)
  if (
    !restored.legalActions().some(
      (spec) =>
        spec.type === 'resolveEvent' &&
        Array.isArray(spec.params?.decline) &&
        spec.params.decline.includes(true),
    )
  ) {
    throw new Error('expected ambush decline')
  }
  await writeSnapshot('10-zero-hit-battle.json', restored)
}

/** Battle pending for clearing highlight. */
async function makeBattleHighlight(): Promise<void> {
  const game = lobbyTwoPlaying(47)
  advanceToActions(game)
  const snap = game.toJSON()
  snap.state.clearings[10]!.pieces = [
    { id: 'w-a', kind: 'warrior', owner: 1 },
    { id: 'w-d', kind: 'warrior', owner: 0 },
  ]
  snap.state.pending = [
    {
      type: 'battle',
      clearing: 10,
      attacker: 1,
      defender: 0,
      stage: 'ambush',
      hits: { attacker: 0, defender: 0 },
    },
  ]
  // No ambush cards → only decline
  snap.state.players[0]!.hand = []
  await writeSnapshot('11-battle-highlight.json', Game.fromJSON(snap))
}

/** Field hospital / battle for banner copy. Reuse FH. */
async function makeBannerPrompt(): Promise<void> {
  const game = lobbyTwoPlaying(53)
  const snap = game.toJSON()
  snap.state.pending = [
    { type: 'fieldHospital', victim: 0, clearing: 5, count: 1 },
  ]
  snap.state.players[0]!.hand = []
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

/** Duplicate crafted items for grouping. */
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

/** Eyrie decree with battle card — show suit in tray. */
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
  // Ensure battle possible: warriors + enemy in fox clearing 0
  snap.state.clearings[0]!.pieces = [
    { id: 'r', kind: 'building', owner: 1, type: 'roost', used: false },
    { id: 'w1', kind: 'warrior', owner: 1 },
    { id: 'w0', kind: 'warrior', owner: 0 },
  ]
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

/** Eyrie craft step with roosts (visual craft power). */
async function makeEyrieCraft(): Promise<void> {
  const game = lobbyTwoPlaying(79)
  const snap = game.toJSON()
  snap.state.currentSeat = 1
  snap.state.phase = 'daylight'
  snap.state.step = 'craft'
  snap.state.pending = []
  snap.state.players[1]!.hand = [{ id: 'ROOT-204#craft', defId: 'ROOT-204' }] // hammer fox
  // Roost on fox clearing 0
  snap.state.clearings[0]!.pieces = [
    { id: 'r', kind: 'building', owner: 1, type: 'roost', used: false },
    { id: 'w', kind: 'warrior', owner: 1 },
  ]
  await writeSnapshot('18-eyrie-craft.json', Game.fromJSON(snap))
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
