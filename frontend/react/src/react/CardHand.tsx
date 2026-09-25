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
import { buildTurnBannerViewModel } from '#ui/TurnBanner.ts'
import '#react/CardHand.css'

const CARD_HOLD_MILLISECONDS = 350

export function CardHand(): JSX.Element | null {
  const hand = useSyncExternalStore(
    subscribeHud,
    () => getHudSnapshot().cardHand,
    () => getHudSnapshot().cardHand,
  )
  if (hand === null) {
    return null
  }
  const seat =
    hand.localSeat ??
    buildTurnBannerViewModel(hand.state, hand.legalActions).actorSeat
  const player = hand.state.players.find((entry) => entry.seat === seat)
  const cards = player?.hand ?? []
  if (cards.length === 0) {
    return null
  }
  const selected = new Set(hand.selectedCardIds)
  const enabled =
    hand.enabledCardIds === null ? null : new Set(hand.enabledCardIds)
  const callbacks = getHudCallbacks()

  return (
    <div className="card-hand">
      {cards.map((card) => {
        const isSelected = selected.has(card.id)
        const isDimmed = enabled !== null && !enabled.has(card.id)
        return (
          <HandCard
            key={card.id}
            cardId={card.id}
            defId={card.defId}
            selected={isSelected}
            dimmed={isDimmed}
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

  function onPointerDown(_event: ReactPointerEvent<HTMLButtonElement>): void {
    holdFiredRef.current = false
    clearHoldTimer()
    holdTimerRef.current = setTimeout(() => {
      holdFiredRef.current = true
      props.onHold()
    }, CARD_HOLD_MILLISECONDS)
  }

  function onPointerUp(): void {
    clearHoldTimer()
    if (!holdFiredRef.current) {
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
        'card-hand__card',
        props.selected ? 'card-hand__card--selected' : '',
        props.dimmed ? 'card-hand__card--dimmed' : '',
      ]
        .filter((part) => part.length > 0)
        .join(' ')}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      onPointerCancel={onPointerLeave}
    >
      {imagePath !== null ? (
        <img
          className="card-hand__face"
          src={imagePath}
          alt={props.defId}
          draggable={false}
        />
      ) : (
        <div className="card-hand__face card-hand__face--fallback" />
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
