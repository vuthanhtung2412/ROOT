import { useSyncExternalStore, type JSX } from 'react'
import type { IconType } from 'react-icons'
import { GiLaurels } from 'react-icons/gi'
import { LuLayers, LuScrollText, LuShoppingCart, LuSun } from 'react-icons/lu'
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
import { Tooltip } from '#react/Tooltip.tsx'

const VAGABOND_FACTION_ID = 'vagabond'
/** Accessible names of the icon-only seat buttons. */
const CRAFTED_CARDS_LABEL = 'cards'
const COMPLETED_QUESTS_LABEL = 'quests'
const PUBLIC_HAND_LABEL = 'hand'
/**
 * One seat = one portrait tile: faction tint (the paper takes the text
 * colour), head art, badges pinned on the corners.
 */
const SEAT_TILE_CLASS_NAME =
  'root-paper relative box-border size-16 shrink-0 [--root-paper-color:currentColor] md:size-20'
/** Seat whose turn it is: a little bigger, under the sun badge. */
const SEAT_TILE_ACTIVE_CLASS_NAME = 'scale-110'
const SEAT_PORTRAIT_BUTTON_CLASS_NAME =
  'm-0 box-border flex size-full cursor-pointer items-center justify-center border-0 bg-transparent p-2'
/** Faction colour softened toward parchment so the head icon stays readable. */
const PORTRAIT_TINT_PERCENT = 55
const SEAT_BADGE_CLASS_NAME =
  'root-paper root-medallion absolute flex items-center justify-center'
/** Top left: whose turn it is. */
const ACTIVE_SEAT_MARK_CLASS_NAME = `${SEAT_BADGE_CLASS_NAME} -top-2.5 -left-2.5 size-6 text-sm text-ink [--root-paper-color:var(--color-gold)] md:size-7 md:text-base`
/** Bottom left: victory points. */
const SEAT_VICTORY_POINTS_CLASS_NAME =
  'pointer-events-none absolute -bottom-3 -left-3 flex size-8 items-center justify-center md:-bottom-3 md:-left-3 md:size-10'
/** Laurel wreath around the score: gold leaves with an ink outline. */
const SEAT_VICTORY_WREATH_CLASS_NAME =
  'absolute inset-0 size-full text-gold [filter:drop-shadow(1px_0_0_var(--color-ink-deep))_drop-shadow(-1px_0_0_var(--color-ink-deep))_drop-shadow(0_1px_0_var(--color-ink-deep))_drop-shadow(0_-1px_0_var(--color-ink-deep))]'
/** Gold coin holding the score, set in the middle of the wreath. */
const SEAT_VICTORY_COIN_CLASS_NAME =
  'root-paper root-medallion -mt-0.5 flex size-5 items-center justify-center font-mono text-xs font-bold text-white text-shadow-outline [--root-paper-color:var(--color-gold)] md:size-6 md:text-sm'
const SEAT_BUTTON_CLASS_NAME =
  'root-paper root-medallion root-paper-press m-0 flex size-7 items-center justify-center p-0 text-sm text-ink [--root-paper-color:var(--color-parchment-deep)] md:size-8 md:text-base'
/**
 * Right edge, stacked from the bottom corner up: crafted cards first, then
 * the faction's own buttons above it.
 */
const SEAT_BUTTON_STACK_CLASS_NAME =
  'absolute -right-2.5 -bottom-2.5 flex flex-col-reverse items-center gap-0.5'

type SeatButtonView = {
  label: string
  Icon: IconType
  /** Bare hook class a QA script selects on. */
  hookClassName: string
  onClick: () => void
}

function SeatButton(props: {
  button: SeatButtonView
}): JSX.Element {
  const button: SeatButtonView = props.button
  return (
    <Tooltip label={button.label}>
      <button
        type="button"
        className={`${button.hookClassName} ${SEAT_BUTTON_CLASS_NAME}`}
        aria-label={button.label}
        onClick={button.onClick}
      >
        <button.Icon aria-hidden="true" />
      </button>
    </Tooltip>
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
    <div className="fixed top-16 right-2 left-2 z-100 box-border flex w-auto flex-row flex-wrap items-start justify-center gap-5 px-0 pt-1 md:top-10 md:right-auto md:bottom-3 md:left-0 md:w-(--root-landscape-side-percent) md:flex-col md:flex-nowrap md:items-center md:justify-start md:gap-8 md:overflow-x-hidden md:overflow-y-auto md:px-4 md:pt-4">
      {rail.state.players.map((player) => {
        const isActive = player.seat === rail.activeSeat
        const factionColor: string = factionColorCss(player.faction)
        const iconPath = imagePathForAssetKey(
          factionTextureKey(player.faction),
        )
        const seatButtons: SeatButtonView[] = [
          {
            label: CRAFTED_CARDS_LABEL,
            Icon: LuLayers,
            hookClassName: 'player-rail__crafted-cards',
            onClick: () => {
              callbacks.onCraftedCardsClick(player.seat)
            },
          },
        ]
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
            Icon: LuShoppingCart,
            hookClassName: 'player-rail__public-hand',
            onClick: () => {
              callbacks.onPublicHandClick(player.seat)
            },
          })
        }
        return (
          <div
            key={player.seat}
            className={
              isActive
                ? `${SEAT_TILE_CLASS_NAME} ${SEAT_TILE_ACTIVE_CLASS_NAME}`
                : SEAT_TILE_CLASS_NAME
            }
            style={{
              color: `color-mix(in srgb, ${factionColor} ${String(PORTRAIT_TINT_PERCENT)}%, var(--color-parchment))`,
            }}
          >
            <Tooltip label={player.faction} className="flex size-full">
              <button
                type="button"
                className={SEAT_PORTRAIT_BUTTON_CLASS_NAME}
                onClick={() => {
                  callbacks.onSeatClick(player.seat)
                }}
              >
                {iconPath !== null ? (
                  <img
                    className="size-full object-contain"
                    src={iconPath}
                    alt={player.faction}
                    draggable={false}
                  />
                ) : null}
                {/* Head art names the faction; the text stays for screen readers. */}
                <span className="sr-only">{player.faction}</span>
                <span
                  className={SEAT_VICTORY_POINTS_CLASS_NAME}
                  aria-label={`${String(player.vp)} VP`}
                >
                  <GiLaurels
                    className={SEAT_VICTORY_WREATH_CLASS_NAME}
                    aria-hidden="true"
                  />
                  <span className={SEAT_VICTORY_COIN_CLASS_NAME}>
                    {String(player.vp)}
                  </span>
                </span>
              </button>
            </Tooltip>
            {isActive ? (
              <span className={ACTIVE_SEAT_MARK_CLASS_NAME} aria-hidden="true">
                <LuSun />
              </span>
            ) : null}
            <div className={SEAT_BUTTON_STACK_CLASS_NAME}>
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
