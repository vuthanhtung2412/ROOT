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
import '#react/ActionTray.css'

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
    <div className="action-tray">
      <div className="action-tray__title">
        {`Actions (${String(forActor.length)})`}
      </div>
      <div className="action-tray__buttons">
        {forActor.map((spec, index) => {
          const label = formatActionLabel(spec, tray.pending, tray.state)
          const key = `${spec.type}-${String(spec.actor)}-${String(index)}-${label}`
          return (
            <button
              key={key}
              type="button"
              className="action-tray__button"
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
