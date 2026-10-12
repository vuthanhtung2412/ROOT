import { useSyncExternalStore, type JSX } from 'react'
import type { IconType } from 'react-icons'
import { LuCheck, LuUndo2 } from 'react-icons/lu'
import type { GameState } from '#api/client.ts'
import { cardImagePublicPath } from '#assets/gameAssets.ts'
import {
  ADD_TO_DECREE_ACTION_TYPE,
  type EyrieDraft,
} from '#game/eyrieActionComposerModels.ts'
import {
  getHudCallbacks,
  getHudSnapshot,
  patchHud,
  subscribeHud,
  type DecreePanelHudState,
  type HudCallbacks,
} from '#game/hudStore.ts'
import { SuitIcon } from '#react/SuitIcon.tsx'
import { Tooltip } from '#react/Tooltip.tsx'
import { actionIconFor } from '#ui/actionIcons.ts'
import {
  decreePanelView,
  isDecreeColumnOfferedFor,
  type DecreePanelColumn,
  type DecreePanelStagedCard,
  type DecreePanelView,
} from '#ui/decreePanel.ts'

const PANEL_TITLE = 'Decree'
const CONFIRM_LABEL = 'confirm'
const TAKE_BACK_LABEL = 'take back'
const PLACE_HERE_LABEL = 'Place here'
/** What a column does with a card, as printed on the Eyrie faction board. */
const COLUMN_RULES: Readonly<Record<string, string>> = {
  recruit: '…warriors in a matching clearing with a roost.',
  move: '…warriors from a matching clearing.',
  battle: '…in a matching clearing.',
  build: '…in a matching clearing you rule without a roost.',
}

/** Top centre, under the turn banner, over the map; the hand and the dock stay above it. */
const PANEL_POSITION_CLASS_NAME =
  'fixed top-20 left-1/2 z-105 flex max-w-[calc(100vw-8px)] -translate-x-1/2 md:top-24'
const PANEL_FRAME_CLASS_NAME =
  'decree-panel root-paper flex flex-row items-stretch gap-1.5 p-2 pt-5 [--root-paper-color:var(--color-eyrie)] md:gap-2.5 md:p-3 md:pt-7'
/** Title ribbon riding the top edge. */
const PANEL_TITLE_CLASS_NAME =
  'root-paper root-paper-fine absolute bottom-full left-1/2 -mb-4 -translate-x-1/2 px-4 py-0.5 font-display text-xl whitespace-nowrap text-ink [--root-paper-color:var(--color-parchment)] md:-mb-5 md:px-6 md:text-3xl'
const COLUMN_ROW_CLASS_NAME = 'flex flex-row gap-1.5 md:gap-3'
const COLUMN_CLASS_NAME =
  'flex w-17 flex-col items-center text-parchment md:w-37.5'
/** The slot a card is laid in: dark inset, thin pale frame. */
const SLOT_CLASS_NAME =
  'decree-panel__slot box-border flex h-24 w-full flex-col items-center gap-1 border-2 bg-eyrie-deep p-1 md:h-42 md:gap-1.5 md:p-2'
const SLOT_IDLE_CLASS_NAME = 'border-parchment/75'
/** A card is picked: the column asks for it. */
const SLOT_OFFERED_CLASS_NAME =
  'cursor-root-pointer border-dashed border-gold hover:brightness-125'
/** Cards already in the column: one suit mark per suit, with its count. */
const MARK_ROW_CLASS_NAME =
  'flex min-h-5 flex-row items-center gap-1.5 font-display text-sm md:min-h-7 md:gap-2.5 md:text-xl'
const MARK_CLASS_NAME = 'flex flex-row items-center gap-0.5'
const MARK_ICON_CLASS_NAME = 'block size-4.5 object-contain md:size-6.5'
const STAGED_ROW_CLASS_NAME =
  'flex min-h-0 flex-1 flex-row items-center justify-center self-stretch'
/** A staged card: the card itself, gold ringed; a second one overlaps the first. */
const STAGED_CARD_CLASS_NAME =
  'decree-panel__staged m-0 w-9 -rotate-3 cursor-root-pointer overflow-hidden rounded-sm border-2 border-ink-deep bg-ink p-0 shadow-card-selected hover:brightness-110 md:w-20 md:rounded-md [&+&]:-ml-4 [&+&]:rotate-4 md:[&+&]:-ml-8'
const PLACE_HERE_CLASS_NAME =
  'font-display text-xs text-gold italic md:text-lg'
const COLUMN_NAME_CLASS_NAME =
  'mt-1.5 flex flex-row items-center gap-1 font-display text-base leading-none capitalize md:mt-3 md:gap-2 md:text-2xl'
/** No room for the rule on a narrow screen: the column name stands alone. */
const COLUMN_RULE_CLASS_NAME =
  'm-0 mt-1 hidden text-center font-display text-sm leading-tight italic md:block'
const DIVIDER_CLASS_NAME = 'w-1 shrink-0 self-stretch bg-ink-deep'
const TILE_COLUMN_CLASS_NAME = 'flex flex-col gap-2'
const TILE_CLASS_NAME =
  'root-paper root-paper-fine root-paper-press m-0 flex size-11 items-center justify-center p-0 text-2xl text-ink disabled:opacity-40 md:size-13.5 md:text-3xl'
const CONFIRM_TILE_CLASS_NAME = `decree-panel__confirm ${TILE_CLASS_NAME} [--root-paper-color:var(--color-confirm)]`
const TAKE_BACK_TILE_CLASS_NAME = `decree-panel__take-back ${TILE_CLASS_NAME} [--root-paper-color:var(--color-cream)]`

function StagedCard(props: {
  card: DecreePanelStagedCard
  onTakeBack: (cardId: string) => void
}): JSX.Element | null {
  const imagePath: string | null = cardImagePublicPath(props.card.defId)
  if (imagePath === null) {
    return null
  }
  return (
    <button
      type="button"
      className={STAGED_CARD_CLASS_NAME}
      aria-label={`${TAKE_BACK_LABEL} ${props.card.defId}`}
      onClick={(event) => {
        // The slot under the card is clickable too while a card is picked.
        event.stopPropagation()
        props.onTakeBack(props.card.cardId)
      }}
    >
      <img
        className="pointer-events-none block w-full"
        src={imagePath}
        alt=""
        draggable={false}
      />
    </button>
  )
}

function DecreePanelColumnView(props: {
  column: DecreePanelColumn
  /** The picked card may be laid in this column. */
  isOffered: boolean
  callbacks: HudCallbacks
}): JSX.Element {
  const column: string = props.column.column
  const ColumnIcon: IconType = actionIconFor(column)
  return (
    <div className={COLUMN_CLASS_NAME}>
      <div
        className={`${SLOT_CLASS_NAME} ${props.isOffered ? SLOT_OFFERED_CLASS_NAME : SLOT_IDLE_CLASS_NAME}`}
        data-decree-column={column}
        onClick={() => {
          if (props.isOffered) {
            props.callbacks.onBannerPickOption(column)
          }
        }}
      >
        <div className={MARK_ROW_CLASS_NAME}>
          {props.column.marks.map((mark) => (
            <span key={mark.suit} className={MARK_CLASS_NAME}>
              <SuitIcon
                suit={mark.suit}
                className={MARK_ICON_CLASS_NAME}
                alt={mark.suit}
              />
              ×{mark.count}
            </span>
          ))}
        </div>
        <div className={STAGED_ROW_CLASS_NAME}>
          {props.column.staged.map((card) => (
            <StagedCard
              key={card.cardId}
              card={card}
              onTakeBack={props.callbacks.onDecreeCardTakenBack}
            />
          ))}
          {props.isOffered && props.column.staged.length === 0 ? (
            <span className={PLACE_HERE_CLASS_NAME}>{PLACE_HERE_LABEL}</span>
          ) : null}
        </div>
      </div>
      <div className={COLUMN_NAME_CLASS_NAME}>
        <ColumnIcon aria-hidden="true" />
        {column}
      </div>
      <p className={COLUMN_RULE_CLASS_NAME}>{COLUMN_RULES[column] ?? ''}</p>
    </div>
  )
}

/**
 * Eyrie Birdsong, Add to Decree being staged: the four Decree columns as
 * slots. A hand card is picked, then laid in a slot; nothing is sent before
 * Confirm.
 */
export function DecreePanel(): JSX.Element | null {
  const panel: DecreePanelHudState = useSyncExternalStore(
    subscribeHud,
    () => getHudSnapshot().decreePanel,
    () => getHudSnapshot().decreePanel,
  )
  if (panel === null || !panel.isOpen) {
    return null
  }
  const view: DecreePanelView = panel.view
  const callbacks: HudCallbacks = getHudCallbacks()
  const pickedCardId: string | null = view.pickedCardId
  return (
    <div className={PANEL_POSITION_CLASS_NAME}>
      <div className={PANEL_FRAME_CLASS_NAME}>
        <div className={PANEL_TITLE_CLASS_NAME}>{PANEL_TITLE}</div>
        <div className={COLUMN_ROW_CLASS_NAME}>
          {view.columns.map((column) => (
            <DecreePanelColumnView
              key={column.column}
              column={column}
              isOffered={
                pickedCardId !== null &&
                isDecreeColumnOfferedFor(view, {
                  cardId: pickedCardId,
                  column: column.column,
                })
              }
              callbacks={callbacks}
            />
          ))}
        </div>
        <span className={DIVIDER_CLASS_NAME} aria-hidden="true" />
        <div className={TILE_COLUMN_CLASS_NAME}>
          <Tooltip label={CONFIRM_LABEL}>
            <button
              type="button"
              className={CONFIRM_TILE_CLASS_NAME}
              disabled={!view.canConfirm}
              onClick={callbacks.onBannerConfirm}
            >
              <LuCheck aria-hidden="true" />
              <span className="sr-only">{CONFIRM_LABEL}</span>
            </button>
          </Tooltip>
          <Tooltip label={TAKE_BACK_LABEL}>
            <button
              type="button"
              className={TAKE_BACK_TILE_CLASS_NAME}
              disabled={!view.canTakeBack}
              onClick={callbacks.onDecreeStagingCleared}
            >
              <LuUndo2 aria-hidden="true" />
              <span className="sr-only">{TAKE_BACK_LABEL}</span>
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  )
}

/** Shows the panel for an Add to Decree being staged; clears it for any other draft. */
export function syncDecreePanel(input: {
  draft: EyrieDraft
  state: GameState | null
  actorSeat: number
  isOpen: boolean
}): void {
  const view: DecreePanelView | null =
    input.draft.type === ADD_TO_DECREE_ACTION_TYPE && input.state !== null
      ? decreePanelView(input.state, input.actorSeat, input.draft)
      : null
  if (view === null && getHudSnapshot().decreePanel === null) {
    return
  }
  patchHud({
    decreePanel: view === null ? null : { view, isOpen: input.isOpen },
  })
}
