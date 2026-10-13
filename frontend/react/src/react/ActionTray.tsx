import { useRef, useState, useSyncExternalStore, type JSX } from 'react'
import type { IconType } from 'react-icons'
import { LuChevronDown, LuChevronUp, LuUndo2 } from 'react-icons/lu'
import type { ActionSpec } from '#api/client.ts'
import {
  getCardPileSnapshot,
  isCraftedCardsOpen,
} from '#game/cardGalleryBridge.ts'
import {
  ADD_TO_DECREE_ACTION_TYPE,
  MAXIMUM_DECREE_CARDS_ADDED,
} from '#game/eyrieActionComposerModels.ts'
import { isFactionBoardOpen } from '#game/factionBoardBridge.ts'
import {
  getHudCallbacks,
  getHudSnapshot,
  patchHud,
  subscribeHud,
  type DecreePanelHudState,
} from '#game/hudStore.ts'
import { CardsPanel, CardsTab } from '#react/ActionDockCards.tsx'
import { DecreeColumns } from '#react/ActionDockDecree.tsx'
import { SuitIcon } from '#react/SuitIcon.tsx'
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
  isDecreeStep,
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

/** Narrow: centred above the hand. Wide: bottom right corner. */
const DOCK_POSITION_CLASS_NAME =
  'fixed bottom-(--root-portrait-tray-bottom) left-1/2 z-115 flex max-w-[calc(100vw-16px)] -translate-x-1/2 md:right-3 md:bottom-4 md:left-auto md:z-110 md:translate-x-0'
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
/**
 * Phase actions: always four tiles wide so the dock keeps its width, filled
 * column by column, two to a column (a ninth tile opens a fifth column).
 */
const PHASE_TILE_GRID_CLASS_NAME =
  'grid grid-flow-col auto-cols-[54px] grid-cols-[repeat(4,54px)] grid-rows-[repeat(2,54px)] gap-2'
const EYRIE_FACTION = 'eyrie'
/** Turn controls, and the Eyrie's tiles: top to bottom, two to a column, no wider than needed. */
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
/** Gold ring: the action being staged, its panel shown. */
const TILE_RINGED_CLASS_NAME =
  'shadow-gold-ring [--root-paper-color:var(--color-paper-bright)]'
/** A folded dock is its tab alone: no frame, nothing over the map. */
const DOCK_FOLDED_FRAME_CLASS_NAME = 'action-dock relative'
/** Cards staged in the Decree panel, told on the tile while the panel is off. */
const TILE_COUNT_BADGE_CLASS_NAME =
  'action-tray__count pointer-events-none absolute -right-1.5 -bottom-1.5 rounded-full bg-ink-deep px-1 font-mono text-[11px] leading-4.5 font-bold text-parchment'
/** Ink line between the phase actions and the turn controls. */
const DOCK_DIVIDER_CLASS_NAME = 'w-1 shrink-0 self-stretch bg-ink-deep'
/** Tabs above the frame: phase on the left, Cards on the right; a narrow dock lets them spill left. */
const TAB_ROW_CLASS_NAME =
  'absolute right-0 bottom-full flex min-w-full flex-row items-end justify-between gap-2 px-2.5'
/** Paper tab: phase mark, phase name, budget left. */
const PHASE_TAB_CLASS_NAME =
  'action-tray__collapse root-paper root-paper-fine root-paper-press pointer-events-auto m-0 flex flex-row items-center gap-1.5 px-2 py-0.5 font-display text-lg whitespace-nowrap text-ink capitalize [--root-paper-color:var(--color-parchment)]'
const PHASE_TAB_ICON_CLASS_NAME = 'text-base text-gold'
const PHASE_TAB_BUDGET_CLASS_NAME = 'font-mono text-xs opacity-75'

/** `1/2` while the Decree panel is off with cards staged; null otherwise. */
function stagedDecreeCountLabel(panel: DecreePanelHudState): string | null {
  if (panel === null || panel.isOpen || panel.view.stagedCardIds.length === 0) {
    return null
  }
  return `${String(panel.view.stagedCardIds.length)}/${String(MAXIMUM_DECREE_CARDS_ADDED)}`
}

function ActionTile(props: {
  spec: ActionSpec
  pending: unknown
  state: ActionTrayState['state']
  /** Taken earlier this phase and no longer legal: stays in place, faded. */
  isSpent?: boolean
  /** The action is being staged and its panel is shown. */
  isRinged?: boolean
  /** Count pinned on the tile corner (cards staged while the panel is off). */
  countLabel?: string | null
  onSelectAction: (spec: ActionSpec) => void
}): JSX.Element {
  const stateClassName: string =
    props.spec.type === END_PHASE_ACTION_TYPE
      ? END_PHASE_TILE_CLASS_NAME
      : props.isRinged === true
        ? TILE_RINGED_CLASS_NAME
        : ''
  const label: string = formatActionLabel(props.spec, props.pending, props.state)
  const art: TrayActionArt = trayActionArt(
    props.spec,
    props.state,
    props.pending,
  )
  const ActionIcon: IconType = actionIconFor(art.iconKey)
  const isEndPhase: boolean = props.spec.type === END_PHASE_ACTION_TYPE
  return (
    <Tooltip
      label={label}
      className={isEndPhase ? END_PHASE_TILE_SLOT_CLASS_NAME : TILE_SLOT_CLASS_NAME}
    >
      <button
        type="button"
        className={`${TILE_CLASS_NAME} ${stateClassName}`}
        disabled={props.isSpent === true}
        onClick={() => {
          props.onSelectAction(props.spec)
        }}
      >
        <ActionIcon aria-hidden="true" />
        {art.suit !== null ? (
          <SuitIcon suit={art.suit} className={TILE_SUIT_BADGE_CLASS_NAME} />
        ) : null}
        {props.countLabel !== undefined && props.countLabel !== null ? (
          <span className={TILE_COUNT_BADGE_CLASS_NAME}>{props.countLabel}</span>
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

/**
 * The handle of the dock: a click folds the dock down to this tab, so the
 * map under it shows, and a click on the folded tab brings the dock back.
 */
function PhaseTab(props: {
  phase: string
  budgetLabel: string | null
  isFolded: boolean
  onToggle: () => void
}): JSX.Element | null {
  const PhaseIcon: IconType | null = phaseIconFor(props.phase)
  if (PhaseIcon === null) {
    return null
  }
  const FoldIcon: IconType = props.isFolded ? LuChevronUp : LuChevronDown
  return (
    <button
      type="button"
      className={PHASE_TAB_CLASS_NAME}
      aria-expanded={!props.isFolded}
      onClick={props.onToggle}
    >
      <PhaseIcon className={PHASE_TAB_ICON_CLASS_NAME} aria-hidden="true" />
      {props.phase}
      {props.budgetLabel !== null ? (
        <span className={PHASE_TAB_BUDGET_CLASS_NAME}>{props.budgetLabel}</span>
      ) : null}
      <FoldIcon className="text-base" aria-hidden="true" />
    </button>
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
  const decreePanel: DecreePanelHudState = useSyncExternalStore(
    subscribeHud,
    () => getHudSnapshot().decreePanel,
    () => getHudSnapshot().decreePanel,
  )
  const isCollapsed: boolean = useSyncExternalStore(
    subscribeHud,
    (): boolean => getHudSnapshot().actionTrayCollapsed,
    (): boolean => getHudSnapshot().actionTrayCollapsed,
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
  // Without its tab a folded dock could not be brought back: it stays open.
  const isFolded: boolean = isCollapsed && phaseIconFor(phase) !== null
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
  const phaseTab: JSX.Element = (
    <PhaseTab
      phase={phase}
      budgetLabel={budgetLabel}
      isFolded={isFolded}
      onToggle={() => {
        patchHud({ actionTrayCollapsed: !isCollapsed })
      }}
    />
  )
  if (isFolded) {
    return (
      <div className={DOCK_POSITION_CLASS_NAME}>
        <div className={DOCK_FOLDED_FRAME_CLASS_NAME}>
          <div className={TAB_ROW_CLASS_NAME}>{phaseTab}</div>
        </div>
      </div>
    )
  }
  return (
    <div className={DOCK_POSITION_CLASS_NAME}>
      <div className={`${DOCK_FRAME_CLASS_NAME} ${frameColorClassName}`}>
        <div className={TAB_ROW_CLASS_NAME}>
          {phaseTab}
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
          <div
            className={
              faction === EYRIE_FACTION
                ? TILE_GRID_CLASS_NAME
                : PHASE_TILE_GRID_CLASS_NAME
            }
          >
            {phaseTiles.map((tile) => (
              <ActionTile
                key={tile.key}
                spec={tile.spec}
                pending={tray.pending}
                state={tray.state}
                isSpent={tile.isSpent}
                isRinged={
                  tile.spec.type === ADD_TO_DECREE_ACTION_TYPE &&
                  decreePanel?.isOpen === true
                }
                countLabel={
                  tile.spec.type === ADD_TO_DECREE_ACTION_TYPE
                    ? stagedDecreeCountLabel(decreePanel)
                    : null
                }
                onSelectAction={callbacks.onSelectAction}
              />
            ))}
          </div>
        ) : null}
        {decreeColumns !== null ? (
          <DecreeColumns
            columns={decreeColumns}
            isDisabled={!isDecreeStep(tray.state)}
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
