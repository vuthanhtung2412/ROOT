import { useEffect, useRef, useState, type JSX } from 'react'
import type {
  BoardEffect,
  BoardEffectBatch,
  BoardMoveEffect,
  BoardPlaceEffect,
  BoardRemoveEffect,
  BoardStackSlot,
} from '#game/boardEffects.ts'
import {
  joinsStandingStack,
  joinsStandingWarriors,
} from '#game/recruitJoin.ts'
import {
  batchLifetime,
  EFFECT_LIFETIME_MS,
  marchTiming,
  MOVE_LIFETIME_MS,
  MOVE_SLIDE_MS,
  moveStartDelay,
  type MarchTiming,
  placeStartDelay,
} from '#react/boardEffectTiming.ts'
import { factionColorForSeat } from '#game/theme.ts'
import { MoveMarch } from '#react/MoveMarch.tsx'
import { PieceStack, type ClearingHitCenter } from '#react/PieceStack.tsx'
import { RecruitJoin } from '#react/RecruitJoin.tsx'
import { useKeyframes } from '#react/useKeyframes.ts'
import { stackOffsets, type PieceStackViewModel } from '#ui/PieceView.ts'

/** Part of the lifetime an effect stays fully visible before it fades. */
const FADE_START_OFFSET = 0.75
const POP_MS = 450
/** How far a removed group drifts away. */
const SIGNED_DRIFT_PIXELS = 26
const PLACED_COLOR = '#2f8f4e'
const FALLBACK_FACTION_ID = 'marquise'
const REMOVED_COLOR = '#b3261e'

/** Above the piece art (z-3), never behind it. */
const SIGN_BADGE_BASE_CLASS_NAME =
  'absolute z-4 flex items-center justify-center rounded-full font-mono leading-none font-bold text-white ring-1 ring-white'
/** Small, overlapping the top-right corner of the placed piece. */
const PLACED_SIGN_BADGE_CLASS_NAME = `${SIGN_BADGE_BASE_CLASS_NAME} -top-4 left-2.5 size-3 text-[10px]`
/** Off the top-left corner of the removed piece. */
const REMOVED_SIGN_BADGE_CLASS_NAME = `${SIGN_BADGE_BASE_CLASS_NAME} -top-6 -left-6 size-4 text-[13px]`

type ActiveEffect = {
  key: string
  effect: BoardEffect
}

export type BoardEffectPosition = {
  left: number
  top: number
}

/** A stack of a clearing, as an effect names it. */
export type BoardEffectStack = {
  clearing: number
  owner: number
  pieceKind: string
  pieceType: string | undefined
}

type EffectContext = {
  factions: readonly string[]
  hitCenters: ReadonlyMap<number, ClearingHitCenter>
  /** Where a pawn stands in each forest (forest index → position). */
  forestCenters: ReadonlyMap<number, BoardEffectPosition>
  /**
   * Where the map itself draws a stack, when it does not lay its stacks out
   * by slot (the 3D map); undefined for a stack it does not know.
   */
  stackPositionOf?:
    | ((stack: BoardEffectStack) => BoardEffectPosition | undefined)
    | undefined
  /** How many pieces that map draws in a stack now; 0 when it draws none. */
  stackCountOf?: ((stack: BoardEffectStack) => number) | undefined
}

type PieceEffect = BoardMoveEffect | BoardPlaceEffect | BoardRemoveEffect

function colorToCss(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`
}

function stackFor(
  effect: PieceEffect,
  factions: readonly string[],
): PieceStackViewModel {
  const stack: PieceStackViewModel = {
    owner: effect.owner,
    factionId: factions[effect.owner] ?? FALLBACK_FACTION_ID,
    kind: effect.pieceKind,
    count: effect.count,
    color: factionColorForSeat(effect.owner, factions),
    sampleIds: [],
  }
  return effect.pieceType === undefined
    ? stack
    : { ...stack, type: effect.pieceType }
}

/**
 * Centre of a group's stack inside its clearing — the spot the board itself
 * draws that stack at, so the animation plays on the pieces.
 */
function stackPosition(
  center: ClearingHitCenter,
  slot: BoardStackSlot,
): { left: number; top: number } {
  const offset = stackOffsets(slot.total)[slot.index] ?? { x: 0, y: 0 }
  return { left: center.centerX + offset.x, top: center.centerY + offset.y }
}

/** The stack of an effect's pieces in a clearing. */
function effectStack(effect: PieceEffect, clearing: number): BoardEffectStack {
  return {
    clearing,
    owner: effect.owner,
    pieceKind: effect.pieceKind,
    pieceType: effect.pieceType,
  }
}

type StackPlace = {
  effect: PieceEffect
  clearing: number
  slot: BoardStackSlot
}

/** Where the stack of an effect is drawn: by the map itself, else by slot. */
function stackPositionIn(
  context: EffectContext,
  place: StackPlace,
): BoardEffectPosition | undefined {
  const drawn: BoardEffectPosition | undefined = context.stackPositionOf?.(
    effectStack(place.effect, place.clearing),
  )
  if (drawn !== undefined) {
    return drawn
  }
  const center: ClearingHitCenter | undefined = context.hitCenters.get(
    place.clearing,
  )
  return center === undefined ? undefined : stackPosition(center, place.slot)
}

const FADE_OUT_KEYFRAMES: Keyframe[] = [
  { opacity: 1 },
  { opacity: 1, offset: FADE_START_OFFSET },
  { opacity: 0 },
]
const FADE_OUT_OPTIONS: KeyframeAnimationOptions = {
  duration: EFFECT_LIFETIME_MS,
  fill: 'forwards',
}
/** A move stays whole until its last piece has landed, then fades. */
const MOVE_FADE_OUT_KEYFRAMES: Keyframe[] = [
  { opacity: 1 },
  { opacity: 1, offset: MOVE_SLIDE_MS / MOVE_LIFETIME_MS },
  { opacity: 0 },
]
/** A move waiting for the moves before it stays out of sight. */
const WAITING_EFFECT_CLASS_NAME = 'absolute inset-0 opacity-0'
const STARTED_EFFECT_CLASS_NAME = 'absolute inset-0'


type MoveEnd = {
  effect: BoardMoveEffect
  clearing: number
  /** Set when the end is a forest: the clearing is then unused. */
  forest: number | undefined
  slot: BoardStackSlot
}

/** Where one end of a move is drawn: a forest centre, else a clearing stack. */
function moveEndPosition(
  context: EffectContext,
  end: MoveEnd,
): BoardEffectPosition | undefined {
  if (end.forest !== undefined) {
    return context.forestCenters.get(end.forest)
  }
  return stackPositionIn(context, end)
}

function MoveEffectView(
  props: EffectContext & { effect: BoardMoveEffect },
): JSX.Element | null {
  const from = moveEndPosition(props, {
    effect: props.effect,
    clearing: props.effect.from,
    forest: props.effect.fromForest,
    slot: props.effect.fromSlot,
  })
  const to = moveEndPosition(props, {
    effect: props.effect,
    clearing: props.effect.to,
    forest: props.effect.toForest,
    slot: props.effect.toSlot,
  })
  const delay = moveStartDelay(props.effect)
  // A move is gone soon after the last piece lands: a thin trail, no lingering.
  const fadeRef = useKeyframes(MOVE_FADE_OUT_KEYFRAMES, {
    duration: MOVE_LIFETIME_MS,
    delay,
    fill: 'forwards',
  })
  if (from === undefined || to === undefined) {
    return null
  }
  const timing: MarchTiming = marchTiming(props.effect.count)
  const marcherStack: PieceStackViewModel = {
    ...stackFor(props.effect, props.factions),
    count: 1,
  }
  // Pieces of its kind already stood there: the newcomers walk in behind them.
  // They are held off the board for the walk, so the map draws the old count.
  const standingCount: number = joinsStandingStack(props.effect)
    ? (props.stackCountOf?.(effectStack(props.effect, props.effect.to)) ?? 0)
    : 0
  const color = colorToCss(
    factionColorForSeat(props.effect.owner, props.factions),
  )
  return (
    <div
      ref={fadeRef}
      className={
        delay > 0 ? WAITING_EFFECT_CLASS_NAME : STARTED_EFFECT_CLASS_NAME
      }
    >
      <MoveMarch
        stack={marcherStack}
        clearingId={props.effect.to}
        from={from}
        to={to}
        timing={timing}
        delayMs={delay}
        color={color}
      />
      {standingCount > 0 ? (
        <div className="absolute" style={to}>
          <PieceStack
            stack={{ ...marcherStack, count: standingCount }}
            left={0}
            top={0}
            clearingId={props.effect.to}
          />
        </div>
      ) : null}
    </div>
  )
}

function PlaceEffectView(
  props: EffectContext & { effect: BoardPlaceEffect },
): JSX.Element | null {
  const position: BoardEffectPosition | undefined = stackPositionIn(props, {
    effect: props.effect,
    clearing: props.effect.clearing,
    slot: props.effect.slot,
  })
  const delay = placeStartDelay(props.effect)
  const fadeRef = useKeyframes(FADE_OUT_KEYFRAMES, {
    ...FADE_OUT_OPTIONS,
    delay,
  })
  const popRef = useKeyframes(
    [
      { transform: 'scale(0)' },
      { transform: 'scale(1.5)', offset: 0.7 },
      { transform: 'scale(1.2)' },
    ],
    { duration: POP_MS, delay, easing: 'ease-out', fill: 'forwards' },
  )
  if (position === undefined) {
    return null
  }
  return (
    <div
      ref={fadeRef}
      className={
        delay > 0 ? WAITING_EFFECT_CLASS_NAME : STARTED_EFFECT_CLASS_NAME
      }
    >
      <div ref={popRef} className="absolute" style={position}>
        {/* Shows the stack's new size, so it sits exactly on the real count. */}
        <PieceStack
          stack={{
            ...stackFor(props.effect, props.factions),
            count: props.effect.stackCount,
          }}
          left={0}
          top={0}
          clearingId={props.effect.clearing}
        />
        <span
          className={PLACED_SIGN_BADGE_CLASS_NAME}
          style={{ background: PLACED_COLOR }}
        >
          +
        </span>
      </div>
    </div>
  )
}

/** Recruits walking up to the warriors of theirs already in the clearing. */
function JoinEffectView(
  props: EffectContext & { effect: BoardPlaceEffect },
): JSX.Element | null {
  const position: BoardEffectPosition | undefined = stackPositionIn(props, {
    effect: props.effect,
    clearing: props.effect.clearing,
    slot: props.effect.slot,
  })
  if (position === undefined) {
    return null
  }
  const recruits: PieceStackViewModel = stackFor(props.effect, props.factions)
  return (
    <RecruitJoin
      recruits={recruits}
      standing={{
        ...recruits,
        count: props.effect.stackCount - props.effect.count,
      }}
      clearingId={props.effect.clearing}
      position={position}
      delayMs={placeStartDelay(props.effect)}
    />
  )
}

function RemoveEffectView(
  props: EffectContext & { effect: BoardRemoveEffect },
): JSX.Element | null {
  const position: BoardEffectPosition | undefined = stackPositionIn(props, {
    effect: props.effect,
    clearing: props.effect.clearing,
    slot: props.effect.slot,
  })
  const driftRef = useKeyframes(
    [
      { transform: 'translateY(0px) scale(1.2)', opacity: 1 },
      { opacity: 1, offset: FADE_START_OFFSET },
      {
        transform: `translateY(${String(-SIGNED_DRIFT_PIXELS)}px) scale(1.2)`,
        opacity: 0,
      },
    ],
    { duration: EFFECT_LIFETIME_MS, easing: 'ease-out', fill: 'forwards' },
  )
  if (position === undefined) {
    return null
  }
  return (
    <div ref={driftRef} className="absolute" style={position}>
      <div className="grayscale">
        <PieceStack
          stack={stackFor(props.effect, props.factions)}
          left={0}
          top={0}
          clearingId={props.effect.clearing}
        />
      </div>
      <span
        className={REMOVED_SIGN_BADGE_CLASS_NAME}
        style={{ background: REMOVED_COLOR }}
      >
        −
      </span>
    </div>
  )
}

function activate(batch: BoardEffectBatch): ActiveEffect[] {
  return batch.effects.map(
    (effect: BoardEffect, index: number): ActiveEffect => ({
      key: `${String(batch.sequence)}-${String(index)}`,
      effect,
    }),
  )
}

export type BoardEffectsLayerProps = EffectContext & {
  batch: BoardEffectBatch
}

/**
 * Plays what the last server update did on the map: pieces slide along their
 * move, placed pieces pop in, removed pieces drift away.
 */
export function BoardEffectsLayer(props: BoardEffectsLayerProps): JSX.Element {
  const [active, setActive] = useState<ActiveEffect[]>([])
  // A batch already on screen when the map mounts is old news: do not replay it.
  const seenSequenceRef = useRef<number>(props.batch.sequence)
  const timersRef = useRef<Set<number>>(new Set<number>())
  const batch = props.batch

  useEffect(() => {
    if (batch.sequence === seenSequenceRef.current) {
      return
    }
    seenSequenceRef.current = batch.sequence
    const started = activate(batch)
    const startedKeys = new Set(started.map((entry: ActiveEffect) => entry.key))
    setActive((current: ActiveEffect[]) => [...current, ...started])
    // Each batch ends on its own timer: a newer batch must not cut it short.
    const timer = window.setTimeout(() => {
      timersRef.current.delete(timer)
      setActive((current: ActiveEffect[]) =>
        current.filter((entry: ActiveEffect) => !startedKeys.has(entry.key)),
      )
    }, batchLifetime(batch))
    timersRef.current.add(timer)
  }, [batch])

  useEffect(() => {
    const timers = timersRef.current
    return () => {
      for (const timer of timers) {
        window.clearTimeout(timer)
      }
      timers.clear()
    }
  }, [])

  return (
    <div className="board-effects pointer-events-none absolute inset-0 z-6">
      {active.map((entry: ActiveEffect) => {
        const context: EffectContext = {
          factions: props.factions,
          hitCenters: props.hitCenters,
          forestCenters: props.forestCenters,
          stackPositionOf: props.stackPositionOf,
          stackCountOf: props.stackCountOf,
        }
        if (entry.effect.kind === 'move') {
          return (
            <MoveEffectView key={entry.key} {...context} effect={entry.effect} />
          )
        }
        if (entry.effect.kind === 'place') {
          return joinsStandingWarriors(entry.effect) ? (
            <JoinEffectView key={entry.key} {...context} effect={entry.effect} />
          ) : (
            <PlaceEffectView key={entry.key} {...context} effect={entry.effect} />
          )
        }
        if (entry.effect.kind === 'remove') {
          return (
            <RemoveEffectView key={entry.key} {...context} effect={entry.effect} />
          )
        }
        // A battle is told by the badge on its clearing (BattleClearingBadge).
        return null
      })}
    </div>
  )
}
