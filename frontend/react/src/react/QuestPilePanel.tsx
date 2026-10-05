import type { JSX } from 'react'
import { getHudCallbacks } from '#game/hudStore.ts'
import { findQuestSpec } from '#game/vagabondQuest.ts'
import {
  BOARD_CLICKABLE_OUTLINE_CLASS_NAME,
  useActingPlayerActions,
} from '#react/boardActions.ts'
import type { VagabondBoardViewModel, VagabondQuestView } from '#ui/factionBoardViewModel.ts'

const QUEST_FOOTNOTE_CLASS_NAME = 'text-[11px] opacity-80'
const CLAIM_QUEST_HINT = 'Claim this quest'

/** Spoken summary of a quest card face (suit + the two items it costs). */
export function questCardLabel(quest: VagabondQuestView): string {
  return `${quest.name}, ${quest.suit} quest: ${quest.items.join(' + ')}`
}

export function QuestCardFace(props: { quest: VagabondQuestView }): JSX.Element {
  return (
    <img
      className="block h-auto w-full rounded-md select-none"
      src={props.quest.imagePath}
      alt={questCardLabel(props.quest)}
      draggable={false}
    />
  )
}

/**
 * Face-up shared quest pile (side of Vagabond board). Rule: 9.5.5 Quest —
 * quests the acting Vagabond can complete now are outlined; click to claim.
 */
export function QuestPilePanel(props: {
  view: VagabondBoardViewModel
}): JSX.Element {
  const actions = useActingPlayerActions()
  return (
    <div
      className="pointer-events-auto relative z-2 flex size-full flex-col gap-2 overflow-y-auto rounded border border-[rgb(230_220_190/0.35)] bg-[rgb(20_24_18/0.72)] p-2 font-body text-[#f3ecd8]"
      aria-label={`Quests (${String(props.view.questsAvailable.length)} face up, ${String(props.view.questDeckCount)} in deck)`}
    >
      <div className="flex items-baseline justify-between text-[12px] tracking-[0.04em] uppercase opacity-90">
        Quests
        <span className={QUEST_FOOTNOTE_CLASS_NAME}>
          deck {String(props.view.questDeckCount)}
        </span>
      </div>
      {props.view.questsAvailable.length === 0 ? (
        <div className={QUEST_FOOTNOTE_CLASS_NAME}>No face-up quests</div>
      ) : (
        props.view.questsAvailable.map((quest) => {
          const questSpec = findQuestSpec(actions, {
            seat: props.view.seat,
            questId: quest.id,
          })
          if (questSpec === null) {
            return <QuestCardFace key={quest.id} quest={quest} />
          }
          return (
            <button
              key={quest.id}
              type="button"
              className={`block w-full ${BOARD_CLICKABLE_OUTLINE_CLASS_NAME} hover:brightness-110`}
              title={CLAIM_QUEST_HINT}
              aria-label={`${CLAIM_QUEST_HINT}: ${questCardLabel(quest)}`}
              onClick={() => {
                getHudCallbacks().onQuestPicked(questSpec)
              }}
            >
              <QuestCardFace quest={quest} />
            </button>
          )
        })
      )}
      {props.view.completedQuests.length > 0 ? (
        <div className={QUEST_FOOTNOTE_CLASS_NAME}>
          done {String(props.view.completedQuests.length)}
        </div>
      ) : null}
    </div>
  )
}
