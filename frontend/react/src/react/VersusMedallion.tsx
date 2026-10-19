import type { JSX } from 'react'
import { PAPER_GRAIN_FILTER_ID, TORN_EDGE_FINE_FILTER_ID } from '#react/PaperFilters.tsx'

/**
 * "VS!" between the two sides of a lobby table: a torn parchment brawl cloud,
 * a Marquise paw fist punching in from the players' side and a robot fist from the bots' side.
 * Mockup: `resources/mockups/versus-medallion/options.html` (K6).
 */
const VIEW_BOX_WIDTH = 170
const VIEW_BOX_HEIGHT = 110
const CLOUD_CENTER_X = VIEW_BOX_WIDTH / 2
const CLOUD_CENTER_Y = 56
/** Centred on the row even when the sides align to the top. */
const MEDALLION_CLASS_NAME = 'block h-auto w-24 shrink-0 self-center drop-shadow-stamp md:w-42'

type Puff = { centerX: number; centerY: number; radius: number }

/** Overlapping circles merged into one cloud with a single outline. */
const CLOUD_PUFFS: readonly Puff[] = [
  { centerX: 55, centerY: 54, radius: 20 },
  { centerX: 75, centerY: 36, radius: 22 },
  { centerX: 101, centerY: 36, radius: 20 },
  { centerX: 117, centerY: 56, radius: 18 },
  { centerX: 97, centerY: 74, radius: 20 },
  { centerX: 67, centerY: 72, radius: 18 },
  { centerX: 85, centerY: 56, radius: 26 },
]
/** The ink circles are this much wider than the paper ones: the cloud outline. */
const CLOUD_OUTLINE_WIDTH = 3

type VersusGlyph = { glyph: string; offsetX: number; offsetY: number; rotationDegrees: number }

/** Each glyph tilted and nudged on its own around the cloud centre, so the letters bounce. */
const VERSUS_GLYPHS: readonly VersusGlyph[] = [
  { glyph: 'V', offsetX: -14, offsetY: -2, rotationDegrees: -8 },
  { glyph: 'S', offsetX: 5, offsetY: 3, rotationDegrees: 7 },
  { glyph: '!', offsetX: 19, offsetY: -1, rotationDegrees: 12 },
]
const VERSUS_FONT_SIZE = 44
const VERSUS_TILT_DEGREES = -6
const VERSUS_OUTLINE_WIDTH = 2.5
/** Hard ink shadow under the letters. */
const VERSUS_SHADOW_OFFSET = 3

const PROP_OUTLINE_WIDTH = 3
const FIST_SCALE = 0.62
const PAW_FIST_TRANSFORM = `translate(28 56) rotate(-8) scale(${String(FIST_SCALE)})`
const ROBOT_FIST_TRANSFORM = `translate(142 54) rotate(8) scale(${String(FIST_SCALE)})`
const STAR_TRANSFORM = 'translate(86 8) scale(0.45)'
const STAR_OUTLINE_WIDTH = 3 / 0.45
const PAW_PAD_COLOR = '#f0c8a8'
const ROBOT_STEEL_COLOR = '#9aa8b2'
const ROBOT_STEEL_LIGHT_COLOR = '#b9c4cc'

const PAW_SLEEVE_PATH = 'M-36 -10 h24 v20 h-24z'
const PAW_CUFF_PATH = 'M-36 -10 h6 v20 h-6z'
const PAW_PATH = 'M-14 -17 q22 -6 26 9 q4 15 -15 21 q-13 2 -13 -9z'
const PAW_KNUCKLES_PATH = 'M4 -13 q-5 6 0 10 M8 -2 q-5 4 -1 9'
const ROBOT_ARM_PATH = 'M12 -9 h26 v18 h-26z'
const ROBOT_FIST_PATH = 'M14 -17 h-21 q-9 0 -9 9 v17 q0 9 9 9 h21z'
const ROBOT_KNUCKLES_PATH = 'M-15 -7 h11 M-15 1 h11 M-15 9 h11'
const STAR_PATH = 'M0 -14 L4 -4 L14 -4 L6 3 L9 13 L0 7 L-9 13 L-6 3 L-14 -4 L-4 -4Z'

const INK_STROKE_CLASS_NAME = 'stroke-ink-deep'

function cloudCircles(props: { outlineWidth: number; className: string }): JSX.Element[] {
  return CLOUD_PUFFS.map(
    (puff: Puff, puffIndex: number): JSX.Element => (
      <circle
        key={puffIndex}
        className={props.className}
        cx={puff.centerX}
        cy={puff.centerY}
        r={puff.radius + props.outlineWidth}
      />
    ),
  )
}

function PawFist(): JSX.Element {
  return (
    <g
      transform={PAW_FIST_TRANSFORM}
      className={INK_STROKE_CLASS_NAME}
      strokeWidth={PROP_OUTLINE_WIDTH}
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      <path className="fill-marquise" d={PAW_SLEEVE_PATH} />
      <path className="fill-parchment" d={PAW_CUFF_PATH} />
      <path className="fill-marquise" d={PAW_PATH} />
      <path fill="none" d={PAW_KNUCKLES_PATH} />
      <ellipse cx={-4} cy={-4} rx={3} ry={2.5} fill={PAW_PAD_COLOR} stroke="none" />
    </g>
  )
}

function RobotFist(): JSX.Element {
  return (
    <g
      transform={ROBOT_FIST_TRANSFORM}
      className={INK_STROKE_CLASS_NAME}
      strokeWidth={PROP_OUTLINE_WIDTH}
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      <path fill={ROBOT_STEEL_COLOR} d={ROBOT_ARM_PATH} />
      <circle className="fill-forest-deep" cx={25} cy={0} r={3.5} />
      <path fill={ROBOT_STEEL_LIGHT_COLOR} d={ROBOT_FIST_PATH} />
      <path fill="none" d={ROBOT_KNUCKLES_PATH} />
    </g>
  )
}

function VersusLetters(props: { offsetY: number; fillClassName: string }): JSX.Element {
  return (
    <g
      className={`font-comic ${props.fillClassName} ${INK_STROKE_CLASS_NAME}`}
      fontSize={VERSUS_FONT_SIZE}
      strokeWidth={VERSUS_OUTLINE_WIDTH}
      strokeLinejoin="round"
      paintOrder="stroke fill"
      transform={`rotate(${String(VERSUS_TILT_DEGREES)} ${String(CLOUD_CENTER_X)} ${String(CLOUD_CENTER_Y)})`}
    >
      {VERSUS_GLYPHS.map((versusGlyph: VersusGlyph): JSX.Element => {
        const glyphX: number = CLOUD_CENTER_X + versusGlyph.offsetX
        const glyphY: number = CLOUD_CENTER_Y + versusGlyph.offsetY + props.offsetY
        return (
          <text
            key={versusGlyph.glyph}
            x={glyphX}
            y={glyphY}
            textAnchor="middle"
            dominantBaseline="central"
            transform={`rotate(${String(versusGlyph.rotationDegrees)} ${String(glyphX)} ${String(glyphY)})`}
          >
            {versusGlyph.glyph}
          </text>
        )
      })}
    </g>
  )
}

export function VersusMedallion(): JSX.Element {
  return (
    <svg
      className={MEDALLION_CLASS_NAME}
      viewBox={`0 0 ${String(VIEW_BOX_WIDTH)} ${String(VIEW_BOX_HEIGHT)}`}
      aria-hidden="true"
    >
      <g filter={`url(#${TORN_EDGE_FINE_FILTER_ID})`}>
        {cloudCircles({ outlineWidth: CLOUD_OUTLINE_WIDTH, className: 'fill-ink-deep' })}
        <g filter={`url(#${PAPER_GRAIN_FILTER_ID})`}>
          {cloudCircles({ outlineWidth: 0, className: 'fill-parchment' })}
        </g>
      </g>
      <PawFist />
      <RobotFist />
      <path
        className={`fill-gold ${INK_STROKE_CLASS_NAME}`}
        d={STAR_PATH}
        transform={STAR_TRANSFORM}
        strokeWidth={STAR_OUTLINE_WIDTH}
        strokeLinejoin="round"
      />
      {/* Same hand-torn wobble as the paper, so the letter outline is a squiggly ink line. */}
      <g filter={`url(#${TORN_EDGE_FINE_FILTER_ID})`}>
        <VersusLetters offsetY={VERSUS_SHADOW_OFFSET} fillClassName="fill-ink-deep" />
        <VersusLetters offsetY={0} fillClassName="fill-rust" />
      </g>
    </svg>
  )
}
