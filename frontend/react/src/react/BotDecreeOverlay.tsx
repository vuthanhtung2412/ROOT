import type { CSSProperties, JSX } from 'react'
import { SuitIcon } from '#react/SuitIcon.tsx'
import type { ActiveDecreeColumn, BotCardView } from '#ui/botBoardViewModel.ts'

/**
 * Electric Eyrie Decree on the printed board: one suit icon per card in the
 * dark band above each column frame, so the printed suit stays visible.
 * The column the bot resolves next gets a gold frame and its action.
 */

const COLUMN_CLASS_NAME = 'group pointer-events-auto absolute outline-none'
const ACTIVE_COLUMN_CLASS_NAME =
  'rounded-sm outline-3 outline-offset-1 outline-gold-light shadow-[0_0_16px_rgb(251_233_168/0.85)]'
/** The band above the frame: a little wider than the frame, to fit more cards. */
const ICON_ROW_CLASS_NAME =
  'absolute -right-[10%] bottom-[106%] -left-[10%] flex h-[42%] flex-row items-center justify-center gap-[3%]'
const ICON_CLASS_NAME = 'block h-full w-auto object-contain select-none drop-shadow-[0_1px_1px_rgb(0_0_0/0.5)]'
const VIZIER_ICON_WRAPPER_CLASS_NAME = 'relative inline-flex h-full'
const VIZIER_BADGE_CLASS_NAME =
  'absolute -right-1 -bottom-1 rounded-xs bg-gold-light px-0.5 font-mono text-[clamp(6px,0.8vw,10px)] leading-none font-bold text-ink-deep'
const VIZIER_BADGE_TEXT = 'V'
const ACTION_LABEL_CLASS_NAME =
  'absolute top-[106%] left-1/2 -translate-x-1/2 rounded-xs bg-gold-light px-1.5 font-mono text-[clamp(8px,1vw,12px)] font-bold tracking-wider whitespace-nowrap text-ink-deep uppercase'
/** Hover or focus a column: its cards, full size, with their names. */
const POPOVER_CLASS_NAME =
  'absolute top-[125%] left-1/2 z-10 hidden -translate-x-1/2 flex-row gap-1.5 rounded border border-[rgb(230_220_190/0.4)] bg-[rgb(20_24_18/0.9)] p-1.5 group-hover:flex group-focus-visible:flex'
const POPOVER_CARD_CLASS_NAME =
  'flex w-[clamp(60px,8vw,110px)] flex-col gap-0.5 text-center font-body text-[11px] text-[#f3ecd8]'
const POPOVER_IMAGE_CLASS_NAME = 'block aspect-[0.72] w-full rounded-sm object-cover'

export type DecreeColumnOverlay = {
  suit: string
  cards: BotCardView[]
  frameStyle: CSSProperties
}

function DecreeIcon(props: { card: BotCardView }): JSX.Element {
  if (!props.card.isLoyalVizier) {
    return <SuitIcon suit={props.card.suit} className={ICON_CLASS_NAME} />
  }
  return (
    <span className={VIZIER_ICON_WRAPPER_CLASS_NAME}>
      <SuitIcon suit={props.card.suit} className={ICON_CLASS_NAME} />
      <span className={VIZIER_BADGE_CLASS_NAME}>{VIZIER_BADGE_TEXT}</span>
    </span>
  )
}

function DecreePopoverCard(props: { card: BotCardView }): JSX.Element {
  return (
    <span className={POPOVER_CARD_CLASS_NAME}>
      {props.card.imagePath !== null ? (
        <img
          className={POPOVER_IMAGE_CLASS_NAME}
          src={props.card.imagePath}
          alt=""
          draggable={false}
        />
      ) : null}
      {props.card.name}
    </span>
  )
}

function DecreeColumn(props: {
  column: DecreeColumnOverlay
  activeAction: string | null
}): JSX.Element {
  const { column } = props
  const hasCards: boolean = column.cards.length > 0
  const cardNames: string = column.cards.map((card: BotCardView): string => card.name).join(', ')
  return (
    <div
      className={
        props.activeAction !== null
          ? `${COLUMN_CLASS_NAME} ${ACTIVE_COLUMN_CLASS_NAME}`
          : COLUMN_CLASS_NAME
      }
      style={column.frameStyle}
      tabIndex={hasCards ? 0 : undefined}
      aria-label={`Decree ${column.suit} column: ${hasCards ? cardNames : 'empty'}`}
    >
      <div className={ICON_ROW_CLASS_NAME}>
        {column.cards.map((card: BotCardView) => (
          <DecreeIcon key={card.cardId} card={card} />
        ))}
      </div>
      {props.activeAction !== null ? (
        <span className={ACTION_LABEL_CLASS_NAME}>{props.activeAction}</span>
      ) : null}
      {hasCards ? (
        <div className={POPOVER_CLASS_NAME}>
          {column.cards.map((card: BotCardView) => (
            <DecreePopoverCard key={card.cardId} card={card} />
          ))}
        </div>
      ) : null}
    </div>
  )
}

/** Rule: Rootbotics 5.4.3 / 5.5.1 — the Decree, left to right. */
export function BotDecreeOverlay(props: {
  columns: readonly DecreeColumnOverlay[]
  activeColumn: ActiveDecreeColumn | null
}): JSX.Element {
  return (
    <>
      {props.columns.map((column: DecreeColumnOverlay) => (
        <DecreeColumn
          key={column.suit}
          column={column}
          activeAction={
            props.activeColumn?.suit === column.suit ? props.activeColumn.action : null
          }
        />
      ))}
    </>
  )
}
