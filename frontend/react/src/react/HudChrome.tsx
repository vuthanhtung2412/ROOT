import { useSyncExternalStore, type JSX } from 'react'
import { lookupEyrieLeader } from '#assets/eyrieLeaderCatalog.ts'
import {
  getHudCallbacks,
  getHudSnapshot,
  patchHud,
  subscribeHud,
} from '#game/hudStore.ts'

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
    <div className="pointer-events-none fixed right-3 bottom-[90px] left-3 z-[112] flex justify-between portrait:right-2 portrait:bottom-[var(--root-portrait-drawer-bottom)] portrait:left-2">
      <button
        type="button"
        className="root-button root-button--danger pointer-events-auto px-2.5 py-1.5 font-mono text-sm"
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
        {drawer.endGameArmed ? 'Confirm end?' : 'End game'}
      </button>
      <button
        type="button"
        className="root-button root-button--quiet pointer-events-auto ml-auto px-2.5 py-1.5 font-mono text-sm"
        onClick={() => {
          callbacks.onOpenDiscardPile()
        }}
      >
        {`Discard (${String(drawer.discardCount)})`}
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
      className="fixed inset-0 z-[320] flex flex-col items-center justify-center gap-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-[color-mix(in_srgb,var(--color-forest-deep)_72%,transparent)]" />
      <p className="root-panel relative z-[1] m-0 px-5 py-3 text-center font-display text-4xl text-ink">
        {`${winner.winnerFaction} wins`}
      </p>
      <button
        type="button"
        className="root-button root-button--accent relative z-[1] px-3.5 py-2 text-base"
        onClick={() => {
          getHudCallbacks().onReturnToMenu()
        }}
      >
        Back to menu
      </button>
    </div>
  )
}

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
      className="fixed inset-0 z-[250] flex flex-col items-center pt-14"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-[color-mix(in_srgb,var(--color-forest-deep)_72%,transparent)]" />
      <h2 className="root-panel relative z-[1] m-0 px-3.5 py-1.5 font-display text-[22px] font-normal text-ink">
        Choose Eyrie leader
      </h2>
      <div className="relative z-[1] mt-12 flex max-w-[96vw] flex-row flex-wrap items-start justify-center gap-4">
        {leaderPick.leaderIds.map((leaderId) => {
          const info = lookupEyrieLeader(leaderId)
          const imagePath =
            info === null
              ? null
              : info.imagePath.startsWith('/')
                ? info.imagePath
                : `/${info.imagePath}`
          return (
            <button
              key={leaderId}
              type="button"
              className="m-0 flex cursor-pointer flex-col items-center gap-2 border-0 bg-transparent p-0 text-parchment"
              onClick={() => {
                getHudCallbacks().onLeaderPicked(leaderId)
              }}
            >
              {imagePath !== null ? (
                <img
                  className="h-[210px] w-[150px] border-2 border-ink object-fill shadow-[2px_3px_0_color-mix(in_srgb,var(--color-ink)_35%,transparent)] select-none"
                  src={imagePath}
                  alt={info?.name ?? leaderId}
                  draggable={false}
                />
              ) : (
                <div className="flex h-[210px] w-[150px] items-center justify-center border-2 border-ink bg-forest font-display text-parchment">
                  {leaderId}
                </div>
              )}
              <span className="max-w-[170px] border border-ink-soft bg-[color-mix(in_srgb,var(--color-parchment)_94%,#1a1410)] px-1.5 py-1 text-center font-mono text-[11px] whitespace-pre-line text-ink [background-blend-mode:multiply] [background-image:var(--root-paper-grain)]">
                {[
                  info?.name ?? leaderId,
                  info !== null ? `Viziers: ${info.decree}` : '',
                  info?.ability ?? '',
                ]
                  .filter((line) => line.length > 0)
                  .join('\n')}
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

export function syncLeaderPickOverlay(
  leaderIds: readonly string[] | null,
): void {
  if (leaderIds === null || leaderIds.length === 0) {
    patchHud({ leaderPick: null })
    return
  }
  patchHud({ leaderPick: { leaderIds } })
}
