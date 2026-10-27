/**
 * Pre-battle QA snapshots: Eyrie is attacker, user casts battle.
 * RNG is parked so the next two dice are 3–3. After Skip ambush, the
 * click-to-pick removal / item-damage tiles open (shared RemovalPickOption UX).
 *
 *   pnpm --filter @root/lib exec tsx ../.cursor/skills/QA/make-battle-removal-qa-snapshots.ts
 *
 * Load: `/?qaSnapshot=tmp/qa/snapshots/<name>.json` → QA: Continue loaded game
 * → decree Battle → Skip ambush → click tiles → Confirm.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defOf } from '../../../lib/src/cards/Deck.ts'
import { Game } from '../../../lib/src/index.ts'
import { FALL } from '../../../lib/src/map/fall.ts'
import type { ItemType } from '../../../lib/src/pieces/types.ts'
import type { Piece } from '../../../lib/src/pieces/types.ts'
import { createTurnScratch } from '../../../lib/src/state/turnScratch.ts'
import type { GameSnapshot } from '../../../lib/src/state/types.ts'

const skillDirectory = path.dirname(fileURLToPath(import.meta.url))
const rootDirectory = path.resolve(skillDirectory, '../../..')
const outDirectory = path.join(rootDirectory, 'tmp/qa/snapshots')

/** SeededRng faces 3 then 3 at this cursor (verified). */
const DICE_THREE_THREE_RNG = { seed: 0, cursor: 44 } as const
/** Clearing with 3 building slots on the fall map. */
const BATTLE_CLEARING = 10
const BIRD_VIZIER = { id: 'qa-vizier-battle', defId: 'VIZIER' } as const

type RemovalKind = 'pieces' | 'items'

type SnapshotCase = {
  fileName: string
  label: string
  /** Seat order for `Game.create({ factions })`. */
  factions: readonly string[]
  eyrieSeat: number
  defenderSeat: number
  defenderPieces: Piece[]
  eyrieWarriorCount: number
  removalKind: RemovalKind
  /** Extra undamaged satchel items so Vagabond must choose (hits < item count). */
  vagabondSatchel?: readonly ItemType[]
}

function finishSetup(game: Game): void {
  while (game.state.pending.length > 0) {
    const pendingType = game.state.pending[0]?.type
    const legal = game.legalActions()[0]
    if (legal === undefined) {
      throw new Error(`no legal action for pending ${String(pendingType)}`)
    }
    if (pendingType === 'chooseKeep' || pendingType === 'placeStartingBuilding') {
      const clearing = legal.params?.clearing?.[0]
      if (typeof clearing !== 'number') {
        throw new Error(`expected clearing for ${String(pendingType)}`)
      }
      game.apply({ type: 'resolveEvent', clearing })
      continue
    }
    if (pendingType === 'chooseLeader') {
      game.apply({ type: 'resolveEvent', leader: 'builder' })
      continue
    }
    if (pendingType === 'chooseCharacter') {
      game.apply({ type: 'resolveEvent', character: 'thief' })
      continue
    }
    if (pendingType === 'chooseForest') {
      const forest = legal.params?.forests?.[0]
      if (typeof forest !== 'number') {
        throw new Error('expected forests for chooseForest')
      }
      game.apply({ type: 'resolveEvent', forest })
      continue
    }
    throw new Error(`unexpected pending ${String(pendingType)}`)
  }
}

function stockVagabondSatchel(
  snapshot: GameSnapshot,
  vagabondSeat: number,
  itemTypes: readonly ItemType[],
): void {
  const player = snapshot.state.players[vagabondSeat]
  if (player === undefined || player.board.kind !== 'vagabond') {
    throw new Error('expected vagabond board')
  }
  player.board.forest = null
  player.board.tracks = { tea: [], coin: [], bag: [] }
  player.board.damaged = []
  player.board.satchel = itemTypes.map((type) => ({
    type,
    exhausted: false,
  }))
}

function stripAmbushAndEffects(snapshot: GameSnapshot): void {
  for (const player of snapshot.state.players) {
    player.hand = player.hand.filter((card) => defOf(card).type !== 'ambush')
    player.playArea = []
  }
}

function prepareEyrieBattleReady(input: {
  snapshot: GameSnapshot
  eyrieSeat: number
  defenderSeat: number
  defenderPieces: Piece[]
  eyrieWarriorCount: number
}): GameSnapshot {
  const { snapshot, eyrieSeat, defenderSeat, defenderPieces, eyrieWarriorCount } =
    input
  snapshot.state.currentSeat = eyrieSeat
  snapshot.state.phase = 'daylight'
  snapshot.state.step = 'decree'
  snapshot.state.pending = []
  snapshot.state.turnScratch = createTurnScratch()
  snapshot.rng = { ...DICE_THREE_THREE_RNG }

  const eyriePlayer = snapshot.state.players[eyrieSeat]
  if (eyriePlayer === undefined || eyriePlayer.board.kind !== 'eyrie') {
    throw new Error('expected eyrie board')
  }
  eyriePlayer.board.leader = 'builder'
  eyriePlayer.board.decree = {
    recruit: [],
    move: [],
    battle: [{ ...BIRD_VIZIER }],
    build: [],
  }

  stripAmbushAndEffects(snapshot)

  const eyrieWarriors: Piece[] = Array.from(
    { length: eyrieWarriorCount },
    (_, index) => ({
      id: `qa-eyrie-w${String(index)}`,
      kind: 'warrior',
      owner: eyrieSeat,
    }),
  )
  const battleClearing = snapshot.state.clearings[BATTLE_CLEARING]
  if (battleClearing === undefined) {
    throw new Error(`missing clearing ${String(BATTLE_CLEARING)}`)
  }
  battleClearing.pieces = [...defenderPieces, ...eyrieWarriors]

  const loaded = Game.fromJSON(snapshot)
  const battleSpec = loaded.legalActions().find((spec) => {
    if (spec.type !== 'decree') {
      return false
    }
    const targets = spec.params?.targets
    if (!Array.isArray(targets)) {
      return false
    }
    return targets.some(
      (target) =>
        typeof target === 'object' &&
        target !== null &&
        Reflect.get(target, 'clearing') === BATTLE_CLEARING &&
        Reflect.get(target, 'defender') === defenderSeat,
    )
  })
  if (battleSpec === undefined) {
    throw new Error(
      `no decree battle vs seat ${String(defenderSeat)} in clearing ${String(BATTLE_CLEARING)}`,
    )
  }
  return loaded.toJSON()
}

function assertDiceAndRemoval(
  snapshot: GameSnapshot,
  defenderSeat: number,
  removalKind: RemovalKind,
): void {
  const game = Game.fromJSON(snapshot)
  const eyrieSeat = game.state.currentSeat
  game.apply({
    type: 'decree',
    column: 'battle',
    cardId: BIRD_VIZIER.id,
    clearing: BATTLE_CLEARING,
    defender: defenderSeat,
  })
  // Skip ambush (no ambush cards left in hands).
  game.apply({ type: 'resolveEvent', decline: true })
  const pending = game.state.pending[0]
  if (pending === undefined || pending.type !== 'battle') {
    throw new Error(`expected battle pending, got ${JSON.stringify(pending)}`)
  }
  const rolls = Reflect.get(pending, 'rolls')
  if (!Array.isArray(rolls) || rolls[0] !== 3 || rolls[1] !== 3) {
    throw new Error(`expected rolls [3,3], got ${JSON.stringify(rolls)}`)
  }
  if (removalKind === 'items') {
    const itemPick = game.legalActions().find(
      (spec) =>
        spec.type === 'resolveEvent' &&
        spec.params?.vagabondItems !== undefined,
    )
    const itemCount = itemPick?.params?.itemCount?.[0]
    const itemOptions = itemPick?.params?.vagabondItems
    if (
      itemPick === undefined ||
      typeof itemCount !== 'number' ||
      !Array.isArray(itemOptions) ||
      itemOptions.length <= itemCount
    ) {
      throw new Error(
        `expected Vagabond item-damage choice (hits < items), got ${JSON.stringify(itemPick?.params)}`,
      )
    }
    console.log(
      JSON.stringify({
        rolls,
        stage: Reflect.get(pending, 'stage'),
        itemHits: itemCount,
        itemOptions: itemOptions.length,
        actor: eyrieSeat,
        defender: defenderSeat,
      }),
    )
    return
  }
  const removalChoices = game
    .legalActions()
    .filter(
      (spec) =>
        spec.type === 'resolveEvent' && spec.params?.pieceIds !== undefined,
    )
  if (removalChoices.length < 2) {
    throw new Error(
      `expected multi piece-removal choices for seat ${String(defenderSeat)}, got ${String(removalChoices.length)}`,
    )
  }
  console.log(
    JSON.stringify({
      rolls,
      stage: Reflect.get(pending, 'stage'),
      removalChoices: removalChoices.length,
      actor: eyrieSeat,
      defender: defenderSeat,
    }),
  )
}

const CASES: readonly SnapshotCase[] = [
  {
    fileName: 'battle-removal-cat.json',
    label: 'Marquise defender — buildings/tokens click-pick',
    factions: ['marquise', 'eyrie'],
    eyrieSeat: 1,
    defenderSeat: 0,
    eyrieWarriorCount: 4,
    removalKind: 'pieces',
    defenderPieces: [
      { id: 'qa-cat-w1', kind: 'warrior', owner: 0 },
      { id: 'qa-wood1', kind: 'token', owner: 0, type: 'wood' },
      { id: 'qa-wood2', kind: 'token', owner: 0, type: 'wood' },
      {
        id: 'qa-saw',
        kind: 'building',
        owner: 0,
        type: 'sawmill',
        used: false,
      },
      {
        id: 'qa-shop',
        kind: 'building',
        owner: 0,
        type: 'workshop',
        used: false,
      },
      {
        id: 'qa-rec',
        kind: 'building',
        owner: 0,
        type: 'recruiter',
        used: false,
      },
    ],
  },
  {
    fileName: 'battle-removal-woodland.json',
    label: 'Alliance defender — warrior + base + sympathy click-pick',
    factions: ['eyrie', 'alliance'],
    eyrieSeat: 0,
    defenderSeat: 1,
    eyrieWarriorCount: 4,
    removalKind: 'pieces',
    defenderPieces: [
      { id: 'qa-wa-w1', kind: 'warrior', owner: 1 },
      { id: 'qa-base', kind: 'building', owner: 1, type: 'base' },
      { id: 'qa-sym1', kind: 'token', owner: 1, type: 'sympathy' },
      { id: 'qa-sym2', kind: 'token', owner: 1, type: 'sympathy' },
      { id: 'qa-sym3', kind: 'token', owner: 1, type: 'sympathy' },
    ],
  },
  {
    fileName: 'battle-removal-vagabond.json',
    label: 'Vagabond defender — item damage click-pick',
    factions: ['eyrie', 'vagabond'],
    eyrieSeat: 0,
    defenderSeat: 1,
    eyrieWarriorCount: 4,
    removalKind: 'items',
    // 5 undamaged > 3 hits → must choose which items to damage.
    vagabondSatchel: ['boot', 'torch', 'sword', 'tea', 'hammer'],
    defenderPieces: [{ id: 'qa-vb-pawn', kind: 'pawn', owner: 1 }],
  },
]

async function writeCase(snapshotCase: SnapshotCase): Promise<void> {
  const game = Game.create({
    seed: 42,
    factions: [...snapshotCase.factions],
  })
  for (let seat = 0; seat < snapshotCase.factions.length; seat += 1) {
    game.join(`qa-player-${String(seat)}`)
  }
  game.start()
  finishSetup(game)

  const draft = game.toJSON()
  if (snapshotCase.vagabondSatchel !== undefined) {
    stockVagabondSatchel(
      draft,
      snapshotCase.defenderSeat,
      snapshotCase.vagabondSatchel,
    )
  }

  const ready = prepareEyrieBattleReady({
    snapshot: draft,
    eyrieSeat: snapshotCase.eyrieSeat,
    defenderSeat: snapshotCase.defenderSeat,
    defenderPieces: snapshotCase.defenderPieces,
    eyrieWarriorCount: snapshotCase.eyrieWarriorCount,
  })
  assertDiceAndRemoval(
    ready,
    snapshotCase.defenderSeat,
    snapshotCase.removalKind,
  )

  const filePath = path.join(outDirectory, snapshotCase.fileName)
  await writeFile(filePath, `${JSON.stringify(ready, null, 2)}\n`, 'utf8')
  console.log(
    `${snapshotCase.fileName}: ${snapshotCase.label} clearing=${String(BATTLE_CLEARING)} path=${filePath}`,
  )
}

async function main(): Promise<void> {
  await mkdir(outDirectory, { recursive: true })
  // Keep FALL import used (map SoT for clearing slot count).
  if (FALL.clearings[BATTLE_CLEARING] === undefined) {
    throw new Error('battle clearing missing on fall map')
  }
  for (const snapshotCase of CASES) {
    await writeCase(snapshotCase)
  }
}

await main()
