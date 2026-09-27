import { useSyncExternalStore, type JSX } from 'react'
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
import { factionColorForSeat } from '#game/theme.ts'

const VAGABOND_FACTION_ID = 'vagabond'

function colorToCss(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`
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
    <div className="fixed top-16 right-2 left-2 z-[100] box-border flex w-auto flex-row flex-wrap items-stretch justify-center gap-1.5 px-0 md:top-10 md:right-auto md:left-0 md:w-[var(--root-landscape-side-percent)] md:flex-col md:flex-nowrap md:items-center md:justify-start md:gap-3.5 md:px-2">
      {rail.state.players.map((player) => {
        const isActive = player.seat === rail.activeSeat
        const color = factionColorForSeat(player.seat, rail.state.factions)
        const iconPath = imagePathForAssetKey(
          factionTextureKey(player.faction),
        )
        const isVagabond = player.faction === VAGABOND_FACTION_ID
        return (
          <div
            key={player.seat}
            className={
              isActive
                ? 'root-panel box-border flex h-[4.5rem] w-[min(260px,calc(50vw-14px))] flex-row items-center gap-2 px-2.5 py-2 shadow-[inset_0_0_0_1px_var(--color-parchment-shadow),0_0_0_2px_color-mix(in_srgb,var(--color-gold)_70%,var(--color-ink)),2px_2px_0_color-mix(in_srgb,var(--color-ink)_30%,transparent)] bg-[color-mix(in_srgb,var(--color-parchment)_96%,var(--color-gold))] md:h-28 md:w-full md:max-w-[var(--root-player-rail-seat-max-width)] md:gap-3 md:px-3 md:py-3'
                : 'root-panel box-border flex h-[4.5rem] w-[min(260px,calc(50vw-14px))] flex-row items-center gap-2 px-2.5 py-2 md:h-28 md:w-full md:max-w-[var(--root-player-rail-seat-max-width)] md:gap-3 md:px-3 md:py-3'
            }
            style={{
              borderColor: isActive ? '#ffe08a' : colorToCss(color),
            }}
          >
            <button
              type="button"
              className="m-0 flex min-w-0 flex-1 cursor-pointer flex-row items-center gap-2 border-0 bg-transparent p-0 text-left md:gap-3"
              onClick={() => {
                callbacks.onSeatClick(player.seat)
              }}
            >
              {iconPath !== null ? (
                <img
                  className="size-12 shrink-0 object-contain drop-shadow-[1px_1px_0_color-mix(in_srgb,var(--color-ink)_25%,transparent)] md:size-[4.5rem]"
                  src={iconPath}
                  alt={player.faction}
                  draggable={false}
                />
              ) : (
                <div className="size-12 shrink-0 bg-ink-soft md:size-[4.5rem]" />
              )}
              <span className="min-w-0 flex-1 overflow-hidden font-body text-[15px] leading-[1.2] break-words whitespace-pre-line text-ink md:text-[18px]">
                {`${player.faction}\n${String(player.vp)} VP`}
              </span>
            </button>
            <div className="flex shrink-0 flex-col items-stretch gap-1">
              {isVagabond ? (
                <button
                  type="button"
                  className="root-button root-button--quiet px-2 py-1 font-mono text-[12px] md:text-[14px]"
                  onClick={() => {
                    callbacks.onCompletedQuestsClick(player.seat)
                  }}
                >
                  quests
                </button>
              ) : null}
              <button
                type="button"
                className="root-button root-button--quiet px-2 py-1 font-mono text-[12px] md:text-[14px]"
                onClick={() => {
                  callbacks.onCraftedCardsClick(player.seat)
                }}
              >
                cards
              </button>
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
