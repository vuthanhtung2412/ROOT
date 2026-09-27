import type { JSX } from 'react'
import type { VagabondBoardViewModel, VagabondQuestView } from '#ui/factionBoardViewModel.ts'

export function QuestCardFace(props: { quest: VagabondQuestView }): JSX.Element {
  return (
    <div
      className={`faction-board-modal__quest-card faction-board-modal__quest-card--${props.quest.suit}`}
    >
      <div className="faction-board-modal__quest-name">{props.quest.name}</div>
      <div className="faction-board-modal__quest-suit">{props.quest.suit}</div>
      <div className="faction-board-modal__quest-items">
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
      className="faction-board-modal__quest-pile faction-board-modal__quest-pile--side"
      aria-label={`Quests (${String(props.view.questsAvailable.length)} face up, ${String(props.view.questDeckCount)} in deck)`}
    >
      <div className="faction-board-modal__quest-pile-header">
        Quests
        <span className="faction-board-modal__quest-deck-count">
          deck {String(props.view.questDeckCount)}
        </span>
      </div>
      {props.view.questsAvailable.length === 0 ? (
        <div className="faction-board-modal__quest-empty">No face-up quests</div>
      ) : (
        props.view.questsAvailable.map((quest) => (
          <QuestCardFace key={quest.id} quest={quest} />
        ))
      )}
      {props.view.completedQuests.length > 0 ? (
        <div className="faction-board-modal__quest-completed">
          done {String(props.view.completedQuests.length)}
        </div>
      ) : null}
    </div>
  )
}
