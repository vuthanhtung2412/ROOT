import { useSyncExternalStore, type JSX } from 'react'
import type { ActionSpec } from '#api/client.ts'
import {
  getCardPileSnapshot,
  isCraftedCardsOpen,
} from '#game/cardGalleryBridge.ts'
import { isFactionBoardOpen } from '#game/factionBoardBridge.ts'
import {
  getHudCallbacks,
  getHudSnapshot,
  patchHud,
  subscribeHud,
} from '#game/hudStore.ts'
import type { IconType } from 'react-icons'
import { imagePathForAssetKey, suitTextureKey } from '#assets/gameAssets.ts'
import type {
  ActionTrayState,
  TrayActionArt,
  TrayActionRegion,
} from '#ui/ActionTray.ts'
import { actionIconFor } from '#ui/actionIcons.ts'
import { phaseIconFor } from '#ui/phaseIcons.ts'
import {
  trayActionArt,
  trayActionCountLabel,
  collapseTrayActionsByLabel,
  filterTrayActions,
  formatActionLabel,
  partitionTrayActionRegions,
  withoutBoardOnlyActions,
} from '#ui/ActionTray.ts'

function isBlockingHudModalOpen(): boolean {
  if (isFactionBoardOpen() === true || isCraftedCardsOpen() === true) {
    return true
  }
  const pile = getCardPileSnapshot()
  // Selectable supporter pick must not hide tray chrome / block the map.
  return pile !== null && pile.selectable !== true
}

const META_REGION_ID: TrayActionRegion['id'] = 'meta'

/** Narrow: one row of chips. Wide: medallions with a short label in the side column. */
const ACTION_GRID_CLASS_NAME =
  'grid w-full grid-cols-[repeat(auto-fit,minmax(110px,1fr))] gap-1.5 md:grid-cols-[repeat(auto-fit,minmax(68px,1fr))] md:gap-x-1 md:gap-y-3'
const META_GRID_CLASS_NAME =
  'grid w-full grid-cols-[repeat(auto-fit,minmax(110px,1fr))] gap-1.5 md:gap-2.5'
/** Narrow: a paper chip. Wide: the chip paper is dropped, the icon sits on a medallion. */
const ACTION_BUTTON_CLASS_NAME =
  'action-tray__action root-paper root-paper-fine root-paper-press m-0 flex w-full min-w-0 flex-row items-center justify-center gap-1.5 px-2.5 py-1.5 text-center font-display text-sm text-ink capitalize md:flex-col md:gap-1 md:p-0 md:text-[15px] md:leading-tight md:[--root-paper-color:transparent] md:[--root-paper-edge:transparent] md:[--root-paper-texture:none]'
const ACTION_ICON_CLASS_NAME =
  'relative flex shrink-0 items-center justify-center text-lg text-ink md:root-paper md:root-medallion md:size-12 md:text-2xl md:text-parchment'
/** Suit of the card an action plays (Decree), pinned on the medallion. */
const ACTION_SUIT_BADGE_CLASS_NAME =
  'pointer-events-none ml-1 size-4 object-contain md:absolute md:-right-1.5 md:-bottom-1.5 md:ml-0 md:size-6'
/** Turn control (end phase, draw): a wide paper button, icon after the label. */
const META_BUTTON_CLASS_NAME =
  'action-tray__action root-paper root-paper-fine root-paper-press m-0 flex w-full min-w-0 flex-row-reverse items-center justify-center gap-2 px-2.5 py-1.5 text-center font-display text-sm text-ink capitalize [--root-paper-color:var(--color-parchment-deep)] md:py-2 md:text-[17px]'
const META_ICON_CLASS_NAME = 'flex shrink-0 items-center justify-center text-lg'
/** Wide: the main actions sit on one sheet of paper. */
const ACTION_REGION_CLASS_NAME =
  'flex w-full flex-col items-center gap-2 md:root-paper md:px-2 md:pt-2 md:pb-3'
const META_REGION_CLASS_NAME = 'flex w-full flex-col items-center gap-2'
/** Tray header: phase mark, phase name, small action count pushed right. */
const TRAY_HEADER_CLASS_NAME =
  'flex w-full flex-row items-center gap-2.5 px-1.5 font-display text-lg tracking-display text-parchment text-shadow-ink md:mb-1.5 md:border-b-2 md:border-dashed md:border-ink/35 md:pb-2.5 md:text-2xl md:text-ink md:text-shadow-none'
/** Gold diamond holding the time-of-day icon. */
const TRAY_HEADER_PHASE_MARK_CLASS_NAME =
  'root-paper root-paper-fine flex size-6 shrink-0 rotate-45 items-center justify-center text-base text-ink text-shadow-none [--root-paper-color:var(--color-gold)] md:size-7 md:text-lg'
const TRAY_HEADER_COUNT_CLASS_NAME =
  'ml-auto font-mono text-xs tracking-normal opacity-75 md:text-[13px]'
const ACTION_REGION_TITLE_CLASS_NAME =
  'font-display text-base tracking-display text-parchment text-shadow-ink md:text-xl md:text-ink md:text-shadow-none'
/** The turn-control buttons need no title; kept for screen readers. */
const META_REGION_TITLE_CLASS_NAME = 'sr-only'

function TrayActionButtons(props: {
  actions: readonly ActionSpec[]
  pending: unknown
  state: ActionTrayState['state']
  isMetaRegion: boolean
  onSelectAction: (spec: ActionSpec) => void
}): JSX.Element {
  return (
    <div
      className={
        props.isMetaRegion ? META_GRID_CLASS_NAME : ACTION_GRID_CLASS_NAME
      }
    >
      {props.actions.map((spec, index) => {
        const label = formatActionLabel(spec, props.pending, props.state)
        const key = `${spec.type}-${String(spec.actor)}-${String(index)}-${label}`
        const art: TrayActionArt = trayActionArt(
          spec,
          props.state,
          props.pending,
        )
        const ActionIcon: IconType = actionIconFor(art.iconKey)
        const suitTexture: string | null =
          art.suit !== null ? suitTextureKey(art.suit) : null
        const suitImagePath: string | null =
          suitTexture !== null ? imagePathForAssetKey(suitTexture) : null
        return (
          <button
            key={key}
            type="button"
            className={
              props.isMetaRegion
                ? META_BUTTON_CLASS_NAME
                : ACTION_BUTTON_CLASS_NAME
            }
            onClick={() => {
              props.onSelectAction(spec)
            }}
          >
            <span
              className={
                props.isMetaRegion
                  ? META_ICON_CLASS_NAME
                  : ACTION_ICON_CLASS_NAME
              }
              aria-hidden="true"
            >
              <ActionIcon />
              {suitImagePath !== null ? (
                <img
                  className={ACTION_SUIT_BADGE_CLASS_NAME}
                  src={suitImagePath}
                  alt=""
                  draggable={false}
                />
              ) : null}
            </span>
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
    isBlockingHudModalOpen,
    isBlockingHudModalOpen,
  )
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
  const regions = partitionTrayActionRegions(forActor, tray.state)
  if (regions.length === 0) {
    return null
  }
  const callbacks = getHudCallbacks()
  const phase: string = tray.state?.phase ?? ''
  const PhaseIcon: IconType | null = phaseIconFor(phase)
  return (
    <div className="fixed bottom-(--root-portrait-tray-bottom) left-1/2 z-115 box-border flex w-[calc(100vw-16px)] -translate-x-1/2 flex-col items-center gap-3 px-0 md:top-16 md:right-0 md:bottom-3 md:left-auto md:z-110 md:w-(--root-landscape-side-percent) md:translate-x-0 md:overflow-x-hidden md:overflow-y-auto md:px-2">
      {regions.map((region) => {
        const isMetaRegion: boolean = region.id === META_REGION_ID
        return (
          <div
            key={region.id}
            className={
              isMetaRegion ? META_REGION_CLASS_NAME : ACTION_REGION_CLASS_NAME
            }
          >
            {isMetaRegion || PhaseIcon === null ? (
              <div
                className={
                  isMetaRegion
                    ? META_REGION_TITLE_CLASS_NAME
                    : ACTION_REGION_TITLE_CLASS_NAME
                }
              >
                {region.title}
              </div>
            ) : (
              <div className={TRAY_HEADER_CLASS_NAME} aria-label={region.title}>
                <span className={TRAY_HEADER_PHASE_MARK_CLASS_NAME}>
                  <PhaseIcon className="-rotate-45" aria-hidden="true" />
                </span>
                <span className="capitalize">{phase}</span>
                <span className={TRAY_HEADER_COUNT_CLASS_NAME}>
                  {trayActionCountLabel(region.actions.length, tray.state)}
                </span>
              </div>
            )}
            <TrayActionButtons
              actions={region.actions}
              pending={tray.pending}
              state={tray.state}
              isMetaRegion={isMetaRegion}
              onSelectAction={callbacks.onSelectAction}
            />
          </div>
        )
      })}
    </div>
  )
}

export function syncActionTray(actionTrayState: ActionTrayState): void {
  patchHud({
    actionTray: actionTrayState,
  })
}
