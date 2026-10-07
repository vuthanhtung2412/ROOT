import { useSyncExternalStore, type JSX } from 'react'
import { GiCardBurn } from 'react-icons/gi'
import { LuFlag } from 'react-icons/lu'
import {
  getHudCallbacks,
  getHudSnapshot,
  patchHud,
  subscribeHud,
} from '#game/hudStore.ts'
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

export function GameDrawer(): JSX.Element | null {
  const drawer = useSyncExternalStore(
    subscribeHud,
    () => getHudSnapshot().gameDrawer,
    () => getHudSnapshot().gameDrawer,
  )
  if (drawer === null) {
    return null
  }
  const callbacks = getHudCallbacks()

  return (
    <div className="pointer-events-none fixed right-2 bottom-(--root-portrait-drawer-bottom) left-2 z-112 flex justify-between md:right-3 md:bottom-22.5 md:left-3">
      <button
        type="button"
        className={`${DRAWER_BUTTON_CLASS_NAME} [--root-paper-color:color-mix(in_srgb,var(--color-rust)_45%,var(--color-parchment))]`}
        onClick={() => {
          if (!drawer.endGameArmed) {
            patchHud({
              gameDrawer: { ...drawer, endGameArmed: true },
            })
            return
          }
          patchHud({
            gameDrawer: { ...drawer, endGameArmed: false },
          })
          callbacks.onEndGame()
        }}
      >
        <LuFlag aria-hidden="true" />
        {drawer.endGameArmed ? 'Confirm end?' : 'End game'}
      </button>
      <button
        type="button"
        className={`${DRAWER_BUTTON_CLASS_NAME} ml-auto`}
        onClick={() => {
          callbacks.onOpenDiscardPile()
        }}
      >
        <GiCardBurn aria-hidden="true" />
        {`Discarded pile (${String(drawer.discardCount)})`}
      </button>
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
              className="m-0 flex cursor-pointer flex-col items-center gap-2 border-0 bg-transparent p-0 text-parchment"
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

export function syncGameDrawerDiscardCount(discardCount: number): void {
  const current = getHudSnapshot().gameDrawer
  if (current !== null) {
    if (current.discardCount === discardCount) {
      return
    }
    patchHud({
      gameDrawer: {
        discardCount,
        endGameArmed: current.endGameArmed,
      },
    })
    return
  }
  patchHud({
    gameDrawer: {
      discardCount,
      endGameArmed: false,
    },
  })
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
