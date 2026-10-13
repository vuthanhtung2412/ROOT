import {
  useRef,
  useSyncExternalStore,
  type JSX,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import {
  cardImagePublicPath,
  lookupCardCatalog,
} from '#assets/gameAssets.ts'
import {
  getHudCallbacks,
  getHudSnapshot,
  patchHud,
  subscribeHud,
  type CardHandHudState,
} from '#game/hudStore.ts'
import type { ActionSpec, GameState } from '#api/client.ts'
import {
  useDecreeCardDrag,
  type DecreeCardDrag,
} from '#react/DecreeCardDrag.tsx'
import { buildTurnBannerViewModel } from '#ui/TurnBanner.ts'

const CARD_HOLD_MILLISECONDS = 350

/**
 * Cards held like a fan, no tray behind them. Wide: the fan peeks over the
 * bottom edge so it covers less of the board; hover lifts a card clear.
 */
const HAND_CLASS_NAME =
  'pointer-events-none fixed bottom-3 left-1/2 z-120 box-border flex max-w-[calc(100vw-16px)] -translate-x-1/2 flex-row items-end overflow-x-auto px-3 pt-4 md:-bottom-14 md:max-w-none md:overflow-x-visible md:px-0 md:pt-0'
const HAND_CARD_CLASS_NAME =
  'pointer-events-auto relative -mx-1 box-border h-22 w-16 shrink-0 origin-bottom cursor-root-pointer overflow-hidden rounded-md border-2 border-ink-deep bg-ink p-0 shadow-card transition-[translate] duration-100 ease-out hover:z-1 md:-mx-2.5 md:h-39 md:w-28 md:shrink md:border-3 md:hover:-translate-y-12'
const HAND_CARD_SELECTED_CLASS_NAME =
  'z-1 border-gold -translate-y-3 shadow-card-selected md:-translate-y-12'
/** A touch drag moves the card, not the page. */
const HAND_CARD_DRAGGABLE_CLASS_NAME = 'touch-none'
const HAND_CARD_DRAGGED_CLASS_NAME = 'opacity-30'
/** Tilt between neighbouring cards, and the widest the whole fan may open. */
const FAN_STEP_DEGREES = 5
const FAN_MAX_SPREAD_DEGREES = 24

/** Tilt of one card: the middle of the hand stands upright. */
function fanDegreesOf(cardIndex: number, cardCount: number): number {
  if (cardCount <= 1) {
    return 0
  }
  const lastCardIndex: number = cardCount - 1
  const stepDegrees: number = Math.min(
    FAN_STEP_DEGREES,
    FAN_MAX_SPREAD_DEGREES / lastCardIndex,
  )
  return (cardIndex - lastCardIndex / 2) * stepDegrees
}

const NO_CARD_IDS: readonly string[] = []

function stagedDecreeCardIds(): readonly string[] {
  return getHudSnapshot().decreePanel?.view.stagedCardIds ?? NO_CARD_IDS
}

/** Hand cards that can be dragged onto a slot of the open Decree panel. */
function draggableDecreeCardIds(): readonly string[] {
  const panel = getHudSnapshot().decreePanel
  return panel !== null && panel.isOpen
    ? panel.view.stageableCardIds
    : NO_CARD_IDS
}

function draggedDecreeCardId(): string | null {
  return getHudSnapshot().decreeDrag?.cardId ?? null
}

export function CardHand(): JSX.Element | null {
  const hand = useSyncExternalStore(
    subscribeHud,
    () => getHudSnapshot().cardHand,
    () => getHudSnapshot().cardHand,
  )
  const stagedCardIds: readonly string[] = useSyncExternalStore(
    subscribeHud,
    stagedDecreeCardIds,
    stagedDecreeCardIds,
  )
  const draggableCardIds: readonly string[] = useSyncExternalStore(
    subscribeHud,
    draggableDecreeCardIds,
    draggableDecreeCardIds,
  )
  const draggedCardId: string | null = useSyncExternalStore(
    subscribeHud,
    draggedDecreeCardId,
    draggedDecreeCardId,
  )
  if (hand === null) {
    return null
  }
  const seat =
    hand.localSeat ??
    buildTurnBannerViewModel(hand.state, hand.legalActions).actorSeat
  const player = hand.state.players.find((entry) => entry.seat === seat)
  // A card staged in the Decree panel lies there, not in the hand.
  const cards = (player?.hand ?? []).filter(
    (card) => !stagedCardIds.includes(card.id),
  )
  if (cards.length === 0) {
    return null
  }
  const selected = new Set(hand.selectedCardIds)
  const enabled =
    hand.enabledCardIds === null ? null : new Set(hand.enabledCardIds)
  const callbacks = getHudCallbacks()

  return (
    <div className={HAND_CLASS_NAME}>
      {cards.map((card, cardIndex: number) => {
        const isSelected = selected.has(card.id)
        const isDimmed = enabled !== null && !enabled.has(card.id)
        return (
          <HandCard
            key={card.id}
            cardId={card.id}
            defId={card.defId}
            selected={isSelected}
            dimmed={isDimmed}
            draggable={draggableCardIds.includes(card.id)}
            dragged={draggedCardId === card.id}
            fanDegrees={fanDegreesOf(cardIndex, cards.length)}
            onSelect={() => {
              callbacks.onCardSelected(card.id)
            }}
            onHold={() => {
              const catalog = lookupCardCatalog(card.defId)
              if (catalog === null) {
                return
              }
              callbacks.onCardHold({
                defId: card.defId,
                catalog,
              })
            }}
          />
        )
      })}
    </div>
  )
}

function HandCard(props: {
  cardId: string
  defId: string
  selected: boolean
  dimmed: boolean
  /** May be dragged onto a Decree panel slot. */
  draggable: boolean
  /** Being dragged: a faded copy stays in the hand. */
  dragged: boolean
  fanDegrees: number
  onSelect: () => void
  onHold: () => void
}): JSX.Element {
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const holdFiredRef = useRef(false)
  const imagePath = cardImagePublicPath(props.defId)

  function clearHoldTimer(): void {
    if (holdTimerRef.current !== null) {
      clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
    }
  }

  const drag: DecreeCardDrag = useDecreeCardDrag({
    cardId: props.cardId,
    defId: props.defId,
    isDraggable: props.draggable,
    onDragStart: clearHoldTimer,
  })

  function onPointerDown(event: ReactPointerEvent<HTMLButtonElement>): void {
    holdFiredRef.current = false
    clearHoldTimer()
    holdTimerRef.current = setTimeout(() => {
      holdFiredRef.current = true
      props.onHold()
    }, CARD_HOLD_MILLISECONDS)
    drag.onPointerDown(event)
  }

  function onPointerUp(): void {
    clearHoldTimer()
    // Released after a drag: the drop is handled, the card is not picked.
    if (!holdFiredRef.current && !drag.isDragging()) {
      props.onSelect()
    }
  }

  function onPointerLeave(): void {
    clearHoldTimer()
  }

  return (
    <button
      type="button"
      className={[
        HAND_CARD_CLASS_NAME,
        props.selected ? HAND_CARD_SELECTED_CLASS_NAME : '',
        props.dimmed ? 'opacity-45' : '',
        props.draggable ? HAND_CARD_DRAGGABLE_CLASS_NAME : '',
        props.dragged ? HAND_CARD_DRAGGED_CLASS_NAME : '',
      ]
        .filter((part) => part.length > 0)
        .join(' ')}
      style={{ rotate: `${String(props.fanDegrees)}deg` }}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      onPointerCancel={onPointerLeave}
    >
      {imagePath !== null ? (
        <img
          className="pointer-events-none block size-full object-cover"
          src={imagePath}
          alt={props.defId}
          draggable={false}
        />
      ) : (
        <div className="block size-full bg-ink-soft" />
      )}
    </button>
  )
}

export function syncCardHand(input: {
  state: GameState
  legalActions: readonly ActionSpec[]
  localSeat: number | null
}): void {
  const previous = getHudSnapshot().cardHand
  const next: CardHandHudState = {
    state: input.state,
    legalActions: input.legalActions,
    localSeat: input.localSeat,
    selectedCardIds: previous?.selectedCardIds ?? [],
    enabledCardIds: previous?.enabledCardIds ?? null,
  }
  patchHud({
    cardHand: next,
  })
}

export function setCardHandSelection(selectedCardIds: readonly string[]): void {
  const previous = getHudSnapshot().cardHand
  if (previous === null) {
    return
  }
  patchHud({
    cardHand: {
      ...previous,
      selectedCardIds,
    },
  })
}

export function setCardHandEnabledCards(
  enabledCardIds: readonly string[] | null,
): void {
  const previous = getHudSnapshot().cardHand
  if (previous === null) {
    return
  }
  patchHud({
    cardHand: {
      ...previous,
      enabledCardIds,
    },
  })
}
