import { useSyncExternalStore, type JSX } from 'react'
import type { ActionSpec } from '#api/client.ts'
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
  collapseTrayActionsByLabel,
  filterTrayActions,
  formatActionLabel,
  partitionTrayActionRegions,
} from '#ui/ActionTray.ts'

function isAnyHudModalOpen(): boolean {
  return (
    isFactionBoardOpen() === true ||
    isCraftedCardsOpen() === true ||
    isCardPileOpen() === true
  )
}

function TrayActionButtons(props: {
  actions: readonly ActionSpec[]
  pending: unknown
  state: ActionTrayState['state']
  onSelectAction: (spec: ActionSpec) => void
}): JSX.Element {
  return (
    <div className="grid w-full grid-cols-[repeat(auto-fit,minmax(110px,1fr))] gap-1.5">
      {props.actions.map((spec, index) => {
        const label = formatActionLabel(spec, props.pending, props.state)
        const key = `${spec.type}-${String(spec.actor)}-${String(index)}-${label}`
        return (
          <button
            key={key}
            type="button"
            className="root-button px-2.5 py-[7px] text-center text-sm md:px-3 md:py-2 md:text-[17px]"
            onClick={() => {
              props.onSelectAction(spec)
            }}
          >
            {label}
          </button>
        )
      })}
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
    isAnyHudModalOpen,
    isAnyHudModalOpen,
  )
  // Modal open gated live from store so veil/X close re-shows tray
  // without needing a board re-sync (options.disabled stays stale otherwise).
  if (tray === null || anyModalOpen || tray.options?.disabled === true) {
    return null
  }
  const forActor = collapseTrayActionsByLabel(
    filterTrayActions(tray.actions, tray.actorSeat, tray.options),
    tray.pending,
    tray.state,
  )
  const regions = partitionTrayActionRegions(forActor)
  if (regions.length === 0) {
    return null
  }
  const callbacks = getHudCallbacks()
  return (
    <div className="fixed bottom-[var(--root-portrait-tray-bottom)] left-1/2 z-[115] box-border flex w-[calc(100vw-16px)] -translate-x-1/2 flex-col items-center gap-3 px-0 md:top-16 md:right-0 md:bottom-auto md:left-auto md:z-[110] md:w-[var(--root-landscape-side-percent)] md:translate-x-0 md:px-2">
      {regions.map((region) => (
        <div
          key={region.id}
          className="flex w-full flex-col items-center gap-2"
        >
          <div className="root-panel px-3 py-1.5 font-display text-base tracking-[0.02em] text-ink md:text-xl">
            {region.title}
          </div>
          <TrayActionButtons
            actions={region.actions}
            pending={tray.pending}
            state={tray.state}
            onSelectAction={callbacks.onSelectAction}
          />
        </div>
      ))}
    </div>
  )
}

export function syncActionTray(actionTrayState: ActionTrayState): void {
  patchHud({
    actionTray: actionTrayState,
  })
}
