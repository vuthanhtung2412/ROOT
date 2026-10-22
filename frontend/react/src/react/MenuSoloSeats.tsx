import type { JSX } from 'react'
import { LuPlus, LuSettings2 } from 'react-icons/lu'
import type { BotFactionId } from '@root/lib/bot-factions'
import { BOT_DIFFICULTY_CARDS, type BotSettings } from '@root/lib/bot-settings'
import { factionPortraitPath } from '#assets/factionPortraits.ts'
import { IS_BIRTHDAY_EDITION } from '#game/birthdayEdition.ts'
import { factionDisplayName, type MenuFactionId } from '#game/menuPartySetup.ts'
import {
  BALLOON_GIFT_WRAP,
  Confetti,
  GiftBoxWrap,
  TILE_CONFETTI,
  TileBunting,
} from '#react/BirthdayDecorations.tsx'
import {
  factionTintCss,
  isBirthdayGuest,
  OPEN_SEAT_CONTENT_CLASS_NAME,
} from '#react/MenuLobbySeats.tsx'
import { SeatNumberMedallion } from '#react/SeatNumberMedallion.tsx'

/** Portrait tile like a lobby seat; the faction tint is the paper colour. */
const PLAYER_TILE_CLASS_NAME =
  'root-paper relative box-border flex size-28 -rotate-2 items-center justify-center p-1.5 [--root-paper-color:currentColor] md:size-44 md:p-2'
const BOT_TILE_CLASS_NAME =
  'root-paper relative box-border flex items-center justify-center p-1.5 [--root-paper-color:currentColor]'
const ADD_BOT_TILE_CLASS_NAME =
  'root-paper relative box-border flex items-center justify-center p-1.5'
/** Birthday edition: the empty bot seat is a gift box, its ＋ on a tag. */
const ADD_BOT_PAPER_CLASS_NAME: string = IS_BIRTHDAY_EDITION
  ? BALLOON_GIFT_WRAP.paperClassName
  : '[--root-paper-color:var(--color-cream-deep)]'
const ADD_BOT_ICON_CLASS_NAME: string = IS_BIRTHDAY_EDITION
  ? 'text-4xl md:text-5xl'
  : 'text-5xl md:text-6xl'
/** Solo run: bots stack in a column, smaller tiles. Co-op: as big as a lobby seat. */
export type BotTileSize = 'compact' | 'lobbySeat'
const BOT_TILE_SIZE_CLASS_NAMES: Readonly<Record<BotTileSize, string>> = {
  compact: 'size-28',
  lobbySeat: 'size-32 md:size-50 md:p-2',
}
const DEFAULT_BOT_TILE_SIZE: BotTileSize = 'compact'
const BOT_TILT_CLASS_NAMES: readonly string[] = ['rotate-1', '-rotate-1', 'rotate-2']
/** The seat the faction track is acting for. */
const TILE_SELECTED_CLASS_NAME = 'scale-105 shadow-gold-ring-wide'
const TILE_BUTTON_CLASS_NAME =
  'm-0 box-border flex size-full cursor-root-pointer flex-col items-center justify-center gap-1 border-0 bg-transparent p-0 font-display text-lg text-ink disabled:cursor-root-not-allowed'
const PORTRAIT_CLASS_NAME = 'block size-full object-cover select-none'
/** Top right medallion: settings. Top left: the seat number (✕ to remove a bot). */
const MEDALLION_CLASS_NAME =
  'root-paper root-medallion root-paper-press absolute -top-4 m-0 flex size-10 items-center justify-center p-0 text-xl md:size-11'
const SETTINGS_MEDALLION_CLASS_NAME = `menu-solo-bot-settings -right-4 text-ink ${MEDALLION_CLASS_NAME}`
const SETTINGS_PAPER_CLASS_NAME = '[--root-paper-color:var(--color-parchment-deep)]'
const SETTINGS_OPEN_PAPER_CLASS_NAME = '[--root-paper-color:var(--color-gold)]'
/** Bare hook class name of the bot remove action (QA scripts select on it). */
const REMOVE_HOOK_CLASS_NAME = 'menu-solo-bot-remove'
/** The player sits first; bots follow in table order. */
const PLAYER_SEAT_NUMBER = 1
/** Name strip tucked under the tile. */
const LABEL_CLASS_NAME =
  'root-paper root-paper-fine relative z-1 -mt-2 box-border min-w-28 px-2 py-1 text-center md:min-w-40 md:px-3'
const LABEL_TITLE_CLASS_NAME = 'block font-display text-[15px] leading-tight text-ink md:text-xl'
const LABEL_NOTE_CLASS_NAME = 'block font-body text-[13px] text-ink-soft italic md:text-sm'
const PLAYER_LABEL_PAPER_CLASS_NAME = '[--root-paper-color:var(--color-gold-light)]'
const BOT_LABEL_PAPER_CLASS_NAME = '[--root-paper-color:var(--color-parchment)]'
const OPEN_LABEL_PAPER_CLASS_NAME = '[--root-paper-color:var(--color-parchment-deep)]'
const SEAT_COLUMN_CLASS_NAME = 'relative flex list-none flex-col items-center'

function selectedClassName(isSelected: boolean): string {
  return isSelected ? TILE_SELECTED_CLASS_NAME : ''
}

function botTiltClassName(botIndex: number): string {
  return BOT_TILT_CLASS_NAMES[botIndex % BOT_TILT_CLASS_NAMES.length] ?? ''
}

function traitCountLabel(traitCount: number): string {
  if (traitCount === 0) return 'no trait'
  return traitCount === 1 ? '1 trait' : `${String(traitCount)} traits`
}

/** Bot tile note: difficulty card and how many trait cards are on. */
function botSettingsSummary(faction: BotFactionId, settings: BotSettings): string {
  const difficultyName: string = BOT_DIFFICULTY_CARDS[faction][settings.difficulty].name
  return `${difficultyName} · ${traitCountLabel(settings.traits.length)}`
}

function Portrait(props: { faction: MenuFactionId }): JSX.Element | null {
  const portraitPath: string | null = factionPortraitPath(props.faction)
  if (portraitPath === null) return null
  return <img className={PORTRAIT_CLASS_NAME} src={portraitPath} alt="" draggable={false} />
}

function SeatLabel(props: { title: string; note: string; paperClassName: string }): JSX.Element {
  return (
    <div className={`${LABEL_CLASS_NAME} ${props.paperClassName}`}>
      <span className={LABEL_TITLE_CLASS_NAME}>{props.title}</span>
      <span className={LABEL_NOTE_CLASS_NAME}>{props.note}</span>
    </div>
  )
}

/** The player's seat: selecting it points the track at the player's faction. */
export function SoloPlayerTile(props: {
  faction: MenuFactionId
  isSelected: boolean
  disabled: boolean
  onSelect: () => void
}): JSX.Element {
  const name: string = factionDisplayName(props.faction)
  return (
    <div className={`menu-solo-player ${SEAT_COLUMN_CLASS_NAME}`}>
      <div
        className={`${PLAYER_TILE_CLASS_NAME} ${selectedClassName(props.isSelected)}`}
        style={{ color: factionTintCss(props.faction) }}
      >
        <button
          type="button"
          className={TILE_BUTTON_CLASS_NAME}
          aria-pressed={props.isSelected}
          aria-label={`You, ${name}. Change faction`}
          disabled={props.disabled}
          onClick={props.onSelect}
        >
          <Portrait faction={props.faction} />
        </button>
        {isBirthdayGuest(props.faction) ? (
          <>
            <TileBunting />
            <Confetti pieces={TILE_CONFETTI} />
          </>
        ) : null}
        <SeatNumberMedallion seatNumber={PLAYER_SEAT_NUMBER} isLocal={true} onRemove={null} />
      </div>
      <SeatLabel title={name} note="you" paperClassName={PLAYER_LABEL_PAPER_CLASS_NAME} />
    </div>
  )
}

export type SoloBotTileProps = {
  faction: BotFactionId
  botIndex: number
  /** Seat number on the medallion; solo run: right after the player. */
  seatNumber?: number
  settings: BotSettings
  isSelected: boolean
  disabled: boolean
  onSelect: () => void
  /** Null when this is the last bot: one always stays. */
  onRemove: (() => void) | null
  isSettingsOpen: boolean
  onToggleSettings: () => void
  tileSize?: BotTileSize
}

/** A seated bot: ⚙ opens its difficulty and traits modal, × takes it off the table. */
export function SoloBotTile(props: SoloBotTileProps): JSX.Element {
  const name: string = factionDisplayName(props.faction)
  return (
    <li className={`menu-solo-bot ${SEAT_COLUMN_CLASS_NAME}`} data-faction={props.faction}>
      <div
        className={`${BOT_TILE_CLASS_NAME} ${BOT_TILE_SIZE_CLASS_NAMES[props.tileSize ?? DEFAULT_BOT_TILE_SIZE]} ${botTiltClassName(props.botIndex)} ${selectedClassName(props.isSelected)}`}
        style={{ color: factionTintCss(props.faction) }}
      >
        <button
          type="button"
          className={TILE_BUTTON_CLASS_NAME}
          aria-pressed={props.isSelected}
          aria-label={`${name}. Swap the bot`}
          disabled={props.disabled}
          onClick={props.onSelect}
        >
          <Portrait faction={props.faction} />
        </button>
        <button
          type="button"
          className={`${SETTINGS_MEDALLION_CLASS_NAME} ${props.isSettingsOpen ? SETTINGS_OPEN_PAPER_CLASS_NAME : SETTINGS_PAPER_CLASS_NAME}`}
          aria-label={`Difficulty and traits of ${name}`}
          aria-expanded={props.isSettingsOpen}
          title="Difficulty and traits"
          disabled={props.disabled}
          onClick={props.onToggleSettings}
        >
          <LuSettings2 aria-hidden="true" />
        </button>
        <SeatNumberMedallion
          seatNumber={props.seatNumber ?? PLAYER_SEAT_NUMBER + props.botIndex + 1}
          isLocal={false}
          onRemove={props.onRemove}
          removeLabel={`Remove ${name}`}
          hookClassName={REMOVE_HOOK_CLASS_NAME}
          disabled={props.disabled}
        />
      </div>
      <SeatLabel
        title={name}
        note={botSettingsSummary(props.faction, props.settings)}
        paperClassName={BOT_LABEL_PAPER_CLASS_NAME}
      />
    </li>
  )
}

/** ＋: an empty bot seat; selecting it points the track at the bots. */
export function SoloAddBotTile(props: {
  isSelected: boolean
  disabled: boolean
  onSelect: () => void
  tileSize?: BotTileSize
}): JSX.Element {
  return (
    <li className={SEAT_COLUMN_CLASS_NAME}>
      <div
        className={`${ADD_BOT_TILE_CLASS_NAME} ${ADD_BOT_PAPER_CLASS_NAME} ${BOT_TILE_SIZE_CLASS_NAMES[props.tileSize ?? DEFAULT_BOT_TILE_SIZE]} ${selectedClassName(props.isSelected)}`}
      >
        {IS_BIRTHDAY_EDITION ? <GiftBoxWrap wrap={BALLOON_GIFT_WRAP} /> : null}
        <button
          type="button"
          className={`menu-solo-add-bot relative z-1 ${TILE_BUTTON_CLASS_NAME}`}
          aria-pressed={props.isSelected}
          aria-label="Add a bot"
          disabled={props.disabled}
          onClick={props.onSelect}
        >
          <span className={OPEN_SEAT_CONTENT_CLASS_NAME}>
            <LuPlus className={ADD_BOT_ICON_CLASS_NAME} aria-hidden="true" />
          </span>
        </button>
      </div>
      <SeatLabel
        title="Add a bot"
        note={props.isSelected ? 'pick one below' : 'open seat'}
        paperClassName={OPEN_LABEL_PAPER_CLASS_NAME}
      />
    </li>
  )
}
