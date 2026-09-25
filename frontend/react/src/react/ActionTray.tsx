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
    <div className="fixed top-16 right-3 z-[110] flex max-w-[260px] flex-col items-start gap-2 portrait:top-auto portrait:right-2 portrait:bottom-[118px] portrait:left-2 portrait:z-[115] portrait:max-w-none portrait:items-stretch">
      <div className="root-panel px-3 py-1.5 font-display text-xl tracking-[0.02em] text-ink portrait:self-center portrait:text-base">
        {`Actions (${String(forActor.length)})`}
      </div>
      <div className="flex flex-col items-start gap-1.5 portrait:flex-row portrait:flex-wrap portrait:items-stretch portrait:justify-center">
        {forActor.map((spec, index) => {
          const label = formatActionLabel(spec, tray.pending, tray.state)
          const key = `${spec.type}-${String(spec.actor)}-${String(index)}-${label}`
          return (
            <button
              key={key}
              type="button"
              className="root-button px-3 py-2 text-left text-[17px] portrait:px-2.5 portrait:py-[7px] portrait:text-sm"
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
