import { useState, useSyncExternalStore, type JSX } from 'react'
import { GiCardBurn } from 'react-icons/gi'
import { LuFlag, LuLogOut, LuUndo2 } from 'react-icons/lu'
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
const EXIT_MODAL_BUTTON_CLASS_NAME = 'root-button px-3.5 py-2 font-display text-lg'

/** Asks before leaving the game: one stray click must not end it. */
function ExitGameModal(props: {
  wording: ExitGameWording
  onConfirm: () => void
  onCancel: () => void
}): JSX.Element {
  return (
    <div
      className="exit-game-modal pointer-events-auto fixed inset-0 z-400 flex items-center justify-center"
      role="alertdialog"
      aria-modal="true"
      aria-label={props.wording.question}
    >
      <div className={`absolute ${VEIL_CLASS_NAME}`} onClick={props.onCancel} />
      <div className="root-panel relative z-1 m-3 flex max-w-[min(92vw,460px)] flex-col gap-3 px-5 py-4 text-ink">
        <h2 className="m-0 font-display text-2xl font-normal">
          {props.wording.question}
        </h2>
        <p className="m-0 font-body text-base">{props.wording.consequence}</p>
        <div className="flex flex-row flex-wrap justify-end gap-2">
          <button
            type="button"
            className={`${EXIT_MODAL_BUTTON_CLASS_NAME} root-button--quiet`}
            onClick={props.onCancel}
          >
            {KEEP_PLAYING_LABEL}
          </button>
          <button
            type="button"
            className={`${EXIT_MODAL_BUTTON_CLASS_NAME} root-button--accent`}
            onClick={props.onConfirm}
          >
            {props.wording.confirm}
          </button>
        </div>
      </div>
    </div>
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
