import { useRef, useState, useSyncExternalStore, type JSX } from 'react'
import type { IconType } from 'react-icons'
import { LuUndo2 } from 'react-icons/lu'
import type { ActionSpec } from '#api/client.ts'
import { imagePathForAssetKey, suitTextureKey } from '#assets/gameAssets.ts'
import {
  getCardPileSnapshot,
  isCraftedCardsOpen,
} from '#game/cardGalleryBridge.ts'
import { isFactionBoardOpen } from '#game/factionBoardBridge.ts'
import {
  getHudCallbacks,
  getHudSnapshot,
  patchHud,
  subscribeHud,
} from '#game/hudStore.ts'
import { CardsPanel, CardsTab } from '#react/ActionDockCards.tsx'
import { DecreeColumns } from '#react/ActionDockDecree.tsx'
import { Tooltip } from '#react/Tooltip.tsx'
import type {
  ActionTrayState,
  TrayActionArt,
  TrayActionRegion,
} from '#ui/ActionTray.ts'
import {
  collapseTrayActionsByLabel,
  filterTrayActions,
  formatActionLabel,
  partitionTrayActionRegions,
  trayActionArt,
  withoutBoardOnlyActions,
} from '#ui/ActionTray.ts'
import { trayBudgetLabel } from '#ui/trayBudget.ts'
import { actionIconFor } from '#ui/actionIcons.ts'
import {
  cardActionRows,
  cardActionTally,
  type CardActionRow,
} from '#ui/cardActionRows.ts'
import {
  DECREE_ACTION_TYPE,
  decreeColumnViews,
  decreeTally,
  type DecreeColumnView,
} from '#ui/decreeColumns.ts'
import { phaseIconFor } from '#ui/phaseIcons.ts'
import {
  EMPTY_PHASE_TILE_MEMORY,
  phaseTilesOf,
  rememberPhaseTiles,
  type KeyedAction,
  type PhaseTile,
  type PhaseTileMemory,
} from '#ui/phaseTiles.ts'

function isBlockingHudModalOpen(): boolean {
  if (isFactionBoardOpen() === true || isCraftedCardsOpen() === true) {
    return true
  }
  const pile = getCardPileSnapshot()
  // Selectable supporter pick must not hide tray chrome / block the map.
  return pile !== null && pile.selectable !== true
}

function canUndoFromStore(): boolean {
  return getHudSnapshot().gameDrawer?.canUndo === true
}

const ACTIONS_REGION_ID: TrayActionRegion['id'] = 'actions'
const META_REGION_ID: TrayActionRegion['id'] = 'meta'
const END_PHASE_ACTION_TYPE = 'endPhase'
const UNDO_LABEL = 'undo'

/** Narrow: centred above the hand. Wide: bottom right corner, above the drawer buttons. */
const DOCK_POSITION_CLASS_NAME =
  'fixed bottom-(--root-portrait-tray-bottom) left-1/2 z-115 flex max-w-[calc(100vw-16px)] -translate-x-1/2 md:right-3 md:bottom-36 md:left-auto md:z-110 md:translate-x-0'
/** Frame in the colour of the faction taking the turn. */
const DOCK_FRAME_CLASS_NAME =
  'action-dock root-paper flex flex-row items-stretch gap-2.5 p-2.5'
const FACTION_FRAME_CLASS_NAMES: Readonly<Record<string, string>> = {
  marquise: '[--root-paper-color:var(--color-marquise)]',
  eyrie: '[--root-paper-color:var(--color-eyrie)]',
  alliance: '[--root-paper-color:var(--color-alliance)]',
  vagabond: '[--root-paper-color:var(--color-vagabond)]',
  lizard: '[--root-paper-color:var(--color-lizard)]',
  riverfolk: '[--root-paper-color:var(--color-riverfolk)]',
}
const NEUTRAL_FRAME_CLASS_NAME = '[--root-paper-color:var(--color-wood)]'
/** Tiles fill top to bottom, two to a column. */
const TILE_GRID_CLASS_NAME =
  'grid grid-flow-col grid-rows-[repeat(2,54px)] auto-cols-[54px] gap-2'
/** Icon-only square: the action is named by its tooltip. */
const TILE_CLASS_NAME =
  'action-tray__action root-paper root-paper-fine root-paper-press relative m-0 flex size-full items-center justify-center p-0 text-3xl text-ink [--root-paper-color:var(--color-cream)]'
/** End phase cannot be taken back once the next phase acts: marked rust. */
const END_PHASE_TILE_CLASS_NAME =
  '[--root-paper-color:var(--color-rust)] text-parchment'
/** Grid cell of a tile. The turn square reads End phase, Undo, then the rest. */
const TILE_SLOT_CLASS_NAME = 'flex'
const END_PHASE_TILE_SLOT_CLASS_NAME = 'flex -order-2'
const UNDO_TILE_SLOT_CLASS_NAME = 'flex -order-1'
/** Suit of the card an action plays (Decree), pinned on the tile corner. */
const TILE_SUIT_BADGE_CLASS_NAME =
  'pointer-events-none absolute -right-1.5 -bottom-1.5 size-6 object-contain'
/** Ink line between the phase actions and the turn controls. */
const DOCK_DIVIDER_CLASS_NAME = 'w-1 shrink-0 self-stretch bg-ink-deep'
/** Tabs above the frame: phase on the left, Cards on the right; a narrow dock lets them spill left. */
const TAB_ROW_CLASS_NAME =
  'absolute right-0 bottom-full flex min-w-full flex-row items-end justify-between gap-2 px-2.5'
/** Paper tab: phase mark, phase name, budget left. */
const PHASE_TAB_CLASS_NAME =
  'root-paper root-paper-fine flex flex-row items-center gap-1.5 px-2 py-0.5 font-display text-lg whitespace-nowrap text-ink capitalize [--root-paper-color:var(--color-parchment)]'
const PHASE_TAB_ICON_CLASS_NAME = 'text-base text-gold'
const PHASE_TAB_BUDGET_CLASS_NAME = 'font-mono text-xs opacity-75'

function ActionTile(props: {
  spec: ActionSpec
  pending: unknown
  state: ActionTrayState['state']
  /** Taken earlier this phase and no longer legal: stays in place, faded. */
  isSpent?: boolean
  onSelectAction: (spec: ActionSpec) => void
}): JSX.Element {
  const label: string = formatActionLabel(props.spec, props.pending, props.state)
  const art: TrayActionArt = trayActionArt(
    props.spec,
    props.state,
    props.pending,
  )
  const ActionIcon: IconType = actionIconFor(art.iconKey)
  const suitTexture: string | null =
    art.suit !== null ? suitTextureKey(art.suit) : null
  const suitImagePath: string | null =
    suitTexture !== null ? imagePathForAssetKey(suitTexture) : null
  const isEndPhase: boolean = props.spec.type === END_PHASE_ACTION_TYPE
  return (
    <Tooltip
      label={label}
      className={isEndPhase ? END_PHASE_TILE_SLOT_CLASS_NAME : TILE_SLOT_CLASS_NAME}
    >
      <button
        type="button"
        className={
          isEndPhase
            ? `${TILE_CLASS_NAME} ${END_PHASE_TILE_CLASS_NAME}`
            : TILE_CLASS_NAME
        }
        disabled={props.isSpent === true}
        onClick={() => {
          props.onSelectAction(props.spec)
        }}
      >
        <ActionIcon aria-hidden="true" />
        {suitImagePath !== null ? (
          <img
            className={TILE_SUIT_BADGE_CLASS_NAME}
            src={suitImagePath}
            alt=""
            draggable={false}
          />
        ) : null}
        <span className="sr-only">{label}</span>
      </button>
    </Tooltip>
  )
}

function UndoTile(props: { onUndo: () => void }): JSX.Element {
  return (
    <Tooltip label={UNDO_LABEL} className={UNDO_TILE_SLOT_CLASS_NAME}>
      <button
        type="button"
        className={`game-drawer__undo ${TILE_CLASS_NAME}`}
        onClick={props.onUndo}
      >
        <LuUndo2 aria-hidden="true" />
        <span className="sr-only">{UNDO_LABEL}</span>
      </button>
    </Tooltip>
  )
}

function PhaseTab(props: {
  phase: string
  budgetLabel: string | null
}): JSX.Element | null {
  const PhaseIcon: IconType | null = phaseIconFor(props.phase)
  if (PhaseIcon === null) {
    return null
  }
  return (
    <div className={PHASE_TAB_CLASS_NAME}>
      <PhaseIcon className={PHASE_TAB_ICON_CLASS_NAME} aria-hidden="true" />
      {props.phase}
      {props.budgetLabel !== null ? (
        <span className={PHASE_TAB_BUDGET_CLASS_NAME}>{props.budgetLabel}</span>
      ) : null}
    </div>
  )
}

export function ActionTray(): JSX.Element | null {
  const tray = useSyncExternalStore(
    subscribeHud,
    () => getHudSnapshot().actionTray,
    () => getHudSnapshot().actionTray,
  )
  const anyModalOpen = useSyncExternalStore(
    subscribeHud,
    isBlockingHudModalOpen,
    isBlockingHudModalOpen,
  )
  const canUndo = useSyncExternalStore(
    subscribeHud,
    canUndoFromStore,
    canUndoFromStore,
  )
  const [isCardsPanelOpen, setIsCardsPanelOpen] = useState<boolean>(false)
  const phaseTileMemoryRef = useRef<PhaseTileMemory>(EMPTY_PHASE_TILE_MEMORY)
  // Modal open gated live from store so veil/X close re-shows tray
  // without needing a board re-sync (options.disabled stays stale otherwise).
  if (tray === null || anyModalOpen || tray.options?.disabled === true) {
    return null
  }
  const forActor = collapseTrayActionsByLabel(
    withoutBoardOnlyActions(
      filterTrayActions(tray.actions, tray.actorSeat, tray.options),
    ),
    tray.pending,
    tray.state,
  )
  const cardRows: readonly CardActionRow[] = cardActionRows(
    tray.state,
    tray.actorSeat,
    forActor,
  )
  // Card actions are played from the Cards panel, not from a tile.
  const cardActionTypes: ReadonlySet<string> = new Set(
    cardRows.map((row) => row.actionType),
  )
  // Eyrie Daylight: Decree cards are resolved from the columns, not from tiles.
  const decreeColumns: readonly DecreeColumnView[] | null = decreeColumnViews(
    tray.state,
    tray.actorSeat,
    forActor,
  )
  const regions = partitionTrayActionRegions(
    forActor.filter(
      (spec) =>
        !cardActionTypes.has(spec.type) &&
        (decreeColumns === null || spec.type !== DECREE_ACTION_TYPE),
    ),
    tray.state,
  )
  const hasCardActionToPlay: boolean = cardRows.some(
    (row) => row.spec !== null,
  )
  if (
    regions.length === 0 &&
    !canUndo &&
    !hasCardActionToPlay &&
    decreeColumns === null
  ) {
    return null
  }
  const phase: string = tray.state?.phase ?? ''
  const budgetLabel: string | null =
    decreeColumns !== null
      ? decreeTally(decreeColumns)
      : trayBudgetLabel(tray.state)
  const phaseActions: readonly ActionSpec[] =
    regions.find((region) => region.id === ACTIONS_REGION_ID)?.actions ?? []
  const liveTiles: readonly KeyedAction[] = phaseActions.map((spec) => ({
    key: `${spec.type}::${formatActionLabel(spec, tray.pending, tray.state)}`,
    spec,
  }))
  // Answers to a pending event are not actions of the phase: nothing is kept.
  const phaseKey: string | null =
    tray.pending !== undefined || tray.state === undefined
      ? null
      : `${String(tray.state.turn)}:${String(tray.actorSeat)}:${phase}`
  const memory: PhaseTileMemory = rememberPhaseTiles(
    phaseTileMemoryRef.current,
    phaseKey,
    liveTiles,
  )
  phaseTileMemoryRef.current = memory
  const phaseTiles: readonly PhaseTile[] =
    phaseKey === null
      ? liveTiles.map((tile) => ({ ...tile, isSpent: false }))
      : phaseTilesOf(memory, liveTiles)
  const turnActions: readonly ActionSpec[] =
    regions.find((region) => region.id === META_REGION_ID)?.actions ?? []
  const hasTurnTiles: boolean = turnActions.length > 0 || canUndo
  const callbacks = getHudCallbacks()
  const faction: string | undefined = tray.state?.players.find(
    (player) => player.seat === tray.actorSeat,
  )?.faction
  const frameColorClassName: string =
    (faction !== undefined ? FACTION_FRAME_CLASS_NAMES[faction] : undefined) ??
    NEUTRAL_FRAME_CLASS_NAME
  return (
    <div className={DOCK_POSITION_CLASS_NAME}>
      <div className={`${DOCK_FRAME_CLASS_NAME} ${frameColorClassName}`}>
        <div className={TAB_ROW_CLASS_NAME}>
          <PhaseTab phase={phase} budgetLabel={budgetLabel} />
          {cardRows.length > 0 ? (
            <CardsTab
              tally={cardActionTally(cardRows, phase)}
              isOpen={isCardsPanelOpen}
              onToggle={() => {
                setIsCardsPanelOpen(!isCardsPanelOpen)
              }}
            />
          ) : null}
        </div>
        {isCardsPanelOpen && cardRows.length > 0 ? (
          <CardsPanel
            rows={cardRows}
            phase={phase}
            onPlay={(spec) => {
              setIsCardsPanelOpen(false)
              callbacks.onSelectAction(spec)
            }}
          />
        ) : null}
        {phaseTiles.length > 0 ? (
          <div className={TILE_GRID_CLASS_NAME}>
            {phaseTiles.map((tile) => (
              <ActionTile
                key={tile.key}
                spec={tile.spec}
                pending={tray.pending}
                state={tray.state}
                isSpent={tile.isSpent}
                onSelectAction={callbacks.onSelectAction}
              />
            ))}
          </div>
        ) : null}
        {decreeColumns !== null ? (
          <DecreeColumns
            columns={decreeColumns}
            onSelectAction={callbacks.onSelectAction}
          />
        ) : null}
        {(phaseTiles.length > 0 || decreeColumns !== null) && hasTurnTiles ? (
          <span className={DOCK_DIVIDER_CLASS_NAME} aria-hidden="true" />
        ) : null}
        {hasTurnTiles ? (
          <div className={TILE_GRID_CLASS_NAME}>
            {turnActions.map((spec, index) => (
              <ActionTile
                key={`${spec.type}-${String(index)}`}
                spec={spec}
                pending={tray.pending}
                state={tray.state}
                onSelectAction={callbacks.onSelectAction}
              />
            ))}
            {canUndo ? <UndoTile onUndo={callbacks.onUndo} /> : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function syncActionTray(actionTrayState: ActionTrayState): void {
  patchHud({
    actionTray: actionTrayState,
  })
}
