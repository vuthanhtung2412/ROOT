import { useSyncExternalStore, type JSX } from 'react'
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
} from '#game/hudStore.ts'
import '#react/MenuOverlay.css'

const DEFAULT_MENU: MenuHudState = {
  statusText: '',
  statusColor: '#c44',
  playPending: false,
  showQaContinue: import.meta.env.DEV === true,
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

  return (
    <div className="menu-overlay">
      {wallpaperPath !== null ? (
        <img
          className="menu-overlay__wallpaper"
          src={wallpaperPath}
          alt=""
          draggable={false}
        />
      ) : (
        <div className="menu-overlay__wallpaper menu-overlay__wallpaper--fallback" />
      )}
      <div className="menu-overlay__stack">
        {bannerPath !== null ? (
          <img
            className="menu-overlay__banner"
            src={bannerPath}
            alt="ROOT"
            draggable={false}
          />
        ) : (
          <h1 className="menu-overlay__banner-fallback">ROOT</h1>
        )}
        <button
          type="button"
          className="menu-overlay__button menu-overlay__button--play"
          disabled={menu.playPending}
          onClick={() => {
            callbacks.onPlay()
          }}
        >
          Play
        </button>
        {menu.showQaContinue ? (
          <button
            type="button"
            className="menu-overlay__button menu-overlay__button--qa"
            disabled={menu.playPending}
            onClick={() => {
              callbacks.onQaContinue()
            }}
          >
            QA: Continue loaded game
          </button>
        ) : null}
        {menu.statusText.length > 0 ? (
          <p
            className="menu-overlay__status"
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
