/**
 * Frontend QA: Automated Alliance and Vagabot boards filled so every measured
 * spot on the photo scans shows a piece (sympathy track, bases box, crafted
 * items, battle track, satchel, damaged box, character card).
 *
 *   cd lib && pnpm exec tsx ../.agents/skills/QA/make-clockwork-boards-snapshot.ts
 *
 * Writes: tmp/qa/snapshots/clockwork-boards.json
 */
import { writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Game } from '../../../lib/src/index.ts'
import { finishSetup } from '../../../lib/src/test/fixtures.ts'
import type { FactionId, ItemType } from '../../../lib/src/pieces/types.ts'
import type { CraftedItem } from '../../../lib/src/state/types.ts'
import type { VagabotItem } from '../../../lib/src/state/botBoards.ts'

const skillDirectory: string = path.dirname(fileURLToPath(import.meta.url))
const rootDirectory: string = path.resolve(skillDirectory, '../../..')
const outDirectory: string = path.join(rootDirectory, 'tmp/qa/snapshots')
const OUT_NAME = 'clockwork-boards.json'
const SEED = 20261027
const HUMAN_PLAYER_ID = 'human-marquise'
const FACTIONS: readonly FactionId[] = ['marquise', 'automatedAlliance', 'vagabot']

/** Fills the Alliance crafted items box (one row of items). */
const ALLIANCE_CRAFTED_ITEM_TYPES: readonly ItemType[] = ['boot', 'sword', 'tea', 'coin']
const BATTLE_TRACK_ITEM_TYPES: readonly ItemType[] = ['sword', 'crossbow', 'hammer']
/** Face up and face down mixed, so both looks show in the satchel. */
const SATCHEL_ITEMS: readonly { type: ItemType; exhausted: boolean }[] = [
  { type: 'boot', exhausted: false },
  { type: 'boot', exhausted: true },
  { type: 'torch', exhausted: false },
  { type: 'tea', exhausted: false },
  { type: 'coin', exhausted: true },
  { type: 'bag', exhausted: false },
]
const DAMAGED_ITEM_TYPES: readonly ItemType[] = ['hammer', 'boot', 'sword']

function vagabotItem(type: ItemType, flags: Omit<VagabotItem, 'type'>): VagabotItem {
  return { type, ...flags }
}

async function main(): Promise<void> {
  const game: Game = Game.create({ seed: SEED, factions: [...FACTIONS] })
  game.join(HUMAN_PLAYER_ID)
  game.start()
  finishSetup(game)

  const snapshot = game.toJSON()
  const players = snapshot.state.players.map((player) => {
    if (player.board.kind === 'automatedAlliance') {
      const craftedItems: CraftedItem[] = ALLIANCE_CRAFTED_ITEM_TYPES.map(
        (type: ItemType): CraftedItem => ({ type, exhausted: false }),
      )
      return { ...player, craftedItems }
    }
    if (player.board.kind === 'vagabot') {
      const items: VagabotItem[] = [
        ...BATTLE_TRACK_ITEM_TYPES.map((type: ItemType): VagabotItem =>
          vagabotItem(type, { exhausted: false, damaged: false, onBattleTrack: true }),
        ),
        ...SATCHEL_ITEMS.map((item): VagabotItem =>
          vagabotItem(item.type, { exhausted: item.exhausted, damaged: false, onBattleTrack: false }),
        ),
        ...DAMAGED_ITEM_TYPES.map((type: ItemType): VagabotItem =>
          vagabotItem(type, { exhausted: false, damaged: true, onBattleTrack: false }),
        ),
      ]
      return { ...player, board: { ...player.board, items } }
    }
    return player
  })

  const restored: Game = Game.fromJSON({ ...snapshot, state: { ...snapshot.state, players } })
  await mkdir(outDirectory, { recursive: true })
  const filePath: string = path.join(outDirectory, OUT_NAME)
  await writeFile(filePath, `${JSON.stringify(restored.toJSON(), null, 2)}\n`, 'utf8')
  const seats: string = restored.state.players
    .map((player) => `${player.faction}:${player.board.kind}`)
    .join(' ')
  console.log(`${OUT_NAME}: seat=${String(restored.state.currentSeat)} ${seats}`)
  console.log(`wrote ${filePath}`)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
