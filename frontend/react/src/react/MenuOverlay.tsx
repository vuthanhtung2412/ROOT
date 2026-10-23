import { useState, useSyncExternalStore, type JSX } from 'react'
import type { AddAiPlayerInput } from '#api/client.ts'
import { GAME_ASSET_KEYS, imagePathForAssetKey } from '#assets/gameAssets.ts'
import {
  getHudSnapshot,
  getMenuCallbacks,
  patchHud,
  subscribeHud,
  type LobbyTableChange,
  type MenuHudState,
  type MenuLobbyHudState,
} from '#game/hudStore.ts'
import type { MenuFactionId } from '#game/menuPartySetup.ts'
import { IS_BIRTHDAY_EDITION } from '#game/birthdayEdition.ts'
import type { BotSettingsByFaction } from '@root/lib/bot-settings'
import {
  BirthdayCandle,
  Confetti,
  SCREEN_CONFETTI,
  ScreenBunting,
} from '#react/BirthdayDecorations.tsx'
import { BirthdayBridgeBanner } from '#react/BirthdayBridgeBanner.tsx'
import { MenuHotseatSetup } from '#react/MenuHotseatSetup.tsx'
import { MenuJoinRoomForm } from '#react/MenuJoinRoomForm.tsx'
import { MenuSoloSetup } from '#react/MenuSoloSetup.tsx'
import { OnlineLobbyPanel } from '#react/MenuLobbyPanel.tsx'
import { PRIMARY_BUTTON_CLASS_NAME } from '#react/MenuParts.tsx'

/** Single-screen "Start game" and QA shortcuts only exist in dev builds. */
const IS_DEVELOPMENT_BUILD: boolean = import.meta.env.DEV === true

/**
 * Start screen and lobby: paper pieces laid straight on the dimmed wallpaper, no sheet.
 * `max-h-full`, not `dvh`: under the app root zoom the overlay is the real screen height.
 */
const MENU_STAGE_CLASS_NAME =
  'relative z-1 box-border flex max-h-full w-full flex-col items-center gap-5 overflow-y-auto px-5 py-8'
/** Start screen: banner top left, play modes bottom left. */
const HOME_STAGE_CLASS_NAME =
  'relative z-1 box-border flex size-full flex-col items-start gap-4 overflow-y-auto px-14 pt-10 pb-14 max-sm:px-4 max-sm:pt-7 max-sm:pb-10'
const MENU_DIM_CLASS_NAME = 'absolute inset-0 bg-ink-deep/50'
/** Start screen: dark on the left behind the buttons, clear art on the right. */
const HOME_SHADE_CLASS_NAME =
  'absolute inset-0 bg-[linear-gradient(90deg,color-mix(in_srgb,var(--color-ink-deep)_82%,transparent)_0%,color-mix(in_srgb,var(--color-ink-deep)_55%,transparent)_28%,color-mix(in_srgb,var(--color-ink-deep)_12%,transparent)_55%,transparent_75%)]'
/** Riverside art is mirrored so its dark bushes sit behind the left column. */
const WALLPAPER_CLASS_NAME =
  'pointer-events-none absolute inset-0 size-full -scale-x-100 object-cover select-none max-sm:object-[35%_center] contrast-104 saturate-92'
/** Play mode buttons share one width so the column reads as a list; warm cream stands off the parchment panel. */
const HOME_BUTTON_CLASS_NAME = 'min-w-65 [--root-paper-color:var(--color-parchment-deep)]!'
/** Birthday edition: Create game is the cake, frosting pink with a lit candle. */
const BIRTHDAY_BUTTON_CLASS_NAME = 'min-w-65 [--root-paper-color:var(--color-frosting)]!'
const PLAY_ONLINE_BUTTON_CLASS_NAME: string = IS_BIRTHDAY_EDITION
  ? BIRTHDAY_BUTTON_CLASS_NAME
  : HOME_BUTTON_CLASS_NAME
/** Banner, edition ribbon and tagline: one group, centred under the banner. */
const BANNER_GROUP_CLASS_NAME = 'mb-auto flex w-[min(80vw,420px)] flex-col items-center'
const EDITION_RIBBON_CLASS_NAME =
  'relative -mt-3.5 -rotate-2 border-3 border-ink-deep bg-berry px-5.5 py-1.5 font-display text-2xl tracking-[0.06em] text-paper-bright italic shadow-stamp-lg max-sm:text-lg'
const TAGLINE_CLASS_NAME =
  'm-0 mt-3.5 w-max max-w-[calc(100vw-2rem)] -rotate-2 border-3 border-ink-deep bg-gold-light px-4.5 py-1.5 font-body text-base text-ink italic max-sm:text-sm'
const EDITION_LABEL = 'Birthday Edition'
const TAGLINE = 'The woodland throws a party. Bring a gift for the Phuong.'
/** Status line on a paper strip, like the lobby title. */
const STATUS_CLASS_NAME =
  'root-paper root-paper-fine m-0 max-w-[70vw] px-5 py-1.5 text-center font-body text-[15px] italic'

const CREATE_GAME_LABEL = 'Create game'
const SOLO_RUN_LABEL = 'Solo run'
const CONTINUE_SOLO_RUN_LABEL = 'Continue solo run'

const DEFAULT_MENU: MenuHudState = {
  statusText: '',
  statusColor: '#c44',
  playPending: false,
  showQaContinue: IS_DEVELOPMENT_BUILD,
  soloRunSaved: false,
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
  const [isSoloRunOpen, setIsSoloRunOpen] = useState<boolean>(false)

  if (shell !== 'menu' || menu === null) {
    // Stays mounted under the game: back on the menu means the home screen.
    if (isSoloRunOpen) {
      setIsSoloRunOpen(false)
    }
    return null
  }
  const callbacks = getMenuCallbacks()
  const wallpaperPath = imagePathForAssetKey(GAME_ASSET_KEYS.menuWallpaper)
  const bannerPath = imagePathForAssetKey(GAME_ASSET_KEYS.rootBanner)
  /** Online lobby and solo run fill the stage: no banner above them. */
  const isLobbyScreen: boolean = menu.lobby !== null || isSoloRunOpen

  return (
    <div className="menu-overlay fixed inset-0 z-450 flex items-center justify-center overflow-hidden bg-forest-deep">
      {wallpaperPath !== null ? (
        <img
          className={WALLPAPER_CLASS_NAME}
          src={wallpaperPath}
          alt=""
          draggable={false}
        />
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,color-mix(in_srgb,var(--color-moss)_55%,transparent),transparent_60%),var(--color-forest-deep)]" />
      )}
      {IS_BIRTHDAY_EDITION && wallpaperPath !== null ? <BirthdayBridgeBanner /> : null}
      <div className={isLobbyScreen ? MENU_DIM_CLASS_NAME : HOME_SHADE_CLASS_NAME} />
      {IS_BIRTHDAY_EDITION ? (
        <>
          <ScreenBunting />
          <Confetti pieces={SCREEN_CONFETTI} />
        </>
      ) : null}
      <div className={isLobbyScreen ? MENU_STAGE_CLASS_NAME : HOME_STAGE_CLASS_NAME}>
        {isLobbyScreen ? null : (
          <div className={BANNER_GROUP_CLASS_NAME}>
            {bannerPath !== null ? (
              <img
                className="block h-auto w-full select-none drop-shadow-banner"
                src={bannerPath}
                alt="ROOT"
                draggable={false}
              />
            ) : (
              <h1 className="m-0 font-display text-[56px] tracking-heading text-ink">
                ROOT
              </h1>
            )}
            {IS_BIRTHDAY_EDITION ? (
              <>
                <span className={EDITION_RIBBON_CLASS_NAME}>{EDITION_LABEL}</span>
                <p className={TAGLINE_CLASS_NAME}>{TAGLINE}</p>
              </>
            ) : null}
          </div>
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
            onChangeLobbyTable={(change: LobbyTableChange): void => {
              callbacks.onChangeLobbyTable(change)
            }}
            onStart={(): void => {
              callbacks.onStartOnline()
            }}
            onLeave={(): void => {
              callbacks.onLeaveOnline()
            }}
          />
        ) : isSoloRunOpen ? (
          <MenuSoloSetup
            disabled={menu.playPending}
            onStartSolo={(factions: MenuFactionId[], botSettings: BotSettingsByFaction): void => {
              callbacks.onStartSolo(factions, botSettings)
            }}
            onBack={(): void => {
              setIsSoloRunOpen(false)
            }}
          />
        ) : (
          <>
            {/* Create opens a new online room; guests join it with its code. */}
            <button
              type="button"
              className={`menu-play-online ${PRIMARY_BUTTON_CLASS_NAME} ${PLAY_ONLINE_BUTTON_CLASS_NAME}`}
              disabled={menu.playPending}
              onClick={(): void => {
                callbacks.onPlayOnline()
              }}
            >
              {CREATE_GAME_LABEL}
              {IS_BIRTHDAY_EDITION ? <BirthdayCandle /> : null}
            </button>
            <MenuJoinRoomForm
              disabled={menu.playPending}
              onJoinRoom={(roomCode: string): void => {
                callbacks.onJoinRoom(roomCode)
              }}
            />
            {menu.soloRunSaved ? (
              <button
                type="button"
                className={`menu-continue-solo-run ${PRIMARY_BUTTON_CLASS_NAME} ${HOME_BUTTON_CLASS_NAME}`}
                disabled={menu.playPending}
                onClick={(): void => {
                  callbacks.onContinueSolo()
                }}
              >
                {CONTINUE_SOLO_RUN_LABEL}
              </button>
            ) : null}
            <button
              type="button"
              className={`menu-solo-run ${PRIMARY_BUTTON_CLASS_NAME} ${HOME_BUTTON_CLASS_NAME}`}
              disabled={menu.playPending}
              onClick={(): void => {
                setIsSoloRunOpen(true)
              }}
            >
              {SOLO_RUN_LABEL}
            </button>
            {IS_DEVELOPMENT_BUILD ? (
              <MenuHotseatSetup
                disabled={menu.playPending}
                showQaContinue={menu.showQaContinue}
                onStartParty={(factions: string[], botSettings: BotSettingsByFaction): void => {
                  callbacks.onStartParty(factions, botSettings)
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
            className={STATUS_CLASS_NAME}
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

export function showMenuShell(menu: Pick<MenuHudState, 'showQaContinue' | 'soloRunSaved'>): void {
  patchHud({
    shell: 'menu',
    bootLoading: null,
    menu: {
      ...DEFAULT_MENU,
      ...menu,
    },
  })
}

/** The saved solo run is gone (finished, or it failed to load). */
export function syncMenuSoloRunSaved(soloRunSaved: boolean): void {
  const current = getHudSnapshot().menu
  if (current === null || current.soloRunSaved === soloRunSaved) {
    return
  }
  patchHud({
    menu: {
      ...current,
      soloRunSaved,
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
