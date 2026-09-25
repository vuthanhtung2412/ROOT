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
      <div className="relative z-[1] flex max-w-[min(90vw,640px)] flex-col items-center gap-[18px] border-2 border-ink bg-[color-mix(in_srgb,var(--color-parchment)_82%,transparent)] px-8 py-7 [background-blend-mode:multiply] [background-image:var(--root-paper-grain)] shadow-[inset_0_0_0_1px_var(--color-parchment-shadow),0_0_0_6px_color-mix(in_srgb,var(--color-ink)_18%,transparent),4px_6px_0_color-mix(in_srgb,var(--color-ink)_28%,transparent)]">
        {bannerPath !== null ? (
          <img
            className="block h-auto w-[min(42vw,420px)] select-none drop-shadow-[0_2px_0_color-mix(in_srgb,var(--color-ink)_25%,transparent)]"
            src={bannerPath}
            alt="ROOT"
            draggable={false}
          />
        ) : (
          <h1 className="m-0 font-display text-[56px] tracking-[0.04em] text-ink">
            ROOT
          </h1>
        )}
        <button
          type="button"
          className="root-button root-button--accent min-w-[180px] px-[22px] py-2.5 font-display text-2xl tracking-[0.02em]"
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
            className="root-button root-button--quiet min-w-[180px] px-[22px] py-2.5 font-display text-2xl tracking-[0.02em]"
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
            className="m-0 max-w-[70vw] border border-ink-soft bg-[color-mix(in_srgb,var(--color-parchment)_70%,transparent)] px-3 py-1.5 text-center font-body text-[15px] text-ink-soft italic"
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
