import { useState, useSyncExternalStore, type JSX } from 'react'
import {
  GAME_ASSET_KEYS,
  imagePathForAssetKey,
} from '#assets/gameAssets.ts'
import {
  getHudSnapshot,
  getMenuCallbacks,
  patchHud,
  subscribeHud,
  type MenuHudState,
  type MenuLobbyHudState,
  type MenuLobbySeat,
} from '#game/hudStore.ts'
import {
  assignFactionAtSeat,
  defaultFactionsForPlayerCount,
  factionDisplayName,
  isMenuFactionId,
  MENU_FACTION_IDS,
  MENU_PLAYER_COUNTS,
  validatePartyFactions,
  type MenuFactionId,
  type MenuPlayerCount,
} from '#game/menuPartySetup.ts'

/** Single-screen "Start game" and QA shortcuts only exist in dev builds. */
const IS_DEVELOPMENT_BUILD: boolean = import.meta.env.DEV === true

const DEFAULT_MENU: MenuHudState = {
  statusText: '',
  statusColor: '#c44',
  playPending: false,
  showQaContinue: IS_DEVELOPMENT_BUILD,
  lobby: null,
}

function lobbySeatStatus(seat: MenuLobbySeat): string {
  if (seat.isLocalPlayer) return 'you'
  return seat.occupied ? 'joined' : 'waiting…'
}

/** Online lobby: who sits where, and the host's Start button. */
function OnlineLobbyPanel(props: {
  lobby: MenuLobbyHudState
  playPending: boolean
  onStart: () => void
}): JSX.Element {
  return (
    <section className="m-0 flex w-full flex-col gap-2" aria-label="Online lobby">
      <h2 className="m-0 font-display text-lg tracking-[0.02em] text-ink">
        Online lobby
      </h2>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {props.lobby.seats.map((seat, seatIndex) => (
          <li
            key={`lobby-seat-${String(seatIndex)}`}
            className="flex flex-row items-center justify-between gap-3 border border-ink-soft bg-[color-mix(in_srgb,var(--color-parchment)_55%,transparent)] px-3 py-2 font-body text-base text-ink"
          >
            <span>
              Seat {seatIndex + 1} · {seat.faction}
            </span>
            <span className="text-sm text-ink-soft italic">
              {lobbySeatStatus(seat)}
            </span>
          </li>
        ))}
      </ul>
      {props.lobby.isHost ? (
        <button
          type="button"
          className="root-button root-button--accent min-w-[200px] self-center px-[22px] py-2.5 font-display text-2xl tracking-[0.02em]"
          disabled={props.playPending || !props.lobby.canStart}
          onClick={props.onStart}
        >
          Start online game
        </button>
      ) : (
        <p className="m-0 text-center font-body text-[15px] text-ink-soft italic">
          Waiting for the host to start…
        </p>
      )}
    </section>
  )
}

export function MenuOverlay(): JSX.Element | null {
  const shell = useSyncExternalStore(
    subscribeHud,
    () => getHudSnapshot().shell,
    () => getHudSnapshot().shell,
  )
  const menu = useSyncExternalStore(
    subscribeHud,
    () => getHudSnapshot().menu,
    () => getHudSnapshot().menu,
  )
  const [playerCount, setPlayerCount] = useState<MenuPlayerCount>(2)
  const [seatFactions, setSeatFactions] = useState<MenuFactionId[]>(() =>
    defaultFactionsForPlayerCount(2),
  )

  if (shell !== 'menu' || menu === null) {
    return null
  }
  const callbacks = getMenuCallbacks()
  const wallpaperPath = imagePathForAssetKey(GAME_ASSET_KEYS.menuWallpaper)
  const bannerPath = imagePathForAssetKey(GAME_ASSET_KEYS.rootBanner)
  const validation = validatePartyFactions(seatFactions)

  return (
    <div className="fixed inset-0 z-[450] flex items-center justify-center overflow-hidden bg-forest-deep">
      {wallpaperPath !== null ? (
        <img
          className="pointer-events-none absolute inset-0 size-full object-cover select-none contrast-[1.04] saturate-[0.92]"
          src={wallpaperPath}
          alt=""
          draggable={false}
        />
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,color-mix(in_srgb,var(--color-moss)_55%,transparent),transparent_60%),var(--color-forest-deep)]" />
      )}
      <div className="relative z-[1] flex max-w-[min(92vw,560px)] flex-col items-center gap-4 border-2 border-ink bg-[color-mix(in_srgb,var(--color-parchment)_82%,transparent)] px-7 py-6 [background-blend-mode:multiply] [background-image:var(--root-paper-grain)] shadow-[inset_0_0_0_1px_var(--color-parchment-shadow),0_0_0_6px_color-mix(in_srgb,var(--color-ink)_18%,transparent),4px_6px_0_color-mix(in_srgb,var(--color-ink)_28%,transparent)]">
        {bannerPath !== null ? (
          <img
            className="block h-auto w-[min(42vw,380px)] select-none drop-shadow-[0_2px_0_color-mix(in_srgb,var(--color-ink)_25%,transparent)]"
            src={bannerPath}
            alt="ROOT"
            draggable={false}
          />
        ) : (
          <h1 className="m-0 font-display text-[56px] tracking-[0.04em] text-ink">
            ROOT
          </h1>
        )}

        {menu.lobby !== null ? (
          <OnlineLobbyPanel
            lobby={menu.lobby}
            playPending={menu.playPending}
            onStart={() => {
              callbacks.onStartOnline()
            }}
          />
        ) : (
          <>
        <fieldset
          className="m-0 flex w-full flex-col gap-2 border-0 p-0"
          disabled={menu.playPending}
        >
          <legend className="mb-1 font-display text-lg tracking-[0.02em] text-ink">
            Players
          </legend>
          <div className="flex flex-row flex-wrap gap-2">
            {MENU_PLAYER_COUNTS.map((count) => {
              const selected = count === playerCount
              return (
                <button
                  key={count}
                  type="button"
                  className={
                    selected
                      ? 'root-button root-button--accent min-w-[4.5rem] px-3 py-1.5 font-display text-xl'
                      : 'root-button root-button--quiet min-w-[4.5rem] px-3 py-1.5 font-display text-xl'
                  }
                  aria-pressed={selected}
                  onClick={() => {
                    setPlayerCount(count)
                    setSeatFactions(defaultFactionsForPlayerCount(count))
                  }}
                >
                  {count}
                </button>
              )
            })}
          </div>
        </fieldset>

        <fieldset
          className="m-0 flex w-full flex-col gap-2 border-0 p-0"
          disabled={menu.playPending}
        >
          <legend className="mb-1 font-display text-lg tracking-[0.02em] text-ink">
            Factions
          </legend>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {seatFactions.map((factionId, seatIndex) => (
              <li
                key={`seat-${String(seatIndex)}`}
                className="flex flex-row items-center gap-3 border border-ink-soft bg-[color-mix(in_srgb,var(--color-parchment)_55%,transparent)] px-3 py-2"
              >
                <span className="min-w-[4.5rem] font-body text-sm text-ink-soft">
                  Seat {seatIndex + 1}
                </span>
                <label className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="sr-only">
                    Faction for seat {seatIndex + 1}
                  </span>
                  <select
                    className="w-full border-2 border-ink bg-parchment px-2 py-1.5 font-body text-base text-ink"
                    value={factionId}
                    onChange={(event) => {
                      const nextValue = event.target.value
                      if (!isMenuFactionId(nextValue)) {
                        return
                      }
                      setSeatFactions(
                        assignFactionAtSeat(
                          seatFactions,
                          seatIndex,
                          nextValue,
                        ),
                      )
                    }}
                  >
                    {MENU_FACTION_IDS.map((optionId) => (
                      <option key={optionId} value={optionId}>
                        {factionDisplayName(optionId)}
                      </option>
                    ))}
                  </select>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>

        {IS_DEVELOPMENT_BUILD ? (
          <button
            type="button"
            className="root-button root-button--accent min-w-[200px] px-[22px] py-2.5 font-display text-2xl tracking-[0.02em]"
            disabled={menu.playPending || !validation.ok}
            onClick={() => {
              if (!validation.ok) {
                return
              }
              callbacks.onStartParty(validation.factions)
            }}
          >
            Start game
          </button>
        ) : null}
        <div className="flex flex-row flex-wrap justify-center gap-2">
          <button
            type="button"
            className="root-button root-button--quiet px-4 py-2 font-display text-lg tracking-[0.02em]"
            disabled={menu.playPending || !validation.ok}
            title="One browser per player: you take seat 1, others join"
            onClick={() => {
              if (!validation.ok) {
                return
              }
              callbacks.onHostOnline(validation.factions)
            }}
          >
            Host online game
          </button>
          <button
            type="button"
            className="root-button root-button--quiet px-4 py-2 font-display text-lg tracking-[0.02em]"
            disabled={menu.playPending}
            title="Take the next free seat of the host's lobby"
            onClick={() => {
              callbacks.onJoinOnline()
            }}
          >
            Join online game
          </button>
        </div>
        {menu.showQaContinue ? (
          <button
            type="button"
            className="root-button root-button--quiet min-w-[200px] px-[22px] py-2.5 font-display text-xl tracking-[0.02em]"
            disabled={menu.playPending}
            onClick={() => {
              callbacks.onQaContinue()
            }}
          >
            QA: Continue loaded game
          </button>
        ) : null}
          </>
        )}
        {menu.statusText.length > 0 ? (
          <p
            className="m-0 max-w-[70vw] border border-ink-soft bg-[color-mix(in_srgb,var(--color-parchment)_70%,transparent)] px-3 py-1.5 text-center font-body text-[15px] text-ink-soft italic"
            style={{ color: menu.statusColor }}
            role="status"
          >
            {menu.statusText}
          </p>
        ) : null}
        {!validation.ok ? (
          <p
            className="m-0 max-w-[70vw] text-center font-body text-[14px] text-[#8a3030]"
            role="status"
          >
            {validation.reason}
          </p>
        ) : null}
      </div>
    </div>
  )
}

export function showMenuShell(showQaContinue: boolean): void {
  patchHud({
    shell: 'menu',
    bootLoading: null,
    menu: {
      ...DEFAULT_MENU,
      showQaContinue,
    },
  })
}

export function syncMenuStatus(message: string, color: string): void {
  const current = getHudSnapshot().menu
  if (current === null) {
    return
  }
  if (current.statusText === message && current.statusColor === color) {
    return
  }
  patchHud({
    menu: {
      ...current,
      statusText: message,
      statusColor: color,
    },
  })
}

/** Show (or with null, leave) the online lobby panel in the menu. */
export function syncMenuLobby(lobby: MenuLobbyHudState | null): void {
  const current = getHudSnapshot().menu
  if (current === null) {
    return
  }
  patchHud({
    menu: {
      ...current,
      lobby,
    },
  })
}

export function syncMenuPlayPending(playPending: boolean): void {
  const current = getHudSnapshot().menu
  if (current === null || current.playPending === playPending) {
    return
  }
  patchHud({
    menu: {
      ...current,
      playPending,
    },
  })
}

export function hideMenuShell(): void {
  patchHud({
    menu: null,
  })
}
