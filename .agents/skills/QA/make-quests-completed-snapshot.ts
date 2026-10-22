/**
 * 4p UI QA snapshot — Vagabond with many completed quests (several per suit).
 * Built on top of `ui-busy.json`, so run `make-ui-busy-snapshot.ts` first.
 *
 *   cd lib && pnpm exec tsx ../.cursor/skills/QA/make-quests-completed-snapshot.ts
 *   pnpm --filter @root/cli start -- load <abs-path>/tmp/qa/snapshots/vagabond-quests-completed.json
 *   React → Continue loaded game
 */
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Game } from '../../../lib/src/index.ts'
import { expandQuestDeck } from '../../../lib/src/cards/quests.ts'
import type { QuestCard } from '../../../lib/src/cards/quests.ts'
import type { GameSnapshot } from '../../../lib/src/state/types.ts'

const skillDirectory: string = path.dirname(fileURLToPath(import.meta.url))
const rootDirectory: string = path.resolve(skillDirectory, '../../..')
const snapshotDirectory: string = path.join(rootDirectory, 'tmp/qa/snapshots')
const BASE_SNAPSHOT_NAME = 'ui-busy.json'
const OUT_NAME = 'vagabond-quests-completed.json'

// Three fox, three mouse, two rabbit — in the order they were completed.
const COMPLETED_QUEST_DEFINITION_IDS: readonly string[] = [
  'QUEST-F-FUNDS',
  'QUEST-M-ESCORT',
  'QUEST-R-SPEECH',
  'QUEST-F-LOGS',
  'QUEST-M-BEAR',
  'QUEST-F-SPEECH',
  'QUEST-R-ERRAND',
  'QUEST-M-LOGS',
]

// One per suit, each payable from the unexhausted satchel of `ui-busy.json`.
const AVAILABLE_QUEST_DEFINITION_IDS: readonly string[] = [
  'QUEST-F-SHED',
  'QUEST-M-BANDITS',
  'QUEST-R-GUARD',
]

function pickQuests(
  questCards: readonly QuestCard[],
  definitionIds: readonly string[],
): QuestCard[] {
  return definitionIds.map((definitionId: string): QuestCard => {
    const questCard: QuestCard | undefined = questCards.find(
      (candidate: QuestCard) => candidate.defId === definitionId,
    )
    if (questCard === undefined) {
      throw new Error(`unknown quest defId: ${definitionId}`)
    }
    return questCard
  })
}

async function main(): Promise<void> {
  const basePath: string = path.join(snapshotDirectory, BASE_SNAPSHOT_NAME)
  const snapshot: GameSnapshot = Game.fromJSON(
    JSON.parse(await readFile(basePath, 'utf8')),
  ).toJSON()

  const allQuestCards: QuestCard[] = expandQuestDeck()
  const completedQuests: QuestCard[] = pickQuests(
    allQuestCards,
    COMPLETED_QUEST_DEFINITION_IDS,
  )
  const availableQuests: QuestCard[] = pickQuests(
    allQuestCards,
    AVAILABLE_QUEST_DEFINITION_IDS,
  )
  const questIdsInPlay: Set<string> = new Set(
    [...completedQuests, ...availableQuests].map(
      (questCard: QuestCard) => questCard.id,
    ),
  )

  const vagabondPlayer = snapshot.state.players.find(
    (player) => player.faction === 'vagabond',
  )
  if (vagabondPlayer === undefined || vagabondPlayer.board.kind !== 'vagabond') {
    throw new Error(`no vagabond seat in ${BASE_SNAPSHOT_NAME}`)
  }
  vagabondPlayer.board.completedQuests = completedQuests
  snapshot.state.questsAvailable = availableQuests
  snapshot.state.questDeck = allQuestCards.filter(
    (questCard: QuestCard) => !questIdsInPlay.has(questCard.id),
  )

  const restored: Game = Game.fromJSON(snapshot)
  const filePath: string = path.join(snapshotDirectory, OUT_NAME)
  await writeFile(
    filePath,
    `${JSON.stringify(restored.toJSON(), null, 2)}\n`,
    'utf8',
  )

  console.log(
    JSON.stringify(
      {
        path: filePath,
        phase: `${restored.state.phase}/${restored.state.step}`,
        seat: restored.state.currentSeat,
        completedQuests: completedQuests.map((questCard) => questCard.defId),
        questsAvailable: restored.state.questsAvailable.map(
          (questCard) => questCard.defId,
        ),
        questDeck: restored.state.questDeck.map((questCard) => questCard.defId),
        legalActions: [
          ...new Set(restored.legalActions().map((spec) => spec.type)),
        ],
      },
      null,
      2,
    ),
  )
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
