import type { CSSProperties, JSX } from 'react'
import { LuBot, LuCog } from 'react-icons/lu'
import { factionPortraitPath } from '#assets/factionPortraits.ts'
import { modelDisplayName } from '#game/aiPlayerStore.ts'
import type { MenuLobbySeat } from '#game/hudStore.ts'
import { factionDisplayName, isMenuFactionId } from '#game/menuPartySetup.ts'
import { factionColorCss } from '#game/theme.ts'
import { SeatNumberMedallion } from '#react/SeatNumberMedallion.tsx'
import { SuitIcon } from '#react/SuitIcon.tsx'

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
const SEAT_TILE_SELECTED_CLASS_NAME = 'scale-105 shadow-gold-ring-wide'
const SEAT_TILE_BUTTON_CLASS_NAME =
  'm-0 box-border flex size-full cursor-root-pointer flex-col items-center justify-center gap-1.5 border-0 bg-transparent p-0 font-display text-[17px] text-ink md:text-xl'
const SEAT_PORTRAIT_CLASS_NAME = 'block size-full object-cover select-none'
/** Beside the seat number: an AI plays this seat. */
const SEAT_AI_MARK_CLASS_NAME =
  'menu-seat-ai root-paper root-medallion absolute -top-2.5 left-6 flex size-7 items-center justify-center text-base text-ink [--root-paper-color:var(--color-parchment-deep)] md:-top-3 md:left-8 md:size-9 md:text-xl'
/** Bare hook class name of the host's expel action (QA scripts select on it). */
const SEAT_EXPEL_HOOK_CLASS_NAME = 'menu-seat-expel'
/** Name strip tucked under the tile. */
const SEAT_LABEL_CLASS_NAME =
  'root-paper root-paper-fine relative z-1 -mt-2 box-border min-w-32 px-3 py-1 text-center md:min-w-42 md:px-4.5 md:py-1.5'
const SEAT_LABEL_TITLE_CLASS_NAME =
  'block font-display text-[17px] leading-tight text-ink md:text-[21px]'
const SEAT_LABEL_NOTE_CLASS_NAME =
  'block font-body text-[13px] text-ink-soft italic md:text-sm'
const LOCAL_PAPER_CLASS_NAME = '[--root-paper-color:var(--color-gold-light)]'
const TAKEN_PAPER_CLASS_NAME = '[--root-paper-color:var(--color-parchment)]'
const OPEN_PAPER_CLASS_NAME = '[--root-paper-color:var(--color-parchment-deep)]'
const OPEN_TILE_PAPER_CLASS_NAME = '[--root-paper-color:var(--color-cream-deep)]'
const SEAT_COLUMN_CLASS_NAME = 'menu-seat flex list-none flex-col items-center'
/** Hook class name of a co-op placeholder slot. */
const EMPTY_SLOT_CLASS_NAME = 'menu-seat-empty flex list-none flex-col items-center'
/**
 * The empty slot paper: the open-seat cream, a shade darker so it reads as unused.
 * A `var()` token, so it sorts after the tile's `currentColor` paper and wins.
 */
const EMPTY_SLOT_TILE_PAPER_CLASS_NAME = '[--root-paper-color:var(--color-cream-shadow)]'
/** The empty slot is a stitched slot, pale thread on the dark paper. */
const EMPTY_SLOT_STITCH_CLASS_NAME =
  'absolute inset-2.5 rounded-sm border-2 border-dashed border-parchment/45'
/** Woodland empty slots show the suits in turn, as pale silhouettes. */
const EMPTY_SLOT_SUITS: readonly string[] = ['fox', 'rabbit', 'mouse', 'bird']
/** Suit art greyed and lifted to white-grey; the ink lines and eyes stay dark. */
const EMPTY_SLOT_SUIT_CLASS_NAME =
  'size-16 object-contain grayscale select-none md:size-24'
const EMPTY_SLOT_SUIT_TONE_CLASS_NAME = 'brightness-350 opacity-45'
/**
 * The bird draws its claws in white: keep it a grey so they still show on the fill,
 * less faded, and traced in ink like the other suits.
 */
const BIRD_SUIT = 'bird'
const EMPTY_SLOT_BIRD_TONE_CLASS_NAME =
  'brightness-90 opacity-75 drop-shadow-[1px_0_0_var(--color-ink-deep),-1px_0_0_var(--color-ink-deep),0_1px_0_var(--color-ink-deep),0_-1px_0_var(--color-ink-deep)]'
/** Clockwork empty slots show a pale cog instead of a suit. */
const EMPTY_SLOT_COG_CLASS_NAME = 'text-6xl text-parchment opacity-40 md:text-8xl'
/** Gold dots, ink-ringed, tack the stitched slot to the table at each corner. */
const EMPTY_SLOT_PIN_CLASS_NAME =
  'absolute size-2.5 rounded-full bg-gold-light ring-2 ring-ink-deep/70 md:size-3'
const EMPTY_SLOT_PIN_CORNER_CLASS_NAMES: readonly string[] = [
  'top-1.5 left-1.5',
  'top-1.5 right-1.5',
  'bottom-1.5 left-1.5',
  'bottom-1.5 right-1.5',
]

/** The co-op side a placeholder slot pads. */
export type LobbySide = 'human' | 'bot'

function factionName(factionId: string): string {
  return isMenuFactionId(factionId) ? factionDisplayName(factionId) : factionId
}

function tiltClassName(seatIndex: number): string {
  return SEAT_TILT_CLASS_NAMES[seatIndex % SEAT_TILT_CLASS_NAMES.length] ?? ''
}

/** Faction colour softened toward parchment: the ground behind a head. */
export function factionTintCss(factionId: string): string {
  return `color-mix(in srgb, ${factionColorCss(factionId)} ${String(PORTRAIT_TINT_PERCENT)}%, var(--color-parchment))`
}

function tintStyle(factionId: string): CSSProperties {
  return { color: factionTintCss(factionId) }
}

function seatStatus(seat: MenuLobbySeat, seatIndex: number): string {
  if (seat.aiModel !== null) return `AI · ${modelDisplayName(seat.aiModel)}`
  if (!seat.occupied) return 'waiting…'
  const isHost: boolean = seatIndex === HOST_SEAT_INDEX
  if (seat.isLocalPlayer) return isHost ? 'you · host' : 'you'
  return isHost ? 'host' : 'joined'
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
        {seat.aiModel !== null ? (
          <span className={SEAT_AI_MARK_CLASS_NAME} role="img" aria-label="AI player">
            <LuBot aria-hidden="true" />
          </span>
        ) : null}
        <SeatNumberMedallion
          seatNumber={props.seatIndex + 1}
          isLocal={seat.isLocalPlayer}
          onRemove={props.onExpel}
          removeLabel={`Expel seat ${String(props.seatIndex + 1)}, ${name}`}
          hookClassName={SEAT_EXPEL_HOOK_CLASS_NAME}
        />
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

/** Co-op: an inert slot that keeps each side a full 2x2 grid. */
export function LobbyEmptySeatTile(props: { slotIndex: number; side: LobbySide }): JSX.Element {
  const suit: string = EMPTY_SLOT_SUITS[props.slotIndex % EMPTY_SLOT_SUITS.length] ?? ''
  const suitToneClassName: string =
    suit === BIRD_SUIT ? EMPTY_SLOT_BIRD_TONE_CLASS_NAME : EMPTY_SLOT_SUIT_TONE_CLASS_NAME
  return (
    <li className={EMPTY_SLOT_CLASS_NAME} aria-hidden="true">
      <div
        className={`${SEAT_TILE_CLASS_NAME} ${EMPTY_SLOT_TILE_PAPER_CLASS_NAME} ${tiltClassName(props.slotIndex)}`}
      >
        <span className={EMPTY_SLOT_STITCH_CLASS_NAME} />
        {EMPTY_SLOT_PIN_CORNER_CLASS_NAMES.map(
          (cornerClassName: string): JSX.Element => (
            <span key={cornerClassName} className={`${EMPTY_SLOT_PIN_CLASS_NAME} ${cornerClassName}`} />
          ),
        )}
        {props.side === 'bot' ? (
          <LuCog className={EMPTY_SLOT_COG_CLASS_NAME} />
        ) : (
          <SuitIcon
            suit={suit}
            className={`${EMPTY_SLOT_SUIT_CLASS_NAME} ${suitToneClassName}`}
            isOutlined={false}
          />
        )}
      </div>
      <div className={`${SEAT_LABEL_CLASS_NAME} ${OPEN_PAPER_CLASS_NAME}`}>
        <span className={SEAT_LABEL_TITLE_CLASS_NAME}>Empty</span>
        <span className={SEAT_LABEL_NOTE_CLASS_NAME}>—</span>
      </div>
    </li>
  )
}

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
        <SeatNumberMedallion seatNumber={props.seatIndex + 1} isLocal={isLocal} onRemove={null} />
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
