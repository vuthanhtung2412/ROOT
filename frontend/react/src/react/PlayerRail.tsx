import { useSyncExternalStore, type JSX } from 'react'
import {
  GAME_ASSET_KEYS,
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
    <div className="fixed top-14 left-3 z-[100] flex w-[178px] flex-col gap-2 portrait:top-16 portrait:right-2 portrait:left-2 portrait:w-auto portrait:flex-row portrait:flex-wrap portrait:justify-center portrait:gap-1.5">
      {rail.state.players.map((player) => {
        const isActive = player.seat === rail.activeSeat
        const color = factionColorForSeat(player.seat, rail.state.factions)
        const iconKey =
          player.faction === 'eyrie'
            ? GAME_ASSET_KEYS.factionEyrie
            : GAME_ASSET_KEYS.factionMarquise
        const iconPath = imagePathForAssetKey(iconKey)
        return (
          <div
            key={player.seat}
            className={
              isActive
                ? 'root-panel relative box-border h-16 portrait:h-14 portrait:w-[min(168px,calc(50vw-14px))] shadow-[inset_0_0_0_1px_var(--color-parchment-shadow),0_0_0_2px_color-mix(in_srgb,var(--color-gold)_70%,var(--color-ink)),2px_2px_0_color-mix(in_srgb,var(--color-ink)_30%,transparent)] bg-[color-mix(in_srgb,var(--color-parchment)_96%,var(--color-gold))]'
                : 'root-panel relative box-border h-16 portrait:h-14 portrait:w-[min(168px,calc(50vw-14px))]'
            }
            style={{
              borderColor: isActive ? '#ffe08a' : colorToCss(color),
            }}
          >
            <button
              type="button"
              className="m-0 flex size-full cursor-pointer flex-row items-start gap-2 border-0 bg-transparent px-2 py-2.5 text-left portrait:px-1.5 portrait:py-2"
              onClick={() => {
                callbacks.onSeatClick(player.seat)
              }}
            >
              {iconPath !== null ? (
                <img
                  className="size-10 shrink-0 object-contain drop-shadow-[1px_1px_0_color-mix(in_srgb,var(--color-ink)_25%,transparent)] portrait:size-8"
                  src={iconPath}
                  alt={player.faction}
                  draggable={false}
                />
              ) : (
                <div className="size-10 shrink-0 bg-ink-soft portrait:size-8" />
              )}
              <span className="font-body text-[13px] leading-[1.3] whitespace-pre-line text-ink portrait:text-[11px]">
                {`${player.faction}\n${String(player.vp)} VP`}
              </span>
            </button>
            <button
              type="button"
              className="root-button root-button--quiet absolute right-2 bottom-2 px-1.5 py-0.5 font-mono text-[11px]"
              onClick={() => {
                callbacks.onCraftedCardsClick(player.seat)
              }}
            >
              cards
            </button>
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
