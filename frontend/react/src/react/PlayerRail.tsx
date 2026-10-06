import { useSyncExternalStore, type JSX } from 'react'
import type { IconType } from 'react-icons'
import { LuHand, LuLayers, LuScrollText, LuSun } from 'react-icons/lu'
import {
  factionTextureKey,
  imagePathForAssetKey,
} from '#assets/gameAssets.ts'
import type { GameState } from '#api/client.ts'
import {
  getHudCallbacks,
  getHudSnapshot,
  patchHud,
  subscribeHud,
} from '#game/hudStore.ts'
import { PUBLIC_HAND_FACTION_ID } from '#game/gameSceneModals.ts'
import { factionColorCss } from '#game/theme.ts'

const VAGABOND_FACTION_ID = 'vagabond'
/** Accessible names of the icon-only seat buttons. */
const CRAFTED_CARDS_LABEL = 'cards'
const COMPLETED_QUESTS_LABEL = 'quests'
const PUBLIC_HAND_LABEL = 'hand'
/** Torn paper seat; the ink edge takes the text colour (faction, gold when active). */
const SEAT_PANEL_CLASS_NAME =
  'root-paper box-border flex h-18 w-[min(260px,calc(50vw-14px))] flex-row items-center gap-2 px-2.5 py-2 [--root-paper-edge:currentColor] md:h-24 md:w-full md:max-w-(--root-player-rail-seat-max-width) md:gap-3 md:px-3 md:py-3'
/** Seat whose turn it is: gold edge, warmer parchment. */
const SEAT_PANEL_ACTIVE_CLASS_NAME =
  'text-gold [--root-paper-color:color-mix(in_srgb,var(--color-parchment)_82%,var(--color-gold))]'
const ACTIVE_SEAT_MARK_CLASS_NAME =
  'root-paper root-medallion absolute -top-2.5 -left-1.5 flex size-7 items-center justify-center text-base text-ink [--root-paper-color:var(--color-gold)]'
/** Portrait tile: faction tint behind the head icon. */
const SEAT_PORTRAIT_CLASS_NAME =
  'box-border size-12 shrink-0 border-2 border-ink-deep object-contain p-1 md:size-16'
/** Faction colour softened toward parchment so the head icon stays readable. */
const PORTRAIT_TINT_PERCENT = 45
const SEAT_VICTORY_POINTS_CLASS_NAME =
  'root-paper root-medallion flex size-7 shrink-0 items-center justify-center font-mono text-sm font-bold text-parchment md:size-8 md:text-base'
const SEAT_BUTTON_CLASS_NAME =
  'root-paper root-medallion root-paper-press m-0 flex size-8 items-center justify-center p-0 text-base text-ink [--root-paper-color:var(--color-parchment-deep)] md:size-9 md:text-lg'

type SeatButtonView = {
  label: string
  Icon: IconType
  /** Bare hook class a QA script selects on. */
  hookClassName: string
  onClick: () => void
}

function SeatButton(props: { button: SeatButtonView }): JSX.Element {
  const button: SeatButtonView = props.button
  return (
    <button
      type="button"
      className={`${button.hookClassName} ${SEAT_BUTTON_CLASS_NAME}`}
      aria-label={button.label}
      title={button.label}
      onClick={button.onClick}
    >
      <button.Icon aria-hidden="true" />
    </button>
  )
}

export function PlayerRail(): JSX.Element | null {
  const rail = useSyncExternalStore(
    subscribeHud,
    () => getHudSnapshot().playerRail,
    () => getHudSnapshot().playerRail,
  )
  if (rail === null) {
    return null
  }
  const callbacks = getHudCallbacks()
  return (
    <div className="fixed top-16 right-2 left-2 z-100 box-border flex w-auto flex-row flex-wrap items-stretch justify-center gap-1.5 px-0 md:top-10 md:right-auto md:bottom-3 md:left-0 md:w-(--root-landscape-side-percent) md:flex-col md:flex-nowrap md:items-center md:justify-start md:gap-3.5 md:overflow-x-hidden md:overflow-y-auto md:px-3 md:pt-3">
      {rail.state.players.map((player) => {
        const isActive = player.seat === rail.activeSeat
        const factionColor: string = factionColorCss(player.faction)
        const iconPath = imagePathForAssetKey(
          factionTextureKey(player.faction),
        )
        const seatButtons: SeatButtonView[] = []
        if (player.faction === VAGABOND_FACTION_ID) {
          seatButtons.push({
            label: COMPLETED_QUESTS_LABEL,
            Icon: LuScrollText,
            hookClassName: 'player-rail__quests',
            onClick: () => {
              callbacks.onCompletedQuestsClick(player.seat)
            },
          })
        }
        if (player.faction === PUBLIC_HAND_FACTION_ID) {
          seatButtons.push({
            label: PUBLIC_HAND_LABEL,
            Icon: LuHand,
            hookClassName: 'player-rail__public-hand',
            onClick: () => {
              callbacks.onPublicHandClick(player.seat)
            },
          })
        }
        seatButtons.push({
          label: CRAFTED_CARDS_LABEL,
          Icon: LuLayers,
          hookClassName: 'player-rail__crafted-cards',
          onClick: () => {
            callbacks.onCraftedCardsClick(player.seat)
          },
        })
        return (
          <div
            key={player.seat}
            className={
              isActive
                ? `${SEAT_PANEL_CLASS_NAME} ${SEAT_PANEL_ACTIVE_CLASS_NAME}`
                : SEAT_PANEL_CLASS_NAME
            }
            style={isActive ? undefined : { color: factionColor }}
          >
            {isActive ? (
              <span className={ACTIVE_SEAT_MARK_CLASS_NAME} aria-hidden="true">
                <LuSun />
              </span>
            ) : null}
            <button
              type="button"
              className="m-0 flex min-w-0 flex-1 cursor-pointer flex-row items-center gap-2 border-0 bg-transparent p-0 text-left md:gap-3"
              onClick={() => {
                callbacks.onSeatClick(player.seat)
              }}
            >
              {iconPath !== null ? (
                <img
                  className={SEAT_PORTRAIT_CLASS_NAME}
                  style={{
                    backgroundColor: `color-mix(in srgb, ${factionColor} ${String(PORTRAIT_TINT_PERCENT)}%, var(--color-parchment))`,
                  }}
                  src={iconPath}
                  alt={player.faction}
                  draggable={false}
                />
              ) : (
                <div className="size-12 shrink-0 bg-ink-soft md:size-16" />
              )}
              <span className="flex min-w-0 flex-1 flex-col gap-1 text-ink">
                <span className="truncate font-display text-[17px] leading-none capitalize md:text-xl">
                  {player.faction}
                </span>
                <span className="flex flex-row items-center gap-1.5 font-body text-[13px] leading-none md:text-[15px]">
                  <span className={SEAT_VICTORY_POINTS_CLASS_NAME}>
                    {String(player.vp)}
                  </span>
                  VP
                </span>
              </span>
            </button>
            <div className="flex shrink-0 flex-col items-center gap-1 md:gap-1.5">
              {seatButtons.map((button: SeatButtonView) => (
                <SeatButton key={button.label} button={button} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function syncPlayerRail(state: GameState, activeSeat: number): void {
  patchHud({
    playerRail: { state, activeSeat },
  })
}
