import { useSyncExternalStore, type JSX } from 'react'
import type { AddAiPlayerInput } from '#api/client.ts'
import { GAME_ASSET_KEYS, imagePathForAssetKey } from '#assets/gameAssets.ts'
import {
  getHudSnapshot,
  getMenuCallbacks,
  patchHud,
  subscribeHud,
  type MenuHudState,
  type MenuLobbyHudState,
} from '#game/hudStore.ts'
import { MenuHotseatSetup } from '#react/MenuHotseatSetup.tsx'
import { OnlineLobbyPanel } from '#react/MenuLobbyPanel.tsx'
import { PRIMARY_BUTTON_CLASS_NAME } from '#react/MenuParts.tsx'

/** Single-screen "Start game" and QA shortcuts only exist in dev builds. */
const IS_DEVELOPMENT_BUILD: boolean = import.meta.env.DEV === true

/** Start screen: banner and buttons on one parchment sheet. */
const MENU_PANEL_CLASS_NAME =
  'relative z-1 flex max-h-[96vh] max-w-[min(92vw,560px)] flex-col items-center gap-4 overflow-y-auto border-2 border-ink bg-parchment/82 px-7 py-6 paper-grain shadow-menu-panel'
/** Lobby: paper pieces laid straight on the dimmed wallpaper, no sheet. */
const LOBBY_STAGE_CLASS_NAME =
  'relative z-1 box-border flex max-h-dvh w-full flex-col items-center gap-5 overflow-y-auto px-5 py-8'
const LOBBY_DIM_CLASS_NAME = 'absolute inset-0 bg-ink-deep/50'

const CREATE_GAME_LABEL = 'Create game'
const JOIN_GAME_LABEL = 'Join game'

const DEFAULT_MENU: MenuHudState = {
  statusText: '',
  statusColor: '#c44',
  playPending: false,
  showQaContinue: IS_DEVELOPMENT_BUILD,
  lobbyOnServer: false,
  lobby: null,
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

  if (shell !== 'menu' || menu === null) {
    return null
  }
  const callbacks = getMenuCallbacks()
  const wallpaperPath = imagePathForAssetKey(GAME_ASSET_KEYS.menuWallpaper)
  const bannerPath = imagePathForAssetKey(GAME_ASSET_KEYS.rootBanner)
  const isInLobby: boolean = menu.lobby !== null

  return (
    <div className="fixed inset-0 z-450 flex items-center justify-center overflow-hidden bg-forest-deep">
      {wallpaperPath !== null ? (
        <img
          className="pointer-events-none absolute inset-0 size-full object-cover select-none contrast-104 saturate-92"
          src={wallpaperPath}
          alt=""
          draggable={false}
        />
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,color-mix(in_srgb,var(--color-moss)_55%,transparent),transparent_60%),var(--color-forest-deep)]" />
      )}
      {isInLobby ? <div className={LOBBY_DIM_CLASS_NAME} /> : null}
      <div className={isInLobby ? LOBBY_STAGE_CLASS_NAME : MENU_PANEL_CLASS_NAME}>
        {isInLobby ? null : bannerPath !== null ? (
          <img
            className="block h-auto w-[min(42vw,380px)] select-none drop-shadow-banner"
            src={bannerPath}
            alt="ROOT"
            draggable={false}
          />
        ) : (
          <h1 className="m-0 font-display text-[56px] tracking-heading text-ink">
            ROOT
          </h1>
        )}

        {menu.lobby !== null ? (
          <OnlineLobbyPanel
            lobby={menu.lobby}
            playPending={menu.playPending}
            onPickFaction={(faction: string): void => {
              callbacks.onPickFaction(faction)
            }}
            onAddAiPlayer={(input: AddAiPlayerInput): void => {
              callbacks.onAddAiPlayer(input)
            }}
            onExpelPlayer={(seat: number): void => {
              callbacks.onExpelPlayer(seat)
            }}
            onStart={(): void => {
              callbacks.onStartOnline()
            }}
            onLeave={(): void => {
              callbacks.onLeaveOnline()
            }}
          />
        ) : (
          <>
            {/* The one start button: a lobby waits → join it; else create one. */}
            <button
              type="button"
              className={`menu-play-online ${PRIMARY_BUTTON_CLASS_NAME}`}
              disabled={menu.playPending}
              onClick={(): void => {
                callbacks.onPlayOnline()
              }}
            >
              {menu.lobbyOnServer ? JOIN_GAME_LABEL : CREATE_GAME_LABEL}
            </button>
            {IS_DEVELOPMENT_BUILD ? (
              <MenuHotseatSetup
                disabled={menu.playPending}
                showQaContinue={menu.showQaContinue}
                onStartParty={(factions: string[]): void => {
                  callbacks.onStartParty(factions)
                }}
                onQaContinue={(): void => {
                  callbacks.onQaContinue()
                }}
              />
            ) : null}
          </>
        )}
        {menu.statusText.length > 0 ? (
          <p
            className="m-0 max-w-[70vw] border border-ink-soft bg-parchment/70 px-3 py-1.5 text-center font-body text-[15px] text-ink-soft italic"
            style={{ color: menu.statusColor }}
            role="status"
          >
            {menu.statusText}
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

/** A live online game is on the server: the start button reads "Join game". */
export function syncMenuLobbyOnServer(lobbyOnServer: boolean): void {
  const current = getHudSnapshot().menu
  if (current === null || current.lobbyOnServer === lobbyOnServer) {
    return
  }
  patchHud({
    menu: {
      ...current,
      lobbyOnServer,
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
