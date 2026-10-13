import type { JSX } from 'react'
import { FootstepIcon, type Foot } from '#react/FootstepIcon.tsx'
import {
  marchArrivalShare,
  MOVE_EASING,
  type MarchTiming,
} from '#react/boardEffectTiming.ts'
import { PieceStack } from '#react/PieceStack.tsx'
import { useKeyframes } from '#react/useKeyframes.ts'
import type { PieceStackViewModel } from '#ui/PieceView.ts'

/**
 * A move on the map: its pieces walk in a line from their old stack to their
 * new one and leave footsteps in the colour of their faction.
 */
export type MarchPoint = {
  left: number
  top: number
}

export type MoveMarchProps = {
  /** One piece of the move (count 1). */
  stack: PieceStackViewModel
  clearingId: number
  from: MarchPoint
  to: MarchPoint
  timing: MarchTiming
  /** Wait for the moves before this one. */
  delayMs: number
  /** Faction colour of the footsteps, as CSS. */
  color: string
}

/** Distance along the way from a footstep to the next (the other foot). */
const FOOTSTEP_SPACING_PIXELS = 16
/** Left and right feet fall this far off the middle of the way. */
const FOOTSTEP_SIDE_PIXELS = 6
/** Heel to toe. */
const FOOTSTEP_HEIGHT_PIXELS = 17
const FOOTSTEP_OPACITY = 0.9
const FOOTSTEP_APPEAR_MS = 160
/** A long way is not paved with more footsteps than this. */
const FOOTSTEP_MAXIMUM_COUNT = 60
/** The footstep art points up: turn it to the way walked. */
const FOOTSTEP_ART_TURN_DEGREES = 90
const HALF = 0.5
const DEGREES_PER_RADIAN = 180 / Math.PI

type Footstep = MarchPoint & {
  /** Share of the way where it lies, 0..1. */
  wayShare: number
  foot: Foot
}

/** Footsteps along the way, left foot then right foot. */
function footstepsBetween(from: MarchPoint, to: MarchPoint): Footstep[] {
  const deltaX: number = to.left - from.left
  const deltaY: number = to.top - from.top
  const length: number = Math.hypot(deltaX, deltaY)
  if (length === 0) {
    return []
  }
  const count: number = Math.min(
    Math.floor(length / FOOTSTEP_SPACING_PIXELS),
    FOOTSTEP_MAXIMUM_COUNT,
  )
  // To the right of the way walked (the screen's y axis points down).
  const rightX: number = -deltaY / length
  const rightY: number = deltaX / length
  return Array.from({ length: count }, (_: undefined, index: number) => {
    const wayShare: number = (index + HALF) / count
    const foot: Foot = index % 2 === 0 ? 'left' : 'right'
    const side: number = (foot === 'right' ? 1 : -1) * FOOTSTEP_SIDE_PIXELS
    return {
      left: from.left + deltaX * wayShare + rightX * side,
      top: from.top + deltaY * wayShare + rightY * side,
      wayShare,
      foot,
    }
  })
}

type FootstepProps = {
  footstep: Footstep
  turnDegrees: number
  color: string
  /** When the first piece treads here. */
  delayMs: number
}

/** One footstep on the way, appearing as the first piece treads there. */
function FootstepView(props: FootstepProps): JSX.Element {
  const appearRef = useKeyframes(
    [{ opacity: 0 }, { opacity: FOOTSTEP_OPACITY }],
    { duration: FOOTSTEP_APPEAR_MS, delay: props.delayMs, fill: 'forwards' },
  )
  return (
    <div
      ref={appearRef}
      className="absolute opacity-0"
      style={{
        left: props.footstep.left,
        top: props.footstep.top,
        transform: `translate(-50%, -50%) rotate(${String(props.turnDegrees)}deg)`,
      }}
    >
      <FootstepIcon
        foot={props.footstep.foot}
        color={props.color}
        height={FOOTSTEP_HEIGHT_PIXELS}
      />
    </div>
  )
}

type MarcherProps = {
  stack: PieceStackViewModel
  clearingId: number
  from: MarchPoint
  to: MarchPoint
  travelMs: number
  /** Wait before setting off: earlier moves, then the pieces ahead in line. */
  delayMs: number
}

/** One piece of a move, marching from its old stack to its new one. */
function MarcherView(props: MarcherProps): JSX.Element {
  const deltaX: number = props.to.left - props.from.left
  const deltaY: number = props.to.top - props.from.top
  // Out of sight until it sets off, so the line leaves the stack one by one.
  const walkRef = useKeyframes(
    [
      { transform: 'translate(0px, 0px)', opacity: 1 },
      {
        transform: `translate(${String(deltaX)}px, ${String(deltaY)}px)`,
        opacity: 1,
      },
    ],
    {
      duration: props.travelMs,
      delay: props.delayMs,
      easing: MOVE_EASING,
      fill: 'forwards',
    },
  )
  return (
    <div ref={walkRef} className="absolute opacity-0" style={props.from}>
      <PieceStack
        stack={props.stack}
        left={0}
        top={0}
        clearingId={props.clearingId}
        hidesCount
      />
    </div>
  )
}

export function MoveMarch(props: MoveMarchProps): JSX.Element {
  const turnDegrees: number =
    Math.atan2(props.to.top - props.from.top, props.to.left - props.from.left) *
      DEGREES_PER_RADIAN +
    FOOTSTEP_ART_TURN_DEGREES
  return (
    <>
      {footstepsBetween(props.from, props.to).map(
        (footstep: Footstep, index: number): JSX.Element => (
          <FootstepView
            key={`footstep-${String(index)}`}
            footstep={footstep}
            turnDegrees={turnDegrees}
            color={props.color}
            delayMs={
              props.delayMs +
              marchArrivalShare(footstep.wayShare) * props.timing.travelMs
            }
          />
        ),
      )}
      {Array.from(
        { length: props.timing.pieceCount },
        (_: undefined, lineIndex: number): JSX.Element => (
          <MarcherView
            key={`marcher-${String(lineIndex)}`}
            stack={props.stack}
            clearingId={props.clearingId}
            from={props.from}
            to={props.to}
            travelMs={props.timing.travelMs}
            delayMs={props.delayMs + lineIndex * props.timing.stepMs}
          />
        ),
      )}
    </>
  )
}
