/**
 * Frontend QA: snapshot with many permanent crafted cards (playArea).
 * Run from repo root:
 *   cd lib && npx tsx ../.cursor/skills/QA/make-crafted-cards-snapshot.ts
 */
import { writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Game } from '../../../lib/src/index.ts'
import { FALL } from '../../../lib/src/map/fall.ts'
import { EP_CARD_DEFS } from '../../../lib/src/cards/ep.generated.ts'

const skillDirectory = path.dirname(fileURLToPath(import.meta.url))
const rootDirectory = path.resolve(skillDirectory, '../../..')
const outDirectory = path.join(rootDirectory, 'tmp/qa/snapshots')

const COPIES_PER_DEF = 3

function resolveSetup(game: Game): void {
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
}

function advanceToActions(game: Game): void {
  if (game.state.phase === 'birdsong') {
    game.apply({ type: 'endPhase' })
  }
  if (game.state.step === 'craft') {
    game.apply({ type: 'endPhase' })
  }
}

async function main(): Promise<void> {
  await mkdir(outDirectory, { recursive: true })

  const permanentDefIds = EP_CARD_DEFS.filter(
    (card) => card.type === 'persistent' || card.type === 'partisan',
  ).map((card) => card.defId)

  const game = Game.create({ seed: 3 })
  game.join('marquise')
  game.join('eyrie')
  game.start()
  resolveSetup(game)
  advanceToActions(game)

  const snap = game.toJSON()
  for (const player of snap.state.players) {
    const cards: Array<{ id: string; defId: string }> = []
    for (let copy = 0; copy < COPIES_PER_DEF; copy++) {
      for (const defId of permanentDefIds) {
        cards.push({
          id: `${defId}#qa-seat${String(player.seat)}-copy${String(copy)}-${String(cards.length)}`,
          defId,
        })
      }
    }
    player.playArea = cards
    console.log(
      `seat ${String(player.seat)} playArea=${String(cards.length)} (defs=${String(permanentDefIds.length)}×${String(COPIES_PER_DEF)})`,
    )
  }

  const restored = Game.fromJSON(snap)
  const filePath = path.join(outDirectory, 'crafted-cards-many.json')
  await writeFile(filePath, `${JSON.stringify(restored.toJSON(), null, 2)}\n`, 'utf8')
  console.log(`wrote ${filePath}`)
  console.log(
    `phase=${restored.state.phase}/${restored.state.step} seat=${String(restored.state.currentSeat)}`,
  )
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
