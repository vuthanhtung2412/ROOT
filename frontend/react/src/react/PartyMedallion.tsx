import type { JSX } from 'react'
import { PAPER_GRAIN_FILTER_ID, TORN_EDGE_FINE_FILTER_ID } from '#react/PaperFilters.tsx'

/**
 * Birthday edition "PARTY!" between the two sides of a lobby table: the
 * `VersusMedallion` torn parchment cloud stretched wide, with confetti
 * flying off it in place of the brawling fists.
 */
const VIEW_BOX_WIDTH = 170
const VIEW_BOX_HEIGHT = 110
const CLOUD_CENTER_X = VIEW_BOX_WIDTH / 2
const CLOUD_CENTER_Y = 56
/** Centred on the row even when the sides align to the top. */
const MEDALLION_CLASS_NAME = 'block h-auto shrink-0 self-center drop-shadow-stamp'
/** Default width; tables with more room pass a bigger one. */
const MEDALLION_DEFAULT_SIZE_CLASS_NAME = 'w-24 md:w-42'

type Puff = { centerX: number; centerY: number; radius: number }

/** Overlapping circles merged into one wide cloud with a single outline. */
const CLOUD_PUFFS: readonly Puff[] = [
  { centerX: 30, centerY: 58, radius: 18 },
  { centerX: 50, centerY: 38, radius: 20 },
  { centerX: 76, centerY: 32, radius: 20 },
  { centerX: 102, centerY: 34, radius: 20 },
  { centerX: 126, centerY: 42, radius: 18 },
  { centerX: 140, centerY: 62, radius: 17 },
  { centerX: 118, centerY: 78, radius: 19 },
  { centerX: 88, centerY: 80, radius: 19 },
  { centerX: 56, centerY: 78, radius: 19 },
  { centerX: 85, centerY: 56, radius: 28 },
]
/** The ink circles are this much wider than the paper ones: the cloud outline. */
const CLOUD_OUTLINE_WIDTH = 3

type PartyGlyph = { glyph: string; offsetX: number; offsetY: number; rotationDegrees: number }

/** Each glyph tilted and nudged on its own around the cloud centre, so the letters bounce. */
const PARTY_GLYPHS: readonly PartyGlyph[] = [
  { glyph: 'P', offsetX: -48, offsetY: 2, rotationDegrees: -10 },
  { glyph: 'A', offsetX: -27, offsetY: -3, rotationDegrees: 6 },
  { glyph: 'R', offsetX: -7, offsetY: 2, rotationDegrees: -5 },
  { glyph: 'T', offsetX: 13, offsetY: -3, rotationDegrees: 8 },
  { glyph: 'Y', offsetX: 33, offsetY: 2, rotationDegrees: -7 },
  { glyph: '!', offsetX: 49, offsetY: -2, rotationDegrees: 12 },
]
const PARTY_FONT_SIZE = 34
const PARTY_TILT_DEGREES = -6
const PARTY_OUTLINE_WIDTH = 2.5
/** Hard ink shadow under the letters. */
const PARTY_SHADOW_OFFSET = 3

type ConfettiPiece = {
  centerX: number
  centerY: number
  rotationDegrees: number
  fillClassName: string
}

const CONFETTI_WIDTH = 9
const CONFETTI_HEIGHT = 5
const CONFETTI_OUTLINE_WIDTH = 1.5
/** Paper strips flung out around the cloud rim. */
const CONFETTI_PIECES: readonly ConfettiPiece[] = [
  { centerX: 10, centerY: 30, rotationDegrees: -30, fillClassName: 'fill-frosting' },
  { centerX: 8, centerY: 84, rotationDegrees: 25, fillClassName: 'fill-mint' },
  { centerX: 34, centerY: 102, rotationDegrees: -15, fillClassName: 'fill-balloon' },
  { centerX: 28, centerY: 12, rotationDegrees: 40, fillClassName: 'fill-gold' },
  { centerX: 140, centerY: 12, rotationDegrees: -35, fillClassName: 'fill-berry' },
  { centerX: 162, centerY: 36, rotationDegrees: 20, fillClassName: 'fill-gold' },
  { centerX: 162, centerY: 92, rotationDegrees: -25, fillClassName: 'fill-frosting' },
  { centerX: 136, centerY: 104, rotationDegrees: 35, fillClassName: 'fill-mint' },
]

const STAR_TRANSFORM = 'translate(86 8) scale(0.45)'
const STAR_OUTLINE_WIDTH = 3 / 0.45
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

function Confetti(): JSX.Element {
  return (
    <g className={INK_STROKE_CLASS_NAME} strokeWidth={CONFETTI_OUTLINE_WIDTH} strokeLinejoin="round">
      {CONFETTI_PIECES.map(
        (piece: ConfettiPiece, pieceIndex: number): JSX.Element => (
          <rect
            key={pieceIndex}
            className={piece.fillClassName}
            x={piece.centerX - CONFETTI_WIDTH / 2}
            y={piece.centerY - CONFETTI_HEIGHT / 2}
            width={CONFETTI_WIDTH}
            height={CONFETTI_HEIGHT}
            transform={`rotate(${String(piece.rotationDegrees)} ${String(piece.centerX)} ${String(piece.centerY)})`}
          />
        ),
      )}
    </g>
  )
}

function PartyLetters(props: { offsetY: number; fillClassName: string }): JSX.Element {
  return (
    <g
      className={`font-comic ${props.fillClassName} ${INK_STROKE_CLASS_NAME}`}
      fontSize={PARTY_FONT_SIZE}
      strokeWidth={PARTY_OUTLINE_WIDTH}
      strokeLinejoin="round"
      paintOrder="stroke fill"
      transform={`rotate(${String(PARTY_TILT_DEGREES)} ${String(CLOUD_CENTER_X)} ${String(CLOUD_CENTER_Y)})`}
    >
      {PARTY_GLYPHS.map((partyGlyph: PartyGlyph): JSX.Element => {
        const glyphX: number = CLOUD_CENTER_X + partyGlyph.offsetX
        const glyphY: number = CLOUD_CENTER_Y + partyGlyph.offsetY + props.offsetY
        return (
          <text
            key={partyGlyph.glyph}
            x={glyphX}
            y={glyphY}
            textAnchor="middle"
            dominantBaseline="central"
            transform={`rotate(${String(partyGlyph.rotationDegrees)} ${String(glyphX)} ${String(glyphY)})`}
          >
            {partyGlyph.glyph}
          </text>
        )
      })}
    </g>
  )
}

export function PartyMedallion(props: { sizeClassName?: string }): JSX.Element {
  const sizeClassName: string = props.sizeClassName ?? MEDALLION_DEFAULT_SIZE_CLASS_NAME
  return (
    <svg
      className={`${MEDALLION_CLASS_NAME} ${sizeClassName}`}
      viewBox={`0 0 ${String(VIEW_BOX_WIDTH)} ${String(VIEW_BOX_HEIGHT)}`}
      aria-hidden="true"
    >
      <g filter={`url(#${TORN_EDGE_FINE_FILTER_ID})`}>
        {cloudCircles({ outlineWidth: CLOUD_OUTLINE_WIDTH, className: 'fill-ink-deep' })}
        <g filter={`url(#${PAPER_GRAIN_FILTER_ID})`}>
          {cloudCircles({ outlineWidth: 0, className: 'fill-parchment' })}
        </g>
      </g>
      <Confetti />
      <path
        className={`fill-gold ${INK_STROKE_CLASS_NAME}`}
        d={STAR_PATH}
        transform={STAR_TRANSFORM}
        strokeWidth={STAR_OUTLINE_WIDTH}
        strokeLinejoin="round"
      />
      {/* Same hand-torn wobble as the paper, so the letter outline is a squiggly ink line. */}
      <g filter={`url(#${TORN_EDGE_FINE_FILTER_ID})`}>
        <PartyLetters offsetY={PARTY_SHADOW_OFFSET} fillClassName="fill-ink-deep" />
        <PartyLetters offsetY={0} fillClassName="fill-berry" />
      </g>
    </svg>
  )
}
