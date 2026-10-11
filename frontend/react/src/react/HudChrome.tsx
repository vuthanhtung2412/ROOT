import {
  useState,
  useSyncExternalStore,
  type JSX,
  type MouseEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { GiCardBurn } from 'react-icons/gi'
import { LuFlag, LuLogOut, LuUndo2, LuX } from 'react-icons/lu'
import {
  getHudCallbacks,
  getHudSnapshot,
  patchHud,
  subscribeHud,
  type GameDrawerHudState,
} from '#game/hudStore.ts'
import { GameLogButton } from '#react/GameLog.tsx'
import { ItemSupplyButton } from '#react/ItemSupply.tsx'
import {
  setupCardPickOptions,
  setupCardPickTitle,
  type SetupCardPickKind,
} from '#ui/setupCardPick.ts'

/** Dims the game behind a full-screen overlay. */
const VEIL_CLASS_NAME = 'inset-0 bg-forest-deep/72'
/** End game / discard pile: torn paper chips in the bottom corners. */
const DRAWER_BUTTON_CLASS_NAME =
  'root-paper root-paper-fine root-paper-press pointer-events-auto m-0 flex flex-row items-center gap-1.5 px-3 py-1.5 font-display text-sm text-ink md:text-base'

/** Words of the exit button and of the modal that confirms it. */
type ExitGameWording = {
  button: string
  question: string
  consequence: string
  confirm: string
}

/** Host (or a single-device game): the game stops for every player. */
const END_GAME_WORDING: ExitGameWording = {
  button: 'End game',
  question: 'End the game?',
  consequence: 'The game stops for every player and cannot be resumed.',
  confirm: 'Yes, end the game',
}

/** Online guest: only this browser goes back to the menu. */
const LEAVE_GAME_WORDING: ExitGameWording = {
  button: 'Leave game',
  question: 'Leave the game?',
  consequence:
    'The game goes on without you on this screen. Only the host can end it. "Join game" brings you back to your seat.',
  confirm: 'Yes, leave',
}

const KEEP_PLAYING_LABEL = 'Keep playing'

/** Same shell as discard / crafted card gallery. */
const EXIT_MODAL_CLASS_NAME =
  'exit-game-modal pointer-events-auto fixed inset-0 z-400 flex items-center justify-center'
const EXIT_VEIL_CLASS_NAME = 'absolute inset-0 bg-forest-deep/72'
const EXIT_CLOSE_BUTTON_CLASS_NAME =
  'root-paper root-paper-fine root-paper-press absolute top-2.5 right-3 z-2 m-0 flex size-10 items-center justify-center p-0 text-2xl text-parchment [--root-paper-color:var(--color-rust)]'
const EXIT_PANEL_CLASS_NAME =
  'exit-game-modal__panel root-paper relative z-1 m-3 box-border flex w-[min(92vw,28rem)] flex-col gap-3 px-[18px] py-4 text-ink [--root-paper-color:var(--color-cream)]'
const EXIT_TITLE_CLASS_NAME =
  'm-0 border-b-2 border-dashed border-ink/35 pb-1.5 font-display text-[22px] font-normal capitalize'
const EXIT_BODY_CLASS_NAME = 'm-0 font-body text-base text-ink-soft'
const EXIT_ACTIONS_CLASS_NAME =
  'flex flex-row flex-wrap justify-end gap-2 pt-1'
const EXIT_QUIET_BUTTON_CLASS_NAME =
  'root-paper root-paper-fine root-paper-press m-0 px-3.5 py-2 font-display text-base text-ink [--root-paper-color:var(--color-parchment)]'
const EXIT_CONFIRM_BUTTON_CLASS_NAME =
  'root-paper root-paper-fine root-paper-press m-0 px-3.5 py-2 font-display text-base text-parchment [--root-paper-color:var(--color-rust)]'

/** Asks before leaving the game: one stray click must not end it. */
function ExitGameModal(props: {
  wording: ExitGameWording
  onConfirm: () => void
  onCancel: () => void
}): JSX.Element {
  return createPortal(
    <div
      className={EXIT_MODAL_CLASS_NAME}
      role="alertdialog"
      aria-modal="true"
      aria-label={props.wording.question}
      onClick={props.onCancel}
    >
      <div className={EXIT_VEIL_CLASS_NAME} aria-hidden="true" />
      <button
        type="button"
        className={EXIT_CLOSE_BUTTON_CLASS_NAME}
        aria-label={KEEP_PLAYING_LABEL}
        onClick={(event: MouseEvent<HTMLButtonElement>): void => {
          event.stopPropagation()
          props.onCancel()
        }}
      >
        <LuX aria-hidden="true" />
      </button>
      <div
        className={EXIT_PANEL_CLASS_NAME}
        onClick={(event: MouseEvent<HTMLDivElement>): void => {
          event.stopPropagation()
        }}
      >
        <h2 className={EXIT_TITLE_CLASS_NAME}>{props.wording.question}</h2>
        <p className={EXIT_BODY_CLASS_NAME}>{props.wording.consequence}</p>
        <div className={EXIT_ACTIONS_CLASS_NAME}>
          <button
            type="button"
            className={EXIT_QUIET_BUTTON_CLASS_NAME}
            onClick={props.onCancel}
          >
            {KEEP_PLAYING_LABEL}
          </button>
          <button
            type="button"
            className={EXIT_CONFIRM_BUTTON_CLASS_NAME}
            onClick={props.onConfirm}
          >
            {props.wording.confirm}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export function GameDrawer(): JSX.Element | null {
  const drawer = useSyncExternalStore(
    subscribeHud,
    () => getHudSnapshot().gameDrawer,
    () => getHudSnapshot().gameDrawer,
  )
  const [isConfirmingExit, setIsConfirmingExit] = useState<boolean>(false)
  if (drawer === null) {
    return null
  }
  const callbacks = getHudCallbacks()
  const exitWording: ExitGameWording = drawer.canEndGame
    ? END_GAME_WORDING
    : LEAVE_GAME_WORDING

  return (
    <div className="pointer-events-none fixed right-2 bottom-(--root-portrait-drawer-bottom) left-2 z-112 flex justify-between md:right-3 md:bottom-22.5 md:left-3">
      <button
        type="button"
        className={`${DRAWER_BUTTON_CLASS_NAME} [--root-paper-color:color-mix(in_srgb,var(--color-rust)_45%,var(--color-parchment))]`}
        onClick={() => {
          setIsConfirmingExit(true)
        }}
      >
        {drawer.canEndGame ? (
          <LuFlag aria-hidden="true" />
        ) : (
          <LuLogOut aria-hidden="true" />
        )}
        {exitWording.button}
      </button>
      {isConfirmingExit ? (
        <ExitGameModal
          wording={exitWording}
          onConfirm={() => {
            setIsConfirmingExit(false)
            callbacks.onEndGame()
          }}
          onCancel={() => {
            setIsConfirmingExit(false)
          }}
        />
      ) : null}
      {drawer.canUndo ? (
        <button
          type="button"
          className={`game-drawer__undo ${DRAWER_BUTTON_CLASS_NAME} ml-2`}
          onClick={() => {
            callbacks.onUndo()
          }}
        >
          <LuUndo2 aria-hidden="true" />
          Undo
        </button>
      ) : null}
      <div className="ml-auto flex flex-row items-center gap-2">
        <GameLogButton className={DRAWER_BUTTON_CLASS_NAME} />
        <ItemSupplyButton className={DRAWER_BUTTON_CLASS_NAME} />
        <button
          type="button"
          className={DRAWER_BUTTON_CLASS_NAME}
          onClick={() => {
            callbacks.onOpenDiscardPile()
          }}
        >
          <GiCardBurn aria-hidden="true" />
          {`Discarded (${String(drawer.discardCount)})`}
        </button>
      </div>
    </div>
  )
}

export function WinnerOverlay(): JSX.Element | null {
  const winner = useSyncExternalStore(
    subscribeHud,
    () => getHudSnapshot().winner,
    () => getHudSnapshot().winner,
  )
  if (winner === null) {
    return null
  }
  return (
    <div
      className="fixed inset-0 z-320 flex flex-col items-center justify-center gap-4"
      role="dialog"
      aria-modal="true"
    >
      <div className={`absolute ${VEIL_CLASS_NAME}`} />
      <p className="root-panel relative z-1 m-0 px-5 py-3 text-center font-display text-4xl text-ink">
        {`${winner.winnerFaction} wins`}
      </p>
      <button
        type="button"
        className="root-button root-button--accent relative z-1 px-3.5 py-2 text-base"
        onClick={() => {
          getHudCallbacks().onReturnToMenu()
        }}
      >
        Back to menu
      </button>
    </div>
  )
}

/**
 * Setup pick card: as wide as four cards across (Eyrie leaders) and the
 * viewport height allow; never smaller than the old fixed 150px card.
 */
const SETUP_CARD_WIDTH_CLASS_NAME = 'w-[min(21vw,36vh,300px)] min-w-37.5'
const SETUP_CARD_SIZE_CLASS_NAME = `${SETUP_CARD_WIDTH_CLASS_NAME} aspect-5/7`

export function LeaderPickOverlay(): JSX.Element | null {
  const leaderPick = useSyncExternalStore(
    subscribeHud,
    () => getHudSnapshot().leaderPick,
    () => getHudSnapshot().leaderPick,
  )
  if (leaderPick === null) {
    return null
  }
  return (
    <div
      className="fixed inset-0 z-250 flex flex-col items-center overflow-y-auto pt-14 pb-4"
      role="dialog"
      aria-modal="true"
    >
      <div className={`fixed ${VEIL_CLASS_NAME}`} />
      <h2 className="root-panel relative z-1 m-0 px-3.5 py-1.5 font-display text-[22px] font-normal text-ink">
        {setupCardPickTitle(leaderPick.kind)}
      </h2>
      <div className="relative z-1 mt-6 flex max-w-[96vw] flex-row flex-wrap items-start justify-center gap-4">
        {setupCardPickOptions(leaderPick.kind, leaderPick.leaderIds).map((option) => {
          return (
            <button
              key={option.id}
              type="button"
              className="m-0 flex cursor-root-pointer flex-col items-center gap-2 border-0 bg-transparent p-0 text-parchment"
              onClick={() => {
                getHudCallbacks().onLeaderPicked(option.id)
              }}
            >
              {option.imagePath !== null ? (
                <img
                  className={`${SETUP_CARD_SIZE_CLASS_NAME} border-2 border-ink object-fill shadow-card select-none`}
                  src={option.imagePath}
                  alt={option.name}
                  draggable={false}
                />
              ) : (
                <div
                  className={`${SETUP_CARD_SIZE_CLASS_NAME} flex items-center justify-center border-2 border-ink bg-forest font-display text-parchment`}
                >
                  {option.name}
                </div>
              )}
              <span className={`${SETUP_CARD_WIDTH_CLASS_NAME} border border-ink-soft bg-parchment-aged px-1.5 py-1 text-center font-mono text-[clamp(11px,1.6vh,13px)] whitespace-pre-line text-ink paper-grain`}>
                {option.caption.join('\n')}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function syncGameDrawer(next: NonNullable<GameDrawerHudState>): void {
  const current = getHudSnapshot().gameDrawer
  if (
    current !== null &&
    current.discardCount === next.discardCount &&
    current.canUndo === next.canUndo &&
    current.canEndGame === next.canEndGame
  ) {
    return
  }
  patchHud({ gameDrawer: { ...next } })
}

export function syncWinnerOverlay(winnerFaction: string | null): void {
  if (winnerFaction === null) {
    patchHud({ winner: null })
    return
  }
  patchHud({ winner: { winnerFaction } })
}

/** Full-screen card pick: Eyrie leaders, or Vagabond characters in setup. */
export function syncLeaderPickOverlay(
  leaderIds: readonly string[] | null,
  kind: SetupCardPickKind = 'leader',
): void {
  if (leaderIds === null || leaderIds.length === 0) {
    patchHud({ leaderPick: null })
    return
  }
  patchHud({ leaderPick: { leaderIds, kind } })
}
