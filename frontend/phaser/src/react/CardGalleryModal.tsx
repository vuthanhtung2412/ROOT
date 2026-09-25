import { useSyncExternalStore, type JSX, type MouseEvent } from 'react'
import { cardImagePublicPath } from '#assets/gameAssets.ts'
import {
  getCardPileSnapshot,
  getCraftedCardsSnapshot,
  hideCardPile,
  hideCraftedCards,
  subscribeCardPile,
  subscribeCraftedCards,
} from '#game/cardGalleryBridge.ts'
import type { CardGalleryFace } from '#ui/cardGalleryTypes.ts'
import '#react/CardGalleryModal.css'

const EMPTY_CRAFTED_MESSAGE = 'No permanent crafted cards'
const DEFAULT_EMPTY_PILE_MESSAGE = 'Pile empty'

function CardStrip(props: {
  cards: readonly CardGalleryFace[]
  emptyMessage: string
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
        if (imagePath === null) {
          return (
            <div
              key={card.id}
              className="card-gallery-modal__card card-gallery-modal__card--fallback"
              title={card.defId}
            />
          )
        }
        return (
          <img
            key={card.id}
            className="card-gallery-modal__card"
            src={imagePath}
            alt={card.defId}
            draggable={false}
          />
        )
      })}
    </div>
  )
}

function CardGalleryShell(props: {
  title: string
  closeAriaLabel: string
  onClose: () => void
  children: JSX.Element
}): JSX.Element {
  return (
    <div
      className="card-gallery-modal"
      role="dialog"
      aria-modal="true"
      onClick={() => {
        props.onClose()
      }}
    >
      <div className="card-gallery-modal__veil" aria-hidden="true" />
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
      <div
        className="card-gallery-modal__panel"
        onClick={(event: MouseEvent<HTMLDivElement>) => {
          event.stopPropagation()
        }}
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
      onClose={() => {
        hideCraftedCards()
      }}
    >
      <CardStrip cards={content.cards} emptyMessage={EMPTY_CRAFTED_MESSAGE} />
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
  return (
    <CardGalleryShell
      title={content.title}
      closeAriaLabel="Close card pile"
      onClose={() => {
        hideCardPile()
      }}
    >
      <CardStrip
        cards={content.cards}
        emptyMessage={content.emptyMessage ?? DEFAULT_EMPTY_PILE_MESSAGE}
      />
    </CardGalleryShell>
  )
}
