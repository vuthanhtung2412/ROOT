import type { CSSProperties, JSX } from 'react'

/**
 * Birthday edition: letter cards pegged on two ropes between branch poles,
 * over the far end of the dock on the menu wallpaper, where the fox points.
 * Drawn like the wallpaper (wobbly brown ink, paper grain), not like the paper UI.
 * Mockup: `resources/mockups/birthday-edition/bridge-banner-painted.html` (variant F).
 *
 * Everything is in wallpaper pixels, mirrored like the menu shows it
 * (`ulrick-wery-riverside.webp`, 1920 × 1341), so the cards stay on the bridge
 * at any screen size.
 */

const WALLPAPER_WIDTH = 1920
const WALLPAPER_HEIGHT = 1341

/**
 * Same box as the wallpaper `<img>`: `object-cover`, centred, and on phones
 * `object-[35%_center]` on the unmirrored art, which is 65% once mirrored.
 */
const WALLPAPER_BOX_CLASS_NAME =
  'absolute top-1/2 left-1/2 -translate-1/2 max-sm:left-[65%] max-sm:-translate-x-[65%]'
const WALLPAPER_BOX_STYLE: CSSProperties = {
  width: `max(100cqw, calc(100cqh * ${String(WALLPAPER_WIDTH)} / ${String(WALLPAPER_HEIGHT)}))`,
  height: `max(100cqh, calc(100cqw * ${String(WALLPAPER_HEIGHT)} / ${String(WALLPAPER_WIDTH)}))`,
}
const LAYER_CLASS_NAME =
  'pointer-events-none absolute inset-0 overflow-hidden select-none [container-type:size]'

const INK_COLOR = 'var(--color-ink)'
const WOOD_COLOR = 'var(--color-wood)'
const PEG_COLOR = 'var(--color-gold)'
const HEART_COLOR = 'var(--color-berry)'
const LANTERN_COLOR = 'var(--color-suit-mouse)'
const LANTERN_RIB_COLOR = 'var(--color-rust-deep)'
const LANTERN_GLOW_COLOR = 'var(--color-gold-light)'
const CARD_COLORS: readonly string[] = [
  'var(--color-parchment-deep)',
  'var(--color-rose-wash)',
  'var(--color-sage-wash)',
  'var(--color-ochre-wash)',
]

type Point = { x: number; y: number }

type Pole = {
  base: Point
  top: Point
  /** The fork at the top leans away from the cards: -1 left, 1 right. */
  forkDirection: number
}

type CardRow = {
  letters: readonly string[]
  /** Where the rope is tied, measured down from each pole top. */
  dropBelowPoleTop: number
  /** How far the middle of the rope hangs below the straight line. */
  sag: number
  colorOffset: number
}

/** Pole bases marked with the layout helper on the far bank, each side of the dock. */
const LEFT_POLE: Pole = { base: { x: 1241, y: 830 }, top: { x: 1244, y: 518 }, forkDirection: -1 }
const RIGHT_POLE: Pole = { base: { x: 1608, y: 925 }, top: { x: 1611, y: 618 }, forkDirection: 1 }

/** Stands in for a letter: the card gets a painted heart. */
const HEART_CARD = '♥'
const CARD_ROWS: readonly CardRow[] = [
  { letters: [...'PHUONG’S'], dropBelowPoleTop: 21, sag: 12, colorOffset: 0 },
  { letters: [...'BIRTHDAY', HEART_CARD], dropBelowPoleTop: 104, sag: 13, colorOffset: 1 },
]

const INK_STROKE_WIDTH = 2.7
const CARD_STROKE_WIDTH = 2.1
const ROPE_STROKE_WIDTH = 3.2
/** A slightly uneven paper card hanging from its peg, corners relative to the peg. */
const CARD_CORNER_OFFSETS: readonly Point[] = [
  { x: -16, y: 3 },
  { x: 16, y: 1 },
  { x: 17, y: 40 },
  { x: -15, y: 41 },
]
const CARD_LETTER_BASELINE = 31
const CARD_LETTER_FONT_SIZE = 28
/** Cards swing a little, in turn left, right, straight. */
const CARD_TILT_PATTERN: readonly number[] = [-1, 1, 0]
const CARD_TILT_STEP_DEGREES = 5
const PEG_WIDTH = 4
const PEG_HEIGHT = 9
const HEART_PATH_FROM_CARD_PEG =
  'm0,33 c-12,-9 -15,-15 -12,-20 c3,-4 9,-4 12,1 c3,-5 9,-5 12,-1 c3,5 0,11 -12,20 Z'

const POLE_HALF_WIDTH_AT_BASE = 5
const POLE_HALF_WIDTH_AT_TOP = 4
const POLE_BOW = 40
const FORK_START_BELOW_TOP = 21
const FORK_REACH: Point = { x: 19, y: -29 }
const FORK_BEND: Point = { x: 11, y: -13 }
const FORK_INK_WIDTH = 6.5
const FORK_WOOD_WIDTH = 3.2

const SHADOW_OFFSET: Point = { x: 5, y: 3 }
const SHADOW_RADIUS: Point = { x: 21, y: 5 }
const SHADOW_OPACITY = 0.28
const GRASS_TUFT_PATH_FROM_BASE =
  'm-15,3 q4,-16 9,-23 m2,24 q0,-20 3,-28 m8,28 q3,-16 11,-21 m-4,20 q3,-12 11,-15 m-39,1 q-1,-11 -8,-15'

const LANTERN_RADIUS: Point = { x: 13, y: 16 }
const LANTERN_GLOW_RADIUS = 35
const LANTERN_CAP_WIDTH = 14
const LANTERN_CAP_HEIGHT = 4
const LANTERN_HANGER_LENGTH = 11
/** Black caps on the top and bottom of the lantern. */
const LANTERN_CAP_SIDES: readonly number[] = [-1, 1]
const LANTERN_RIBS_PATH_FROM_CENTER = 'm-5,-15 q-4,15 0,30 m10,-30 q4,15 0,30'

/** Wobble and grain so the drawing matches the inked wallpaper. */
const INK_WOBBLE_FREQUENCY = 0.034
const INK_WOBBLE_OCTAVES = 2
const INK_WOBBLE_SEED = 4
const INK_WOBBLE_SCALE = 4.3
const GRAIN_FREQUENCY = 0.64
const GRAIN_OCTAVES = 2
const GRAIN_SEED = 9
/** Brown grain whose strength follows the noise: darker flecks, clear gaps. */
const GRAIN_INK_MATRIX = '0 0 0 0 0.23 0 0 0 0 0.14 0 0 0 0 0.09 0 0 0 -1.1 0.62'
/** One banner on screen at a time, so fixed ids (like `PaperFilters`). */
const INK_FILTER_ID = 'birthday-bridge-ink'
const LANTERN_GLOW_ID = 'birthday-bridge-lantern-glow'
const FILTER_REGION_OFFSET = '-5%'
const FILTER_REGION_SIZE = '110%'
const DRAWING_OPACITY = 0.96

type RopeCurve = { start: Point; control: Point; end: Point }

function ropeCurve(row: CardRow): RopeCurve {
  const start: Point = { x: LEFT_POLE.top.x, y: LEFT_POLE.top.y + row.dropBelowPoleTop }
  const end: Point = { x: RIGHT_POLE.top.x, y: RIGHT_POLE.top.y + row.dropBelowPoleTop }
  /** A quadratic control point twice the sag below the chord puts the middle `sag` below it. */
  const control: Point = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 + row.sag * 2 }
  return { start, control, end }
}

function pointOnRope(curve: RopeCurve, progress: number): Point {
  const remaining: number = 1 - progress
  const startWeight: number = remaining * remaining
  const controlWeight: number = 2 * remaining * progress
  const endWeight: number = progress * progress
  return {
    x: startWeight * curve.start.x + controlWeight * curve.control.x + endWeight * curve.end.x,
    y: startWeight * curve.start.y + controlWeight * curve.control.y + endWeight * curve.end.y,
  }
}

function ropePath(curve: RopeCurve): string {
  const { start, control, end } = curve
  return `M${String(start.x)},${String(start.y)} Q${String(control.x)},${String(control.y)} ${String(end.x)},${String(end.y)}`
}

function polePath(pole: Pole): string {
  const middleY: number = (pole.base.y + pole.top.y) / 2
  const { base, top } = pole
  return [
    `M${String(base.x - POLE_HALF_WIDTH_AT_BASE)},${String(base.y)}`,
    `C${String(base.x - POLE_HALF_WIDTH_AT_BASE)},${String(middleY)} ${String(top.x - POLE_HALF_WIDTH_AT_TOP)},${String(middleY - POLE_BOW)} ${String(top.x - POLE_HALF_WIDTH_AT_TOP)},${String(top.y)}`,
    `L${String(top.x + POLE_HALF_WIDTH_AT_TOP)},${String(top.y)}`,
    `C${String(top.x + POLE_HALF_WIDTH_AT_TOP)},${String(middleY - POLE_BOW)} ${String(base.x + POLE_HALF_WIDTH_AT_BASE)},${String(middleY)} ${String(base.x + POLE_HALF_WIDTH_AT_BASE)},${String(base.y)}`,
    'Z',
  ].join(' ')
}

function forkTip(pole: Pole): Point {
  return {
    x: pole.top.x + FORK_REACH.x * pole.forkDirection,
    y: pole.top.y + FORK_START_BELOW_TOP + FORK_REACH.y,
  }
}

function forkPath(pole: Pole): string {
  const startY: number = pole.top.y + FORK_START_BELOW_TOP
  return `M${String(pole.top.x)},${String(startY)} q${String(FORK_BEND.x * pole.forkDirection)},${String(FORK_BEND.y)} ${String(FORK_REACH.x * pole.forkDirection)},${String(FORK_REACH.y)}`
}

function cardOutline(peg: Point): string {
  return CARD_CORNER_OFFSETS.map(
    (offset: Point): string => `${String(peg.x + offset.x)},${String(peg.y + offset.y)}`,
  ).join(' ')
}

function BranchPole(props: { pole: Pole }): JSX.Element {
  const { base } = props.pole
  return (
    <g>
      <ellipse
        cx={base.x + SHADOW_OFFSET.x}
        cy={base.y + SHADOW_OFFSET.y}
        rx={SHADOW_RADIUS.x}
        ry={SHADOW_RADIUS.y}
        fill={INK_COLOR}
        opacity={SHADOW_OPACITY}
      />
      <path
        d={`M${String(base.x)},${String(base.y)} ${GRASS_TUFT_PATH_FROM_BASE}`}
        fill="none"
        stroke={INK_COLOR}
        strokeWidth={CARD_STROKE_WIDTH}
        strokeLinecap="round"
      />
      <path d={polePath(props.pole)} fill={WOOD_COLOR} stroke={INK_COLOR} strokeWidth={INK_STROKE_WIDTH} />
      <path d={forkPath(props.pole)} fill="none" stroke={INK_COLOR} strokeWidth={FORK_INK_WIDTH} strokeLinecap="round" />
      <path d={forkPath(props.pole)} fill="none" stroke={WOOD_COLOR} strokeWidth={FORK_WOOD_WIDTH} strokeLinecap="round" />
    </g>
  )
}

function PaperLantern(props: { center: Point; glowId: string }): JSX.Element {
  const { x, y } = props.center
  return (
    <g>
      <circle cx={x} cy={y} r={LANTERN_GLOW_RADIUS} fill={`url(#${props.glowId})`} />
      <line
        x1={x}
        y1={y - LANTERN_RADIUS.y - LANTERN_HANGER_LENGTH}
        x2={x}
        y2={y - LANTERN_RADIUS.y}
        stroke={INK_COLOR}
        strokeWidth={CARD_STROKE_WIDTH}
      />
      {LANTERN_CAP_SIDES.map(
        (side: number): JSX.Element => (
          <rect
            key={side}
            x={x - LANTERN_CAP_WIDTH / 2}
            y={side < 0 ? y - LANTERN_RADIUS.y - LANTERN_CAP_HEIGHT + 1 : y + LANTERN_RADIUS.y - 1}
            width={LANTERN_CAP_WIDTH}
            height={LANTERN_CAP_HEIGHT}
            fill={INK_COLOR}
          />
        ),
      )}
      <ellipse
        cx={x}
        cy={y}
        rx={LANTERN_RADIUS.x}
        ry={LANTERN_RADIUS.y}
        fill={LANTERN_COLOR}
        stroke={INK_COLOR}
        strokeWidth={INK_STROKE_WIDTH}
      />
      <path
        d={`M${String(x)},${String(y)} ${LANTERN_RIBS_PATH_FROM_CENTER}`}
        fill="none"
        stroke={LANTERN_RIB_COLOR}
        strokeWidth={CARD_STROKE_WIDTH}
      />
    </g>
  )
}

function LetterCard(props: { letter: string; peg: Point; cardIndex: number; color: string }): JSX.Element {
  const { peg } = props
  const tiltDegrees: number =
    (CARD_TILT_PATTERN[props.cardIndex % CARD_TILT_PATTERN.length] ?? 0) * CARD_TILT_STEP_DEGREES
  return (
    <g transform={`rotate(${String(tiltDegrees)} ${String(peg.x)} ${String(peg.y)})`}>
      <polygon points={cardOutline(peg)} fill={props.color} stroke={INK_COLOR} strokeWidth={CARD_STROKE_WIDTH} />
      {props.letter === HEART_CARD ? (
        <path
          d={`M${String(peg.x)},${String(peg.y)} ${HEART_PATH_FROM_CARD_PEG}`}
          fill={HEART_COLOR}
          stroke={INK_COLOR}
          strokeWidth={CARD_STROKE_WIDTH}
        />
      ) : (
        <text
          className="font-display"
          x={peg.x}
          y={peg.y + CARD_LETTER_BASELINE}
          textAnchor="middle"
          fontSize={CARD_LETTER_FONT_SIZE}
          fill={INK_COLOR}
        >
          {props.letter}
        </text>
      )}
      <rect
        x={peg.x - PEG_WIDTH / 2}
        y={peg.y - PEG_HEIGHT / 2}
        width={PEG_WIDTH}
        height={PEG_HEIGHT}
        fill={PEG_COLOR}
        stroke={INK_COLOR}
      />
    </g>
  )
}

function CardRope(props: { row: CardRow }): JSX.Element {
  const { row } = props
  const curve: RopeCurve = ropeCurve(row)
  return (
    <g>
      <path d={ropePath(curve)} fill="none" stroke={WOOD_COLOR} strokeWidth={ROPE_STROKE_WIDTH} />
      {row.letters.map(
        (letter: string, cardIndex: number): JSX.Element => (
          <LetterCard
            key={cardIndex}
            letter={letter}
            peg={pointOnRope(curve, (cardIndex + 1) / (row.letters.length + 1))}
            cardIndex={cardIndex}
            color={CARD_COLORS[(cardIndex + row.colorOffset) % CARD_COLORS.length] ?? INK_COLOR}
          />
        ),
      )}
    </g>
  )
}

/** Letter-card banner over the menu wallpaper bridge; render right above the wallpaper. */
export function BirthdayBridgeBanner(): JSX.Element {
  return (
    <div className={LAYER_CLASS_NAME} aria-hidden="true">
      <svg
        className={WALLPAPER_BOX_CLASS_NAME}
        style={WALLPAPER_BOX_STYLE}
        viewBox={`0 0 ${String(WALLPAPER_WIDTH)} ${String(WALLPAPER_HEIGHT)}`}
      >
        <defs>
          <filter
            id={INK_FILTER_ID}
            x={FILTER_REGION_OFFSET}
            y={FILTER_REGION_OFFSET}
            width={FILTER_REGION_SIZE}
            height={FILTER_REGION_SIZE}
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency={INK_WOBBLE_FREQUENCY}
              numOctaves={INK_WOBBLE_OCTAVES}
              seed={INK_WOBBLE_SEED}
              result="warp"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="warp"
              scale={INK_WOBBLE_SCALE}
              xChannelSelector="R"
              yChannelSelector="G"
              result="wobbly"
            />
            <feTurbulence
              type="fractalNoise"
              baseFrequency={GRAIN_FREQUENCY}
              numOctaves={GRAIN_OCTAVES}
              seed={GRAIN_SEED}
              result="grain"
            />
            <feColorMatrix in="grain" values={GRAIN_INK_MATRIX} result="grainTint" />
            <feComposite in="grainTint" in2="wobbly" operator="in" result="grainOnShape" />
            <feMerge>
              <feMergeNode in="wobbly" />
              <feMergeNode in="grainOnShape" />
            </feMerge>
          </filter>
          <radialGradient id={LANTERN_GLOW_ID}>
            <stop offset="0" stopColor={LANTERN_GLOW_COLOR} stopOpacity={0.6} />
            <stop offset="1" stopColor={LANTERN_GLOW_COLOR} stopOpacity={0} />
          </radialGradient>
        </defs>
        <g filter={`url(#${INK_FILTER_ID})`} opacity={DRAWING_OPACITY}>
          <BranchPole pole={LEFT_POLE} />
          <BranchPole pole={RIGHT_POLE} />
          {CARD_ROWS.map(
            (row: CardRow): JSX.Element => (
              <CardRope key={row.dropBelowPoleTop} row={row} />
            ),
          )}
          <PaperLantern center={forkTip(LEFT_POLE)} glowId={LANTERN_GLOW_ID} />
          <PaperLantern center={forkTip(RIGHT_POLE)} glowId={LANTERN_GLOW_ID} />
        </g>
      </svg>
    </div>
  )
}
