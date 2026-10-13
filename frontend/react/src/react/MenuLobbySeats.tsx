import type { CSSProperties, JSX } from 'react'
import { LuBot, LuX } from 'react-icons/lu'
import { factionPortraitPath } from '#assets/factionPortraits.ts'
import { modelDisplayName } from '#game/aiPlayerStore.ts'
import type { MenuLobbySeat } from '#game/hudStore.ts'
import { factionDisplayName, isMenuFactionId } from '#game/menuPartySetup.ts'
import { factionColorCss } from '#game/theme.ts'

/** The lobby creator joins first, so the host always holds seat 0. */
const HOST_SEAT_INDEX = 0
/** Faction colour softened toward parchment so the head art stays readable. */
const PORTRAIT_TINT_PERCENT = 55
/** Each seat tile sits a little askew, like a piece dropped on the table. */
const SEAT_TILT_CLASS_NAMES: readonly string[] = [
  '-rotate-2',
  'rotate-1',
  '-rotate-1',
  'rotate-2',
]
/**
 * One seat = one portrait tile, as on the player rail: faction tint (the paper
 * takes the text colour), head art, medallions pinned on the corners.
 */
const SEAT_TILE_CLASS_NAME =
  'root-paper relative box-border flex size-32 items-center justify-center p-1.5 [--root-paper-color:currentColor] md:size-50 md:p-2'
/** The seat the faction dock is acting for. */
const SEAT_TILE_SELECTED_CLASS_NAME = 'scale-105 shadow-gold-ring'
const SEAT_TILE_BUTTON_CLASS_NAME =
  'm-0 box-border flex size-full cursor-root-pointer flex-col items-center justify-center gap-1.5 border-0 bg-transparent p-0 font-display text-[17px] text-ink md:text-xl'
const SEAT_PORTRAIT_CLASS_NAME = 'block size-full object-cover select-none'
/** Top left: seat number. Gold = this browser's seat. */
const SEAT_NUMBER_CLASS_NAME =
  'root-paper root-medallion absolute -top-3 -left-3 flex size-8 items-center justify-center font-mono text-lg font-bold text-ink md:-top-4 md:-left-4 md:size-11 md:text-[22px]'
const SEAT_NUMBER_LOCAL_PAPER_CLASS_NAME = '[--root-paper-color:var(--color-gold)]'
const SEAT_NUMBER_PAPER_CLASS_NAME =
  '[--root-paper-color:var(--color-parchment-deep)]'
/** Beside the seat number: an AI plays this seat. */
const SEAT_AI_MARK_CLASS_NAME =
  'menu-seat-ai root-paper root-medallion absolute -top-2.5 left-6 flex size-7 items-center justify-center text-base text-ink [--root-paper-color:var(--color-parchment-deep)] md:-top-3 md:left-8 md:size-9 md:text-xl'
/** Top right, host only: expel the player of this seat. */
const SEAT_EXPEL_BUTTON_CLASS_NAME =
  'menu-seat-expel root-paper root-medallion root-paper-press absolute -top-4 -right-4 m-0 flex size-11 items-center justify-center p-0 text-xl text-paper-bright [--root-paper-color:var(--color-rust)]'
/** Name strip tucked under the tile. */
const SEAT_LABEL_CLASS_NAME =
  'root-paper root-paper-fine relative z-1 -mt-2 box-border min-w-32 px-3 py-1 text-center md:min-w-42 md:px-4.5 md:py-1.5'
const SEAT_LABEL_TITLE_CLASS_NAME =
  'block font-display text-[17px] leading-tight text-ink md:text-[21px]'
const SEAT_LABEL_NOTE_CLASS_NAME =
  'block font-body text-[13px] text-ink-soft italic md:text-sm'
const LOCAL_PAPER_CLASS_NAME = '[--root-paper-color:var(--color-paper-bright)]'
const TAKEN_PAPER_CLASS_NAME = '[--root-paper-color:var(--color-parchment)]'
const OPEN_PAPER_CLASS_NAME = '[--root-paper-color:var(--color-parchment-deep)]'
const OPEN_TILE_PAPER_CLASS_NAME = '[--root-paper-color:var(--color-cream-deep)]'
const SEAT_COLUMN_CLASS_NAME = 'menu-seat flex list-none flex-col items-center'

function factionName(factionId: string): string {
  return isMenuFactionId(factionId) ? factionDisplayName(factionId) : factionId
}

function tiltClassName(seatIndex: number): string {
  return SEAT_TILT_CLASS_NAMES[seatIndex % SEAT_TILT_CLASS_NAMES.length] ?? ''
}

function tintStyle(factionId: string): CSSProperties {
  return {
    color: `color-mix(in srgb, ${factionColorCss(factionId)} ${String(PORTRAIT_TINT_PERCENT)}%, var(--color-parchment))`,
  }
}

function seatStatus(seat: MenuLobbySeat, seatIndex: number): string {
  if (seat.aiModel !== null) return `AI · ${modelDisplayName(seat.aiModel)}`
  if (!seat.occupied) return 'waiting…'
  const isHost: boolean = seatIndex === HOST_SEAT_INDEX
  if (seat.isLocalPlayer) return isHost ? 'you · host' : 'you'
  return isHost ? 'host' : 'joined'
}

function SeatNumber(props: { seatIndex: number; isLocal: boolean }): JSX.Element {
  return (
    <span
      className={`${SEAT_NUMBER_CLASS_NAME} ${
        props.isLocal
          ? SEAT_NUMBER_LOCAL_PAPER_CLASS_NAME
          : SEAT_NUMBER_PAPER_CLASS_NAME
      }`}
    >
      {props.seatIndex + 1}
    </span>
  )
}

/** A seat with its faction decided: a player holds it, or (preset lobby) will. */
export function LobbySeatTile(props: {
  seat: MenuLobbySeat
  seatIndex: number
  isSelected: boolean
  /** Non-null on this browser's own seat in an open lobby: opens the dock for it. */
  onSelect: (() => void) | null
  /** Non-null when the host may expel the player of this seat. */
  onExpel: (() => void) | null
}): JSX.Element {
  const seat: MenuLobbySeat = props.seat
  const name: string = factionName(seat.faction)
  const portraitPath: string | null = factionPortraitPath(seat.faction)
  const portrait: JSX.Element | null =
    portraitPath !== null ? (
      <img
        className={`${SEAT_PORTRAIT_CLASS_NAME} ${seat.occupied ? '' : 'opacity-35'}`}
        src={portraitPath}
        alt=""
        draggable={false}
      />
    ) : null
  return (
    <li className={SEAT_COLUMN_CLASS_NAME} data-lobby-seat={props.seatIndex}>
      <div
        className={`${SEAT_TILE_CLASS_NAME} ${tiltClassName(props.seatIndex)} ${
          props.isSelected ? SEAT_TILE_SELECTED_CLASS_NAME : ''
        }`}
        style={tintStyle(seat.faction)}
      >
        {props.onSelect !== null ? (
          <button
            type="button"
            className={SEAT_TILE_BUTTON_CLASS_NAME}
            aria-pressed={props.isSelected}
            aria-label={`Seat ${String(props.seatIndex + 1)}, you, ${name}. Change faction`}
            onClick={props.onSelect}
          >
            {portrait}
          </button>
        ) : (
          portrait
        )}
        <SeatNumber seatIndex={props.seatIndex} isLocal={seat.isLocalPlayer} />
        {seat.aiModel !== null ? (
          <span className={SEAT_AI_MARK_CLASS_NAME} role="img" aria-label="AI player">
            <LuBot aria-hidden="true" />
          </span>
        ) : null}
        {props.onExpel !== null ? (
          <button
            type="button"
            className={SEAT_EXPEL_BUTTON_CLASS_NAME}
            aria-label={`Expel seat ${String(props.seatIndex + 1)}, ${name}`}
            title="Expel from the lobby"
            onClick={props.onExpel}
          >
            <LuX aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <div
        className={`${SEAT_LABEL_CLASS_NAME} ${
          seat.isLocalPlayer ? LOCAL_PAPER_CLASS_NAME : TAKEN_PAPER_CLASS_NAME
        }`}
      >
        <span className={SEAT_LABEL_TITLE_CLASS_NAME}>{name}</span>
        <span className={SEAT_LABEL_NOTE_CLASS_NAME}>
          {seatStatus(seat, props.seatIndex)}
        </span>
      </div>
    </li>
  )
}

/**
 * `local`: the seat this browser takes by picking a faction.
 * `ai`: the host may seat an AI here. `waiting`: nothing to do yet.
 */
export type LobbyOpenSeatKind = 'local' | 'ai' | 'waiting'

/** Open lobby: a seat of the table nobody took yet. */
export function LobbyOpenSeatTile(props: {
  seatIndex: number
  kind: LobbyOpenSeatKind
  isSelected: boolean
  /** `ai` only: point the faction dock at this seat. */
  onSelect: () => void
}): JSX.Element {
  const isLocal: boolean = props.kind === 'local'
  return (
    <li className={SEAT_COLUMN_CLASS_NAME} data-lobby-seat={props.seatIndex}>
      <div
        className={`${SEAT_TILE_CLASS_NAME} ${OPEN_TILE_PAPER_CLASS_NAME} ${tiltClassName(props.seatIndex)} ${
          props.isSelected ? SEAT_TILE_SELECTED_CLASS_NAME : ''
        }`}
      >
        {props.kind === 'ai' ? (
          <button
            type="button"
            className={`menu-seat-add-ai ${SEAT_TILE_BUTTON_CLASS_NAME}`}
            aria-pressed={props.isSelected}
            onClick={props.onSelect}
          >
            <LuBot className="text-4xl md:text-5xl" aria-hidden="true" />
            Seat an AI
          </button>
        ) : null}
        {isLocal ? (
          <span
            className="font-display text-6xl text-ink md:text-8xl"
            aria-hidden="true"
          >
            ?
          </span>
        ) : null}
        <SeatNumber seatIndex={props.seatIndex} isLocal={isLocal} />
      </div>
      <div
        className={`${SEAT_LABEL_CLASS_NAME} ${
          isLocal ? LOCAL_PAPER_CLASS_NAME : OPEN_PAPER_CLASS_NAME
        }`}
      >
        <span className={SEAT_LABEL_TITLE_CLASS_NAME}>
          {isLocal ? 'Your seat' : 'Open seat'}
        </span>
        <span className={SEAT_LABEL_NOTE_CLASS_NAME}>
          {isLocal ? 'you · choosing…' : 'waiting…'}
        </span>
      </div>
    </li>
  )
}
