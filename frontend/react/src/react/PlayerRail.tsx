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
                ? 'root-panel relative box-border h-[4.5rem] w-[min(210px,calc(50vw-14px))] shadow-[inset_0_0_0_1px_var(--color-parchment-shadow),0_0_0_2px_color-mix(in_srgb,var(--color-gold)_70%,var(--color-ink)),2px_2px_0_color-mix(in_srgb,var(--color-ink)_30%,transparent)] bg-[color-mix(in_srgb,var(--color-parchment)_96%,var(--color-gold))] md:h-28 md:w-full md:max-w-[260px]'
                : 'root-panel relative box-border h-[4.5rem] w-[min(210px,calc(50vw-14px))] md:h-28 md:w-full md:max-w-[260px]'
            }
            style={{
              borderColor: isActive ? '#ffe08a' : colorToCss(color),
            }}
          >
            <button
              type="button"
              className="m-0 flex size-full cursor-pointer flex-row items-center gap-3 border-0 bg-transparent px-2.5 py-2 text-left md:px-3 md:py-3"
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
              <span className="font-body text-[15px] leading-[1.2] whitespace-pre-line text-ink md:text-[20px]">
                {`${player.faction}\n${String(player.vp)} VP`}
              </span>
            </button>
            <div className="absolute right-2.5 bottom-2.5 flex flex-row gap-1">
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
