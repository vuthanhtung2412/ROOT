import type { JSX } from 'react'
import type { VagabondBoardViewModel, VagabondQuestView } from '#ui/factionBoardViewModel.ts'

const QUEST_CARD_CLASS_NAME =
  'flex flex-col gap-0.5 rounded-[3px] border-l-4 bg-[rgb(248_242_224/0.92)] px-2 py-1.5 text-[#1c1a14]'
const QUEST_SUIT_BORDER_CLASS_NAMES: Readonly<Record<string, string>> = {
  fox: 'border-l-[#b54a2a]',
  mouse: 'border-l-[#c47a2c]',
  rabbit: 'border-l-[#c9a227]',
}
const QUEST_UNKNOWN_SUIT_BORDER_CLASS_NAME = 'border-l-[#888]'
const QUEST_DETAIL_CLASS_NAME = 'text-[11px] leading-[1.2] capitalize'
const QUEST_FOOTNOTE_CLASS_NAME = 'text-[11px] opacity-80'

export function QuestCardFace(props: { quest: VagabondQuestView }): JSX.Element {
  const suitBorderClassName =
    QUEST_SUIT_BORDER_CLASS_NAMES[props.quest.suit] ??
    QUEST_UNKNOWN_SUIT_BORDER_CLASS_NAME
  return (
    <div className={`${QUEST_CARD_CLASS_NAME} ${suitBorderClassName}`}>
      <div className="text-[13px] leading-[1.2] font-bold">
        {props.quest.name}
      </div>
      <div className={QUEST_DETAIL_CLASS_NAME}>{props.quest.suit}</div>
      <div className={QUEST_DETAIL_CLASS_NAME}>
        {props.quest.items.join(' + ')}
      </div>
    </div>
  )
}

/** Face-up shared quest pile (side of Vagabond board). */
export function QuestPilePanel(props: {
  view: VagabondBoardViewModel
}): JSX.Element {
  return (
    <div
      className="pointer-events-auto relative z-2 flex size-full flex-col gap-1.5 overflow-y-auto rounded border border-[rgb(230_220_190/0.35)] bg-[rgb(20_24_18/0.72)] p-1.5 font-body text-[#f3ecd8]"
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
        props.view.questsAvailable.map((quest) => (
          <QuestCardFace key={quest.id} quest={quest} />
        ))
      )}
      {props.view.completedQuests.length > 0 ? (
        <div className={QUEST_FOOTNOTE_CLASS_NAME}>
          done {String(props.view.completedQuests.length)}
        </div>
      ) : null}
    </div>
  )
}
