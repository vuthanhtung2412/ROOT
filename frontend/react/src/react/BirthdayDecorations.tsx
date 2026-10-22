import type { CSSProperties, JSX } from 'react'

/**
 * Birthday edition party kit: paper bunting, confetti, candles and gift wrap,
 * all inked like the rest of the paper UI.
 * Mockup: `resources/mockups/birthday-edition/` (menu, lobby, lizard-assets).
 */

const INK_COLOR = 'var(--color-ink-deep)'
const FROSTING_COLOR = 'var(--color-frosting)'
const BERRY_COLOR = 'var(--color-berry)'
const BALLOON_COLOR = 'var(--color-balloon)'
const MINT_COLOR = 'var(--color-mint)'
const FLAME_COLOR = 'var(--color-flame)'
const LIZARD_COLOR = 'var(--color-lizard)'
const PARCHMENT_COLOR = 'var(--color-parchment)'
const RUST_COLOR = 'var(--color-rust)'
const GOLD_LIGHT_COLOR = 'var(--color-gold-light)'

/** Flag colours in the order they hang on a string. */
const FLAG_COLORS: readonly string[] = [
  FROSTING_COLOR,
  LIZARD_COLOR,
  BALLOON_COLOR,
  PARCHMENT_COLOR,
  RUST_COLOR,
  MINT_COLOR,
]

const DECORATION_LAYER_CLASS_NAME = 'pointer-events-none absolute select-none'

/** Lobby title shared by the online lobby and the solo run. */
export const BIRTHDAY_TABLE_TITLE = 'The Birthday Table'
/** Guest count on a berry strip tucked under the lobby title. */
export const GUEST_COUNT_CLASS_NAME =
  'm-0 -mt-4.5 -rotate-2 border-3 border-ink-deep bg-berry px-4 py-0.5 font-body text-base text-paper-bright italic'
/** Start is the cake: frosting pink, with a `BirthdayCandle` on it. */
export const BIRTHDAY_START_LABEL = 'Light the candles'
export const BIRTHDAY_START_PAPER_CLASS_NAME = '[--root-paper-color:var(--color-frosting)]'

/** The string sags across the screen top; flags hang from it, one every `FLAG_SPACING`. */
const SCREEN_BUNTING_WIDTH = 1440
const SCREEN_BUNTING_HEIGHT = 130
const SCREEN_BUNTING_STRING_PATH = 'M-10 18 Q 360 92 720 30 T 1450 24'
const SCREEN_BUNTING_FLAG_LEFTS: readonly number[] = [
  40, 120, 202, 286, 372, 458, 544, 630, 742, 852, 962, 1072, 1182, 1292, 1392,
]
/** How far below the screen top each flag's string point sits. */
const SCREEN_BUNTING_FLAG_TOPS: readonly number[] = [
  28, 42, 54, 62, 64, 60, 52, 40, 30, 34, 42, 44, 38, 30, 26,
]
const SCREEN_FLAG_WIDTH = 44
const SCREEN_FLAG_DROP = 50
const SCREEN_FLAG_TILT = 6
const BUNTING_STROKE_WIDTH = 3

function flagColor(flagIndex: number): string {
  return FLAG_COLORS[flagIndex % FLAG_COLORS.length] ?? FROSTING_COLOR
}

/** Paper bunting strung across the top of the screen. */
export function ScreenBunting(): JSX.Element {
  return (
    <svg
      className={`${DECORATION_LAYER_CLASS_NAME} top-0 left-0 h-auto w-full`}
      viewBox={`0 0 ${String(SCREEN_BUNTING_WIDTH)} ${String(SCREEN_BUNTING_HEIGHT)}`}
      aria-hidden="true"
    >
      <path
        d={SCREEN_BUNTING_STRING_PATH}
        fill="none"
        stroke={INK_COLOR}
        strokeWidth={BUNTING_STROKE_WIDTH}
      />
      {SCREEN_BUNTING_FLAG_LEFTS.map((left: number, flagIndex: number): JSX.Element => {
        const top: number = SCREEN_BUNTING_FLAG_TOPS[flagIndex] ?? 0
        const tilt: number = flagIndex % 2 === 0 ? SCREEN_FLAG_TILT : -SCREEN_FLAG_TILT
        const right: number = left + SCREEN_FLAG_WIDTH
        const tipX: number = left + SCREEN_FLAG_WIDTH / 2
        return (
          <polygon
            key={left}
            points={`${String(left)},${String(top)} ${String(right)},${String(top + tilt)} ${String(tipX)},${String(top + SCREEN_FLAG_DROP)}`}
            fill={flagColor(flagIndex)}
            stroke={INK_COLOR}
            strokeWidth={BUNTING_STROKE_WIDTH}
          />
        )
      })}
    </svg>
  )
}

/** One paper scrap: a strip or a dot, placed in percent of its layer. */
export type ConfettiPiece = {
  leftPercent: number
  topPercent: number
  shape: 'strip' | 'tall-strip' | 'dot'
  color: string
  rotationDegrees: number
}

const CONFETTI_CLASS_NAME_BY_SHAPE: Readonly<Record<ConfettiPiece['shape'], string>> = {
  strip: 'h-2 w-3.5',
  'tall-strip': 'h-4 w-2.5',
  dot: 'size-3 rounded-full',
}
const CONFETTI_PIECE_CLASS_NAME = 'absolute border-2 border-ink-deep'

/** Confetti scattered over the menu wallpaper, clear of the left column. */
export const SCREEN_CONFETTI: readonly ConfettiPiece[] = [
  { leftPercent: 44, topPercent: 23, shape: 'strip', color: FROSTING_COLOR, rotationDegrees: 24 },
  { leftPercent: 50, topPercent: 47, shape: 'tall-strip', color: LIZARD_COLOR, rotationDegrees: -18 },
  { leftPercent: 60, topPercent: 20, shape: 'strip', color: BALLOON_COLOR, rotationDegrees: 60 },
  { leftPercent: 68, topPercent: 33, shape: 'dot', color: GOLD_LIGHT_COLOR, rotationDegrees: 0 },
  { leftPercent: 78, topPercent: 22, shape: 'strip', color: MINT_COLOR, rotationDegrees: -36 },
  { leftPercent: 90, topPercent: 37, shape: 'tall-strip', color: FROSTING_COLOR, rotationDegrees: 12 },
  { leftPercent: 86, topPercent: 17, shape: 'dot', color: RUST_COLOR, rotationDegrees: 0 },
  { leftPercent: 39, topPercent: 71, shape: 'strip', color: LIZARD_COLOR, rotationDegrees: -50 },
  { leftPercent: 94, topPercent: 62, shape: 'strip', color: BALLOON_COLOR, rotationDegrees: 30 },
]

/** Confetti around a picked tile: a few scraps just outside its edges. */
export const TILE_CONFETTI: readonly ConfettiPiece[] = [
  { leftPercent: 104, topPercent: 30, shape: 'strip', color: BALLOON_COLOR, rotationDegrees: 30 },
  { leftPercent: -10, topPercent: 45, shape: 'tall-strip', color: FROSTING_COLOR, rotationDegrees: -24 },
  { leftPercent: 103, topPercent: 72, shape: 'dot', color: GOLD_LIGHT_COLOR, rotationDegrees: 0 },
  { leftPercent: -7, topPercent: 82, shape: 'strip', color: MINT_COLOR, rotationDegrees: -40 },
]

function confettiStyle(piece: ConfettiPiece): CSSProperties {
  return {
    left: `${String(piece.leftPercent)}%`,
    top: `${String(piece.topPercent)}%`,
    backgroundColor: piece.color,
    transform: `rotate(${String(piece.rotationDegrees)}deg)`,
  }
}

/** Paper confetti laid over its positioned parent. */
export function Confetti(props: { pieces: readonly ConfettiPiece[] }): JSX.Element {
  return (
    <span className={`${DECORATION_LAYER_CLASS_NAME} inset-0`} aria-hidden="true">
      {props.pieces.map(
        (piece: ConfettiPiece, pieceIndex: number): JSX.Element => (
          <span
            key={pieceIndex}
            className={`${CONFETTI_PIECE_CLASS_NAME} ${CONFETTI_CLASS_NAME_BY_SHAPE[piece.shape]}`}
            style={confettiStyle(piece)}
          />
        ),
      )}
    </span>
  )
}

/** A striped candle lit on the top right corner of its positioned parent. */
export function BirthdayCandle(): JSX.Element {
  return (
    <span className={`${DECORATION_LAYER_CLASS_NAME} -top-10 right-4 flex flex-col items-center`} aria-hidden="true">
      <span
        className="h-4.5 w-3 rounded-[50%_50%_50%_50%/60%_60%_40%_40%] border-2 border-ink-deep"
        style={{ backgroundColor: FLAME_COLOR }}
      />
      <span className="h-6.5 w-2 border-2 border-ink-deep bg-[repeating-linear-gradient(180deg,var(--color-paper-bright)_0_5px,var(--color-berry)_5px_10px)]" />
    </span>
  )
}

const TILE_BUNTING_WIDTH = 220
const TILE_BUNTING_HEIGHT = 48
const TILE_BUNTING_STRING_PATH = 'M2 6 Q 110 32 218 6'
const TILE_BUNTING_FLAG_POINTS: readonly string[] = [
  '30,11 54,16 40,44',
  '74,19 98,21 86,48',
  '122,21 146,19 134,48',
  '166,16 190,11 180,44',
]
const TILE_BUNTING_FLAG_COLORS: readonly string[] = [
  FROSTING_COLOR,
  BALLOON_COLOR,
  GOLD_LIGHT_COLOR,
  BERRY_COLOR,
]
const TILE_BUNTING_STROKE_WIDTH = 2.5

/** A short string of four flags across the top of a seat tile. */
export function TileBunting(): JSX.Element {
  return (
    <svg
      className={`${DECORATION_LAYER_CLASS_NAME} -top-[9%] -left-[6.5%] z-1 h-auto w-[113%]`}
      viewBox={`0 0 ${String(TILE_BUNTING_WIDTH)} ${String(TILE_BUNTING_HEIGHT)}`}
      aria-hidden="true"
    >
      <path
        d={TILE_BUNTING_STRING_PATH}
        fill="none"
        stroke={INK_COLOR}
        strokeWidth={BUNTING_STROKE_WIDTH}
      />
      {TILE_BUNTING_FLAG_POINTS.map(
        (points: string, flagIndex: number): JSX.Element => (
          <polygon
            key={points}
            points={points}
            fill={TILE_BUNTING_FLAG_COLORS[flagIndex] ?? FROSTING_COLOR}
            stroke={INK_COLOR}
            strokeWidth={TILE_BUNTING_STROKE_WIDTH}
          />
        ),
      )}
    </svg>
  )
}

const BOW_WIDTH = 90
const BOW_HEIGHT = 50
const BOW_LEFT_LOOP_PATH = 'M45 44 C 20 10, 2 20, 10 40 Z'
const BOW_RIGHT_LOOP_PATH = 'M45 44 C 70 10, 88 20, 80 40 Z'
const BOW_KNOT_CENTER_X = 45
const BOW_KNOT_CENTER_Y = 42
const BOW_KNOT_RADIUS = 7

/** Gift wrap colours: box paper, ribbon and bow knot. */
export type GiftWrap = {
  /** Sets the `root-paper` colour of the tile the wrap sits on. */
  paperClassName: string
  ribbonColor: string
  knotColor: string
}

export const BALLOON_GIFT_WRAP: GiftWrap = {
  paperClassName: '[--root-paper-color:var(--color-balloon)]',
  ribbonColor: BERRY_COLOR,
  knotColor: LIZARD_COLOR,
}
const MINT_GIFT_WRAP: GiftWrap = {
  paperClassName: '[--root-paper-color:var(--color-mint)]',
  ribbonColor: LIZARD_COLOR,
  knotColor: FROSTING_COLOR,
}
/** Open lobby seats come wrapped in turn. */
const GIFT_WRAPS: readonly GiftWrap[] = [BALLOON_GIFT_WRAP, MINT_GIFT_WRAP]

export function giftWrapForSeat(seatIndex: number): GiftWrap {
  return GIFT_WRAPS[seatIndex % GIFT_WRAPS.length] ?? BALLOON_GIFT_WRAP
}

const GIFT_RIBBON_CLASS_NAME = 'absolute border-ink-deep'

/** Ribbon cross over a seat tile and a bow on its top edge: the seat is a gift box. */
export function GiftBoxWrap(props: { wrap: GiftWrap }): JSX.Element {
  const ribbonStyle: CSSProperties = { backgroundColor: props.wrap.ribbonColor }
  return (
    <span className={`${DECORATION_LAYER_CLASS_NAME} inset-0`} aria-hidden="true">
      <span
        className={`${GIFT_RIBBON_CLASS_NAME} inset-y-0 left-[43%] w-[11%] border-x-3`}
        style={ribbonStyle}
      />
      <span
        className={`${GIFT_RIBBON_CLASS_NAME} inset-x-0 top-[43%] h-[11%] border-y-3`}
        style={ribbonStyle}
      />
      <RibbonBow
        className="absolute -top-[17%] left-[26%] h-auto w-[45%]"
        ribbonColor={props.wrap.ribbonColor}
        knotColor={props.wrap.knotColor}
      />
    </span>
  )
}

type RibbonBowProps = {
  className: string
  ribbonColor: string
  knotColor: string
}

function RibbonBow(props: RibbonBowProps): JSX.Element {
  return (
    <svg
      className={props.className}
      viewBox={`0 0 ${String(BOW_WIDTH)} ${String(BOW_HEIGHT)}`}
      aria-hidden="true"
    >
      {[BOW_LEFT_LOOP_PATH, BOW_RIGHT_LOOP_PATH].map(
        (loopPath: string): JSX.Element => (
          <path
            key={loopPath}
            d={loopPath}
            fill={props.ribbonColor}
            stroke={INK_COLOR}
            strokeWidth={BUNTING_STROKE_WIDTH}
            strokeLinejoin="round"
          />
        ),
      )}
      <circle
        cx={BOW_KNOT_CENTER_X}
        cy={BOW_KNOT_CENTER_Y}
        r={BOW_KNOT_RADIUS}
        fill={props.knotColor}
        stroke={INK_COLOR}
        strokeWidth={BUNTING_STROKE_WIDTH}
      />
    </svg>
  )
}

/**
 * The knot sits on the token's top edge, the loops stand above it. Lay it
 * over a token's box (same position and size); it overflows upward.
 */
const TOKEN_BOW_CLASS_NAME =
  'pointer-events-none absolute z-2 select-none overflow-visible'
const TOKEN_BOW_SVG_CLASS_NAME =
  'absolute top-0 left-1/2 h-auto w-[62%] -translate-x-1/2 -translate-y-[84%]'
/** Bow colour per suit, matching the suit icon on the token. */
const SUIT_BOW_COLORS: Readonly<Record<string, string>> = {
  fox: 'var(--color-suit-fox)',
  rabbit: 'var(--color-suit-rabbit)',
  mouse: 'var(--color-suit-mouse)',
}

/** Bow on a garden (its suit's colour) or the Outcast marker (berry). */
export function TokenBow(props: {
  style: CSSProperties
  suit: string | null
}): JSX.Element {
  const ribbonColor: string =
    props.suit === null ? BERRY_COLOR : (SUIT_BOW_COLORS[props.suit] ?? BERRY_COLOR)
  return (
    <span className={TOKEN_BOW_CLASS_NAME} style={props.style} aria-hidden="true">
      <RibbonBow
        className={TOKEN_BOW_SVG_CLASS_NAME}
        ribbonColor={ribbonColor}
        knotColor={GOLD_LIGHT_COLOR}
      />
    </span>
  )
}

/** "PARTY!" in comic lettering on a frosting cloud, between the lobby seats. */
export function PartyCloud(): JSX.Element {
  return (
    <li className="hidden -rotate-6 self-center md:-mx-4.5 md:block" aria-hidden="true">
      <span className="block rounded-[48%_52%_44%_56%/58%_46%_54%_42%] border-3 border-ink-deep bg-frosting px-5.5 py-3.5 font-comic text-[40px] tracking-[0.04em] text-ink-deep shadow-[3px_4px_0_color-mix(in_srgb,var(--color-ink-deep)_45%,transparent)]">
        PARTY!
      </span>
    </li>
  )
}
