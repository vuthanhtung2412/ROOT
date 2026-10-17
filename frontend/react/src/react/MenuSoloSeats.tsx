import type { JSX } from 'react'
import { LuPlus, LuSettings2, LuX } from 'react-icons/lu'
import type { BotFactionId } from '@root/lib/bot-factions'
import { BOT_DIFFICULTY_CARDS, type BotSettings } from '@root/lib/bot-settings'
import { factionPortraitPath } from '#assets/factionPortraits.ts'
import { factionDisplayName, type MenuFactionId } from '#game/menuPartySetup.ts'
import { factionTintCss } from '#react/MenuLobbySeats.tsx'

/** Portrait tile like a lobby seat; the faction tint is the paper colour. */
const PLAYER_TILE_CLASS_NAME =
  'root-paper relative box-border flex size-28 -rotate-2 items-center justify-center p-1.5 [--root-paper-color:currentColor] md:size-44 md:p-2'
/** Bots stack in a column: smaller tiles. */
const BOT_TILE_CLASS_NAME =
  'root-paper relative box-border flex size-28 items-center justify-center p-1.5 [--root-paper-color:currentColor]'
const ADD_BOT_TILE_CLASS_NAME =
  'root-paper relative box-border flex size-28 items-center justify-center p-1.5 [--root-paper-color:var(--color-cream-deep)]'
const BOT_TILT_CLASS_NAMES: readonly string[] = ['rotate-1', '-rotate-1', 'rotate-2']
/** The seat the faction track is acting for. */
const TILE_SELECTED_CLASS_NAME = 'scale-105 shadow-gold-ring-wide'
const TILE_BUTTON_CLASS_NAME =
  'm-0 box-border flex size-full cursor-root-pointer flex-col items-center justify-center gap-1 border-0 bg-transparent p-0 font-display text-lg text-ink disabled:cursor-root-not-allowed'
const PORTRAIT_CLASS_NAME = 'block size-full object-cover select-none'
/** Corner medallions: settings top right, remove top left. */
const MEDALLION_CLASS_NAME =
  'root-paper root-medallion root-paper-press absolute -top-4 m-0 flex size-10 items-center justify-center p-0 text-xl md:size-11'
const SETTINGS_MEDALLION_CLASS_NAME = `menu-solo-bot-settings -right-4 text-ink ${MEDALLION_CLASS_NAME}`
const SETTINGS_PAPER_CLASS_NAME = '[--root-paper-color:var(--color-parchment-deep)]'
const SETTINGS_OPEN_PAPER_CLASS_NAME = '[--root-paper-color:var(--color-gold)]'
const REMOVE_MEDALLION_CLASS_NAME = `menu-solo-bot-remove -left-4 text-paper-bright [--root-paper-color:var(--color-rust)] ${MEDALLION_CLASS_NAME}`
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
      </div>
      <SeatLabel title={name} note="you" paperClassName={PLAYER_LABEL_PAPER_CLASS_NAME} />
    </div>
  )
}

export type SoloBotTileProps = {
  faction: BotFactionId
  botIndex: number
  settings: BotSettings
  isSelected: boolean
  disabled: boolean
  onSelect: () => void
  /** Null when this is the last bot: one always stays. */
  onRemove: (() => void) | null
  isSettingsOpen: boolean
  onToggleSettings: () => void
}

/** A seated bot: ⚙ opens its difficulty and traits modal, × takes it off the table. */
export function SoloBotTile(props: SoloBotTileProps): JSX.Element {
  const name: string = factionDisplayName(props.faction)
  return (
    <li className={`menu-solo-bot ${SEAT_COLUMN_CLASS_NAME}`} data-faction={props.faction}>
      <div
        className={`${BOT_TILE_CLASS_NAME} ${botTiltClassName(props.botIndex)} ${selectedClassName(props.isSelected)}`}
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
        {props.onRemove !== null ? (
          <button
            type="button"
            className={REMOVE_MEDALLION_CLASS_NAME}
            aria-label={`Remove ${name}`}
            title="Remove this bot"
            disabled={props.disabled}
            onClick={props.onRemove}
          >
            <LuX aria-hidden="true" />
          </button>
        ) : null}
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
}): JSX.Element {
  return (
    <li className={SEAT_COLUMN_CLASS_NAME}>
      <div className={`${ADD_BOT_TILE_CLASS_NAME} ${selectedClassName(props.isSelected)}`}>
        <button
          type="button"
          className={`menu-solo-add-bot ${TILE_BUTTON_CLASS_NAME}`}
          aria-pressed={props.isSelected}
          aria-label="Add a bot"
          disabled={props.disabled}
          onClick={props.onSelect}
        >
          <LuPlus className="text-5xl md:text-6xl" aria-hidden="true" />
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
