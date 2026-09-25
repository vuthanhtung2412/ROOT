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
    <div className="pointer-events-none fixed bottom-3 left-1/2 z-[120] box-border flex max-w-[calc(100vw-16px)] -translate-x-1/2 flex-row items-end gap-1.5 overflow-x-auto border-2 border-ink bg-[color-mix(in_srgb,var(--color-parchment)_55%,transparent)] px-2 py-1.5 [background-blend-mode:multiply] [background-image:var(--root-paper-grain)] shadow-[inset_0_0_0_1px_var(--color-parchment-shadow),2px_3px_0_color-mix(in_srgb,var(--color-ink)_25%,transparent)] md:bottom-6 md:max-w-none md:gap-2.5 md:overflow-x-visible md:px-2.5 md:pt-2 md:pb-1.5">
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
        'pointer-events-auto m-0 box-border h-[88px] w-16 shrink-0 cursor-pointer border-2 border-ink bg-ink p-0 shadow-[1px_2px_0_color-mix(in_srgb,var(--color-ink)_35%,transparent)] transition-transform duration-75 ease-out md:h-[116px] md:w-[84px] md:shrink md:border-[3px]',
        props.selected
          ? 'border-gold -translate-y-3 shadow-[0_0_0_2px_color-mix(in_srgb,var(--color-gold)_80%,var(--color-ink)),2px_4px_0_color-mix(in_srgb,var(--color-ink)_35%,transparent)] md:-translate-y-[18px]'
          : '',
        props.dimmed ? 'opacity-45' : '',
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
