import { useSyncExternalStore, type JSX } from 'react'
import { lookupEyrieLeader } from '#assets/eyrieLeaderCatalog.ts'
import {
  getHudCallbacks,
  getHudSnapshot,
  patchHud,
  subscribeHud,
} from '#game/hudStore.ts'
import '#react/HudChrome.css'

export function GameDrawer(): JSX.Element {
  const drawer = useSyncExternalStore(
    subscribeHud,
    () => getHudSnapshot().gameDrawer,
    () => getHudSnapshot().gameDrawer,
  )
  const callbacks = getHudCallbacks()

  return (
    <div className="hud-chrome__drawer">
      <button
        type="button"
        className={
          drawer.endGameArmed
            ? 'hud-chrome__drawer-button hud-chrome__drawer-button--end-armed'
            : 'hud-chrome__drawer-button hud-chrome__drawer-button--end'
        }
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
        className="hud-chrome__drawer-button hud-chrome__drawer-button--discard"
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
    <div className="hud-chrome__winner" role="dialog" aria-modal="true">
      <div className="hud-chrome__winner-veil" />
      <p className="hud-chrome__winner-message">{`${winner.winnerFaction} wins`}</p>
      <button
        type="button"
        className="hud-chrome__winner-button"
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
    <div className="hud-chrome__leader-pick" role="dialog" aria-modal="true">
      <div className="hud-chrome__leader-pick-veil" />
      <h2 className="hud-chrome__leader-pick-title">Choose Eyrie leader</h2>
      <div className="hud-chrome__leader-pick-row">
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
              className="hud-chrome__leader-card"
              onClick={() => {
                getHudCallbacks().onLeaderPicked(leaderId)
              }}
            >
              {imagePath !== null ? (
                <img
                  className="hud-chrome__leader-face"
                  src={imagePath}
                  alt={info?.name ?? leaderId}
                  draggable={false}
                />
              ) : (
                <div className="hud-chrome__leader-face hud-chrome__leader-face--fallback">
                  {leaderId}
                </div>
              )}
              <span className="hud-chrome__leader-caption">
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
  if (current.discardCount === discardCount) {
    return
  }
  patchHud({
    gameDrawer: {
      discardCount,
      endGameArmed: current.endGameArmed,
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
