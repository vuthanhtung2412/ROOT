import type { JSX } from 'react'

/**
 * One footstep: a single foot of the footprints icon (Lucide `footprints`,
 * the icon of the move action), filled in a colour with a light border.
 * The toes point up.
 */
export type Foot = 'left' | 'right'

export type FootstepIconProps = {
  foot: Foot
  /** Fill, as CSS: the colour of the faction that walks. */
  color: string
  /** Height in pixels; the width follows. */
  height: number
}

/** The left foot of Lucide's `footprints`, in its 24-unit drawing. */
const LEFT_FOOT_OUTLINE =
  'M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z'
/** The crease between the sole and the heel. */
const LEFT_FOOT_CREASE = 'M4 13h4'
/** The part of the drawing the left foot takes, with room for its border. */
const VIEW_LEFT = 1
const VIEW_TOP = 0
const VIEW_WIDTH = 11
const VIEW_HEIGHT = 20
/** A light white border, so a footstep reads on any part of the map. */
const BORDER_COLOR = '#ffffff'
const BORDER_OPACITY = 0.8
/** Line widths in units of the drawing. */
const BORDER_STROKE_WIDTH = 2.6
const CREASE_STROKE_WIDTH = 1.1
/** The right foot is the left one seen in a mirror. */
const MIRROR_TRANSFORM = `translate(${String(VIEW_LEFT * 2 + VIEW_WIDTH)} 0) scale(-1 1)`

export function FootstepIcon(props: FootstepIconProps): JSX.Element {
  return (
    <svg
      className="block overflow-visible"
      viewBox={`${String(VIEW_LEFT)} ${String(VIEW_TOP)} ${String(VIEW_WIDTH)} ${String(VIEW_HEIGHT)}`}
      width={(props.height * VIEW_WIDTH) / VIEW_HEIGHT}
      height={props.height}
      aria-hidden
    >
      <g
        transform={props.foot === 'right' ? MIRROR_TRANSFORM : undefined}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* The border is drawn under the fill, so it only shows around it. */}
        <path
          d={LEFT_FOOT_OUTLINE}
          fill={props.color}
          stroke={BORDER_COLOR}
          strokeWidth={BORDER_STROKE_WIDTH}
          strokeOpacity={BORDER_OPACITY}
          paintOrder="stroke"
        />
        <path
          d={LEFT_FOOT_CREASE}
          fill="none"
          stroke={BORDER_COLOR}
          strokeWidth={CREASE_STROKE_WIDTH}
          strokeOpacity={BORDER_OPACITY}
        />
      </g>
    </svg>
  )
}
