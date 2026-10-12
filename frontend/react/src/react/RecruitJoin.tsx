import type { JSX } from 'react'
import { RECRUIT_JOIN_MS, RECRUIT_WAIT_MS } from '#game/recruitJoin.ts'
import { MOVE_EASING } from '#react/boardEffectTiming.ts'
import { PieceStack } from '#react/PieceStack.tsx'
import { useKeyframes } from '#react/useKeyframes.ts'
import type { PieceStackViewModel } from '#ui/PieceView.ts'

/**
 * Recruits joining warriors already in the clearing: they appear beside the
 * stack, counted on their own, stand there a while, then walk into it; the
 * stack keeps its old count until they are in.
 */
export type RecruitJoinProps = {
  /** The warriors recruited, with their own count. */
  recruits: PieceStackViewModel
  /** The stack they join, as it stood before them. */
  standing: PieceStackViewModel
  clearingId: number
  /** Where the standing stack is drawn. */
  position: { left: number; top: number }
  /** Wait for the placements before this one. */
  delayMs: number
}

/** The recruits appear this far up and left of the stack they join. */
const RECRUIT_START_OFFSET_PIXELS = 20
/** Once in, the recruits melt into the stack for this long. */
const RECRUIT_MELT_MS = 150
const RECRUIT_EFFECT_MS = RECRUIT_JOIN_MS + RECRUIT_MELT_MS
/** Shares of the effect after which the recruits set off, and are in. */
const RECRUIT_SET_OFF_SHARE = RECRUIT_WAIT_MS / RECRUIT_EFFECT_MS
const RECRUIT_ARRIVAL_SHARE = RECRUIT_JOIN_MS / RECRUIT_EFFECT_MS
const START_TRANSFORM = `translate(${String(-RECRUIT_START_OFFSET_PIXELS)}px, ${String(-RECRUIT_START_OFFSET_PIXELS)}px)`
const ARRIVED_TRANSFORM = 'translate(0px, 0px)'

const WALK_KEYFRAMES: Keyframe[] = [
  { transform: START_TRANSFORM, opacity: 1 },
  {
    transform: START_TRANSFORM,
    opacity: 1,
    offset: RECRUIT_SET_OFF_SHARE,
    easing: MOVE_EASING,
  },
  { transform: ARRIVED_TRANSFORM, opacity: 1, offset: RECRUIT_ARRIVAL_SHARE },
  { transform: ARRIVED_TRANSFORM, opacity: 0 },
]
/** The old count stays on the stack for the whole walk, then gives way. */
const STANDING_KEYFRAMES: Keyframe[] = [
  { opacity: 1 },
  { opacity: 1, offset: RECRUIT_ARRIVAL_SHARE },
  { opacity: 0 },
]

export function RecruitJoin(props: RecruitJoinProps): JSX.Element {
  const walkRef = useKeyframes(WALK_KEYFRAMES, {
    duration: RECRUIT_EFFECT_MS,
    delay: props.delayMs,
    fill: 'forwards',
  })
  const standingRef = useKeyframes(STANDING_KEYFRAMES, {
    duration: RECRUIT_EFFECT_MS,
    delay: props.delayMs,
    fill: 'forwards',
  })
  return (
    <>
      <div ref={walkRef} className="absolute opacity-0" style={props.position}>
        <PieceStack
          stack={props.recruits}
          left={0}
          top={0}
          clearingId={props.clearingId}
        />
      </div>
      {/* Over the recruits: they walk in behind the warriors standing there. */}
      <div
        ref={standingRef}
        className="absolute opacity-0"
        style={props.position}
      >
        <PieceStack
          stack={props.standing}
          left={0}
          top={0}
          clearingId={props.clearingId}
        />
      </div>
    </>
  )
}
