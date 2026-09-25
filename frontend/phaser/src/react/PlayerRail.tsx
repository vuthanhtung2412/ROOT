import { useSyncExternalStore, type JSX } from 'react'
import {
  GAME_ASSET_KEYS,
  imagePathForAssetKey,
} from '#assets/gameAssets.ts'
import {
  getHudCallbacks,
  getHudSnapshot,
  patchHud,
  subscribeHud,
} from '#game/hudStore.ts'
import type { GameState } from '#api/client.ts'
import { factionColorForSeat } from '#game/theme.ts'
import '#react/PlayerRail.css'

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
    <div className="player-rail">
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
                ? 'player-rail__row player-rail__row--active'
                : 'player-rail__row'
            }
            style={{
              borderColor: isActive ? '#ffe08a' : colorToCss(color),
            }}
          >
            <button
              type="button"
              className="player-rail__seat"
              onClick={() => {
                callbacks.onSeatClick(player.seat)
              }}
            >
              {iconPath !== null ? (
                <img
                  className="player-rail__icon"
                  src={iconPath}
                  alt={player.faction}
                  draggable={false}
                />
              ) : (
                <div className="player-rail__icon player-rail__icon--fallback" />
              )}
              <span className="player-rail__label">
                {`${player.faction}\n${String(player.vp)} VP`}
              </span>
            </button>
            <button
              type="button"
              className="player-rail__cards"
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
