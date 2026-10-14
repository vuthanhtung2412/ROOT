import type { JSX } from 'react'
import type { IconType } from 'react-icons'
import type { ActionSpec } from '#api/client.ts'
import { suitTextureKey } from '#assets/gameAssets.ts'
import { SuitIcon } from '#react/SuitIcon.tsx'
import { Tooltip } from '#react/Tooltip.tsx'
import { actionIconFor } from '#ui/actionIcons.ts'
import {
  nextResolvableDecreeSpec,
  type DecreeCardMark,
  type DecreeColumnState,
  type DecreeColumnView,
} from '#ui/decreeColumns.ts'

/** The four columns side by side, as on the Eyrie faction board. */
const DECREE_CLASS_NAME = 'action-dock__decree flex flex-row gap-2.5'
/** Not the step that resolves the Decree: pale and grey (no card has an action yet). */
const DECREE_DISABLED_CLASS_NAME = 'cursor-root-not-allowed opacity-45 grayscale'
const COLUMN_CLASS_NAME = 'flex w-15.5 flex-col items-center'
/** Round medallion naming the column by its action. */
const HEAD_CLASS_NAME =
  'root-paper root-paper-fine z-1 m-0 flex size-14 shrink-0 items-center justify-center p-0 text-3xl text-parchment [--root-paper-color:var(--color-eyrie)] [--root-paper-radius:9999px]'
/** Gold ring: the column the Decree resolves now. */
const HEAD_NOW_CLASS_NAME = 'rounded-full shadow-gold-ring'
const HEAD_DONE_CLASS_NAME = 'opacity-50'
/** Strip under the medallion holding the column's cards as suits. */
const STRIP_CLASS_NAME =
  'root-paper root-paper-fine -mt-3 flex min-h-21 w-14.5 flex-row flex-wrap content-start justify-center gap-1 px-1 pt-4.5 pb-2 [--root-paper-color:var(--color-parchment-shadow)]'
const MARK_CLASS_NAME = 'block size-5.5 object-contain'
/** Holds a suit and, once resolved, the stroke crossing it out. */
const MARK_FRAME_CLASS_NAME = 'relative block'
/** A resolved suit fades, outline included; the stroke over it does not. */
const MARK_ART_CLASS_NAME = 'block'
const MARK_ART_RESOLVED_CLASS_NAME = 'opacity-35 grayscale'
/** Diagonal stroke over a resolved card. */
const MARK_CROSS_CLASS_NAME =
  'pointer-events-none absolute top-1/2 left-1/2 h-0.5 w-[130%] -translate-1/2 -rotate-45 bg-ink-deep'
/** A card that can be resolved now: its suit is the button. */
const MARK_BUTTON_CLASS_NAME =
  'action-tray__action m-0 cursor-root-pointer rounded-full border-0 bg-transparent p-0 shadow-gold-ring hover:brightness-110'

const HEAD_STATE_CLASS_NAMES: Readonly<Record<DecreeColumnState, string>> = {
  done: HEAD_DONE_CLASS_NAME,
  now: HEAD_NOW_CLASS_NAME,
  later: '',
}

function markLabel(column: string, card: DecreeCardMark): string {
  return card.suit !== null ? `${column}: ${card.suit}` : column
}

function SuitMark(props: {
  column: string
  card: DecreeCardMark
  onSelectAction: (spec: ActionSpec) => void
}): JSX.Element | null {
  const suit: string | null = props.card.suit
  if (suit === null || suitTextureKey(suit) === null) {
    return null
  }
  const label: string = markLabel(props.column, props.card)
  const spec: ActionSpec | null = props.card.spec
  if (spec === null || props.card.isResolved) {
    return (
      <span className={MARK_FRAME_CLASS_NAME}>
        <span
          className={
            props.card.isResolved
              ? `${MARK_ART_CLASS_NAME} ${MARK_ART_RESOLVED_CLASS_NAME}`
              : MARK_ART_CLASS_NAME
          }
        >
          <SuitIcon suit={suit} className={MARK_CLASS_NAME} alt={label} />
        </span>
        {props.card.isResolved ? (
          <span className={MARK_CROSS_CLASS_NAME} aria-hidden="true" />
        ) : null}
      </span>
    )
  }
  return (
    <Tooltip label={label}>
      <button
        type="button"
        className={MARK_BUTTON_CLASS_NAME}
        onClick={() => {
          props.onSelectAction(spec)
        }}
      >
        <SuitIcon suit={suit} className={MARK_CLASS_NAME} />
        <span className="sr-only">{label}</span>
      </button>
    </Tooltip>
  )
}

function DecreeColumn(props: {
  view: DecreeColumnView
  onSelectAction: (spec: ActionSpec) => void
}): JSX.Element {
  const ColumnIcon: IconType = actionIconFor(props.view.column)
  const resolvedCount: number = props.view.cards.filter(
    (card) => card.isResolved,
  ).length
  const label: string = `${props.view.column} ${String(resolvedCount)}/${String(props.view.cards.length)}`
  // Medallion: non-bird first. Suit mark still picks a given card.
  const nextSpec: ActionSpec | null = nextResolvableDecreeSpec(props.view.cards)
  const headClassName: string = `${HEAD_CLASS_NAME} ${HEAD_STATE_CLASS_NAMES[props.view.state]}`
  return (
    <div className={COLUMN_CLASS_NAME}>
      <Tooltip label={label} className="z-1 flex">
        {nextSpec !== null ? (
          <button
            type="button"
            className={`action-dock__decree-head root-paper-press ${headClassName}`}
            onClick={() => {
              props.onSelectAction(nextSpec)
            }}
          >
            <ColumnIcon aria-hidden="true" />
            <span className="sr-only">{label}</span>
          </button>
        ) : (
          <span className={headClassName}>
            <ColumnIcon aria-hidden="true" />
          </span>
        )}
      </Tooltip>
      <div className={STRIP_CLASS_NAME}>
        {props.view.cards.map((card) => (
          <SuitMark
            key={card.cardId}
            column={props.view.column}
            card={card}
            onSelectAction={props.onSelectAction}
          />
        ))}
      </div>
    </div>
  )
}

/** Eyrie Daylight: the Decree is the tray, a medallion and a strip per column. */
export function DecreeColumns(props: {
  columns: readonly DecreeColumnView[]
  /** Before the step that resolves the Decree: shown, not playable. */
  isDisabled: boolean
  onSelectAction: (spec: ActionSpec) => void
}): JSX.Element {
  return (
    <div
      className={
        props.isDisabled
          ? `${DECREE_CLASS_NAME} ${DECREE_DISABLED_CLASS_NAME}`
          : DECREE_CLASS_NAME
      }
      aria-disabled={props.isDisabled}
    >
      {props.columns.map((view) => (
        <DecreeColumn
          key={view.column}
          view={view}
          onSelectAction={props.onSelectAction}
        />
      ))}
    </div>
  )
}
