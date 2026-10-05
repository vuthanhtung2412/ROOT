import { useSyncExternalStore, type JSX, type MouseEvent } from 'react'
import { cardImagePublicPath } from '#assets/gameAssets.ts'
import {
  getCardPileSnapshot,
  getCompletedQuestsSnapshot,
  getCraftedCardsSnapshot,
  hideCardPile,
  hideCompletedQuests,
  hideCraftedCards,
  subscribeCardPile,
  subscribeCompletedQuests,
  subscribeCraftedCards,
} from '#game/cardGalleryBridge.ts'
import { getHudCallbacks } from '#game/hudStore.ts'
import { QuestCardFace } from '#react/QuestPilePanel.tsx'
import type { CardGalleryFace } from '#ui/cardGalleryTypes.ts'
import '#react/CardGalleryModal.css'

const EMPTY_CRAFTED_MESSAGE = 'No permanent crafted cards'
const EMPTY_COMPLETED_QUESTS_MESSAGE = 'No completed quests'
const DEFAULT_EMPTY_PILE_MESSAGE = 'Pile empty'

function CardStrip(props: {
  cards: readonly CardGalleryFace[]
  emptyMessage: string
  selectable: boolean
  selectedCardIds: ReadonlySet<string>
  onSelectCard: (cardId: string) => void
}): JSX.Element {
  if (props.cards.length === 0) {
    return (
      <p className="card-gallery-modal__empty">{props.emptyMessage}</p>
    )
  }
  return (
    <div className="card-gallery-modal__strip">
      {props.cards.map((card) => {
        const imagePath = cardImagePublicPath(card.defId)
        const isSelected = props.selectedCardIds.has(card.id)
        const className = [
          'card-gallery-modal__card',
          imagePath === null ? 'card-gallery-modal__card--fallback' : '',
          props.selectable ? 'card-gallery-modal__card--selectable' : '',
          isSelected ? 'card-gallery-modal__card--selected' : '',
        ]
          .filter((part) => part.length > 0)
          .join(' ')

        if (!props.selectable) {
          if (imagePath === null) {
            return (
              <div
                key={card.id}
                className={className}
                title={card.defId}
              />
            )
          }
          return (
            <img
              key={card.id}
              className={className}
              src={imagePath}
              alt={card.defId}
              draggable={false}
            />
          )
        }

        return (
          <button
            key={card.id}
            type="button"
            className={className}
            title={card.defId}
            aria-pressed={isSelected}
            onClick={() => {
              props.onSelectCard(card.id)
            }}
          >
            {imagePath === null ? null : (
              <img
                className="card-gallery-modal__card-image"
                src={imagePath}
                alt={card.defId}
                draggable={false}
              />
            )}
          </button>
        )
      })}
    </div>
  )
}

function CardGalleryShell(props: {
  title: string
  closeAriaLabel: string
  onClose: () => void
  /** When false, map/banner stay clickable; no dim veil. */
  blocksBackground: boolean
  children: JSX.Element
}): JSX.Element {
  const rootClassName = props.blocksBackground
    ? 'card-gallery-modal'
    : 'card-gallery-modal card-gallery-modal--nonblocking'
  return (
    <div
      className={rootClassName}
      role="dialog"
      aria-modal={props.blocksBackground}
      onClick={
        props.blocksBackground
          ? () => {
              props.onClose()
            }
          : undefined
      }
    >
      {props.blocksBackground ? (
        <div className="card-gallery-modal__veil" aria-hidden="true" />
      ) : null}
      {props.blocksBackground ? (
        <button
          type="button"
          className="card-gallery-modal__close"
          aria-label={props.closeAriaLabel}
          onClick={(event: MouseEvent<HTMLButtonElement>) => {
            event.stopPropagation()
            props.onClose()
          }}
        >
          ✕
        </button>
      ) : null}
      <div
        className="card-gallery-modal__panel"
        onClick={
          props.blocksBackground
            ? (event: MouseEvent<HTMLDivElement>) => {
                event.stopPropagation()
              }
            : undefined
        }
      >
        <h2 className="card-gallery-modal__title">{props.title}</h2>
        {props.children}
      </div>
    </div>
  )
}

export function CraftedCardsModal(): JSX.Element | null {
  const content = useSyncExternalStore(
    subscribeCraftedCards,
    getCraftedCardsSnapshot,
    getCraftedCardsSnapshot,
  )
  if (content === null) {
    return null
  }
  return (
    <CardGalleryShell
      title={`${content.faction} · crafted cards`}
      closeAriaLabel="Close crafted cards"
      blocksBackground={true}
      onClose={() => {
        hideCraftedCards()
      }}
    >
      <CardStrip
        cards={content.cards}
        emptyMessage={EMPTY_CRAFTED_MESSAGE}
        selectable={false}
        selectedCardIds={new Set()}
        onSelectCard={() => undefined}
      />
    </CardGalleryShell>
  )
}

export function CompletedQuestsModal(): JSX.Element | null {
  const content = useSyncExternalStore(
    subscribeCompletedQuests,
    getCompletedQuestsSnapshot,
    getCompletedQuestsSnapshot,
  )
  if (content === null) {
    return null
  }
  return (
    <CardGalleryShell
      title={`${content.faction} · completed quests`}
      closeAriaLabel="Close completed quests"
      blocksBackground={true}
      onClose={() => {
        hideCompletedQuests()
      }}
    >
      {content.quests.length === 0 ? (
        <p className="card-gallery-modal__empty">{EMPTY_COMPLETED_QUESTS_MESSAGE}</p>
      ) : (
        <div className="card-gallery-modal__quest-strip *:w-40 *:flex-none">
          {content.quests.map((quest) => (
            <QuestCardFace key={quest.id} quest={quest} />
          ))}
        </div>
      )}
    </CardGalleryShell>
  )
}

export function CardPileModal(): JSX.Element | null {
  const content = useSyncExternalStore(
    subscribeCardPile,
    getCardPileSnapshot,
    getCardPileSnapshot,
  )
  if (content === null) {
    return null
  }
  const selectable = content.selectable === true
  const selectedCardIds = new Set(content.selectedCardIds ?? [])
  return (
    <CardGalleryShell
      title={content.title}
      closeAriaLabel={selectable ? 'Abort card choice' : 'Close card pile'}
      blocksBackground={!selectable}
      onClose={() => {
        if (selectable) {
          getHudCallbacks().onBannerCancel()
          return
        }
        hideCardPile()
      }}
    >
      <CardStrip
        cards={content.cards}
        emptyMessage={content.emptyMessage ?? DEFAULT_EMPTY_PILE_MESSAGE}
        selectable={selectable}
        selectedCardIds={selectedCardIds}
        onSelectCard={(cardId) => {
          getHudCallbacks().onCardSelected(cardId)
        }}
      />
    </CardGalleryShell>
  )
}
