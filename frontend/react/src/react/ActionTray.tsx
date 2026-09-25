import { useSyncExternalStore, type JSX } from 'react'
import {
  isCardPileOpen,
  isCraftedCardsOpen,
} from '#game/cardGalleryBridge.ts'
import { isFactionBoardOpen } from '#game/factionBoardBridge.ts'
import {
  getHudCallbacks,
  getHudSnapshot,
  patchHud,
  subscribeHud,
} from '#game/hudStore.ts'
import type { ActionTrayState } from '#ui/ActionTray.ts'
import {
  filterTrayActions,
  formatActionLabel,
} from '#ui/ActionTray.ts'

function isAnyHudModalOpen(): boolean {
  return (
    isFactionBoardOpen() === true ||
    isCraftedCardsOpen() === true ||
    isCardPileOpen() === true
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
    isAnyHudModalOpen,
    isAnyHudModalOpen,
  )
  // Modal open gated live from store so veil/X close re-shows tray
  // without needing a board re-sync (options.disabled stays stale otherwise).
  if (tray === null || anyModalOpen || tray.options?.disabled === true) {
    return null
  }
  const forActor = filterTrayActions(tray.actions, tray.actorSeat, tray.options)
  const callbacks = getHudCallbacks()
  return (
    <div className="fixed top-16 right-0 z-[110] box-border flex w-[var(--root-landscape-side-percent)] flex-col items-center gap-2 px-2 portrait:top-auto portrait:right-auto portrait:bottom-[var(--root-portrait-tray-bottom)] portrait:left-1/2 portrait:z-[115] portrait:w-[calc(100vw-16px)] portrait:-translate-x-1/2 portrait:px-0">
      <div className="root-panel px-3 py-1.5 font-display text-xl tracking-[0.02em] text-ink portrait:text-base">
        {`Actions (${String(forActor.length)})`}
      </div>
      <div className="grid w-full grid-cols-[repeat(auto-fit,minmax(110px,1fr))] gap-1.5">
        {forActor.map((spec, index) => {
          const label = formatActionLabel(spec, tray.pending, tray.state)
          const key = `${spec.type}-${String(spec.actor)}-${String(index)}-${label}`
          return (
            <button
              key={key}
              type="button"
              className="root-button px-3 py-2 text-center text-[17px] portrait:px-2.5 portrait:py-[7px] portrait:text-sm"
              onClick={() => {
                callbacks.onSelectAction(spec)
              }}
            >
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function syncActionTray(actionTrayState: ActionTrayState): void {
  patchHud({
    actionTray: actionTrayState,
  })
}
