import { useLayoutEffect, useRef, type JSX } from 'react'
import type { IconType } from 'react-icons'
import { LuChevronDown, LuChevronUp, LuLayers } from 'react-icons/lu'
import type { ActionSpec } from '#api/client.ts'
import { lookupCardCatalog, type CardCatalogEntry } from '#assets/gameAssets.ts'
import { getHudCallbacks } from '#game/hudStore.ts'
import { actionIconFor } from '#ui/actionIcons.ts'
import type { CardActionRow, CardActionRowState } from '#ui/cardActionRows.ts'

/** Same delay as holding a hand card (CardHand). */
const CARD_HOLD_MILLISECONDS = 350
const PLAYED_TAG = 'played'
const CARDS_TAB_LABEL = 'Cards'

/** Paper tab above the dock frame: opens the panel of crafted-card actions. */
const CARDS_TAB_CLASS_NAME =
  'action-dock__cards-tab root-paper root-paper-fine root-paper-press m-0 flex flex-row items-center gap-1.5 px-2 py-0.5 font-display text-lg whitespace-nowrap text-ink [--root-paper-color:var(--color-parchment)]'
const CARDS_TAB_TALLY_CLASS_NAME = 'font-mono text-xs opacity-75'
/** Sheet that unfolds upward from the dock. */
const PANEL_CLASS_NAME =
  'action-dock__cards-panel root-paper absolute right-0 bottom-[calc(100%+40px)] w-88 max-w-[calc(100vw-16px)] p-2.5 [--root-paper-color:var(--color-parchment)]'
/** About three lines tall; the rest scrolls. */
const LIST_CLASS_NAME =
  'flex max-h-51 flex-col gap-2 overflow-y-auto pr-2 [scrollbar-color:var(--color-ink)_var(--color-parchment-shadow)] [scrollbar-width:thin]'
const ROW_CLASS_NAME =
  'action-dock__card-action m-0 flex w-full shrink-0 flex-row items-center gap-2.5 rounded-xs border-0 bg-transparent px-1.5 py-1 text-left text-ink select-none'
/** Lit on hover only: inverted ink, unlike the gold ring of a staged tile. */
const ROW_READY_CLASS_NAME =
  'cursor-root-pointer hover:bg-ink hover:text-parchment'
/** Another phase, or already played: pale, dashed, not clickable. */
const ROW_OFF_CLASS_NAME =
  'cursor-root-not-allowed opacity-45 hover:bg-parchment-shadow hover:opacity-60 hover:outline-2 hover:-outline-offset-2 hover:outline-ink-soft hover:outline-dashed'
const ROW_ICON_CLASS_NAME =
  'root-paper root-paper-fine flex size-10 shrink-0 items-center justify-center text-[22px] text-ink [--root-paper-color:var(--color-cream)]'
const ROW_NAME_CLASS_NAME = 'block font-display text-base leading-tight capitalize'
const ROW_RULE_CLASS_NAME =
  'line-clamp-2 font-body text-[11px] leading-tight opacity-80'
const ROW_TAG_CLASS_NAME =
  'ml-auto pl-2 font-mono text-[10px] font-bold whitespace-nowrap uppercase'

const ROW_STATE_CLASS_NAMES: Readonly<Record<CardActionRowState, string>> = {
  ready: ROW_READY_CLASS_NAME,
  played: ROW_OFF_CLASS_NAME,
  off: ROW_OFF_CLASS_NAME,
}

export function CardsTab(props: {
  tally: string
  isOpen: boolean
  onToggle: () => void
}): JSX.Element {
  const Chevron: IconType = props.isOpen ? LuChevronDown : LuChevronUp
  return (
    <button
      type="button"
      className={CARDS_TAB_CLASS_NAME}
      aria-expanded={props.isOpen}
      onClick={props.onToggle}
    >
      <LuLayers className="text-base" aria-hidden="true" />
      {CARDS_TAB_LABEL}
      <span className={CARDS_TAB_TALLY_CLASS_NAME}>{props.tally}</span>
      <Chevron className="text-base" aria-hidden="true" />
    </button>
  )
}

/** Click starts the action; hold shows the crafted card, as holding a hand card does. */
function CardActionLine(props: {
  row: CardActionRow
  isCurrentPhase: boolean
  onPlay: (spec: ActionSpec) => void
}): JSX.Element {
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const holdFiredRef = useRef(false)
  const catalog: CardCatalogEntry | null = lookupCardCatalog(props.row.defId)
  const ActionIcon: IconType = actionIconFor(props.row.actionType)
  const isPlayed: boolean = props.row.state === 'played'

  function clearHoldTimer(): void {
    if (holdTimerRef.current !== null) {
      clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
    }
  }

  function onPointerDown(): void {
    holdFiredRef.current = false
    clearHoldTimer()
    holdTimerRef.current = setTimeout(() => {
      holdFiredRef.current = true
      if (catalog !== null) {
        getHudCallbacks().onCardHold({ defId: props.row.defId, catalog })
      }
    }, CARD_HOLD_MILLISECONDS)
  }

  function onPointerUp(): void {
    clearHoldTimer()
    if (!holdFiredRef.current && props.row.spec !== null) {
      props.onPlay(props.row.spec)
    }
  }

  return (
    <button
      type="button"
      className={`${ROW_CLASS_NAME} ${ROW_STATE_CLASS_NAMES[props.row.state]}`}
      aria-disabled={props.row.state !== 'ready'}
      data-current-phase={props.isCurrentPhase}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={clearHoldTimer}
      onPointerCancel={clearHoldTimer}
    >
      <span className={ROW_ICON_CLASS_NAME} aria-hidden="true">
        <ActionIcon />
      </span>
      <span className="min-w-0">
        <span
          className={
            isPlayed
              ? `${ROW_NAME_CLASS_NAME} line-through`
              : ROW_NAME_CLASS_NAME
          }
        >
          {props.row.label}
        </span>
        {catalog !== null ? (
          <span className={ROW_RULE_CLASS_NAME}>{catalog.description}</span>
        ) : null}
      </span>
      <span className={ROW_TAG_CLASS_NAME}>
        {isPlayed ? PLAYED_TAG : props.row.phase}
      </span>
    </button>
  )
}

export function CardsPanel(props: {
  rows: readonly CardActionRow[]
  phase: string
  onPlay: (spec: ActionSpec) => void
}): JSX.Element {
  const listRef = useRef<HTMLDivElement | null>(null)

  // Opens on the first action of the current phase.
  useLayoutEffect(() => {
    const list: HTMLDivElement | null = listRef.current
    const firstOfPhase: HTMLElement | null =
      list?.querySelector<HTMLElement>('[data-current-phase="true"]') ?? null
    if (list !== null && firstOfPhase !== null) {
      list.scrollTop = firstOfPhase.offsetTop - list.offsetTop
    }
  }, [props.phase])

  return (
    <div className={PANEL_CLASS_NAME}>
      <div ref={listRef} className={LIST_CLASS_NAME}>
        {props.rows.map((row) => (
          <CardActionLine
            key={row.actionType}
            row={row}
            isCurrentPhase={row.phase === props.phase}
            onPlay={props.onPlay}
          />
        ))}
      </div>
    </div>
  )
}
