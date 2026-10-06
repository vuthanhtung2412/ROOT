import { useEffect, useRef, useState, type JSX, type RefObject } from 'react'
import { factionTextureKey, imagePathForAssetKey } from '#assets/gameAssets.ts'
import type {
  BoardBattleEffect,
  BoardEffect,
  BoardEffectBatch,
  BoardMoveEffect,
  BoardPlaceEffect,
  BoardRemoveEffect,
  BoardStackSlot,
} from '#game/boardEffects.ts'
import {
  batchLifetime,
  EFFECT_LIFETIME_MS,
  MOVE_LIFETIME_MS,
  MOVE_SLIDE_MS,
  moveStartDelay,
  placeStartDelay,
} from '#react/boardEffectTiming.ts'
import { factionColorForSeat } from '#game/theme.ts'
import { PieceStack, type ClearingHitCenter } from '#react/PieceStack.tsx'
import { stackOffsets, type PieceStackViewModel } from '#ui/PieceView.ts'

const MOVE_TRAIL_WIDTH_PIXELS = 2
const MOVE_TRAIL_OPACITY = 0.9
/** Dark line under the trail so it reads on any part of the map. */
const MOVE_TRAIL_BACKING_WIDTH_PIXELS = 5
const MOVE_TRAIL_BACKING_OPACITY = 0.55
const PULSE_MS = 900
const PULSE_REPEAT_COUNT = 3
/** Part of the lifetime an effect stays fully visible before it fades. */
const FADE_START_OFFSET = 0.75
const POP_MS = 450
/** How far a removed group drifts away. */
const SIGNED_DRIFT_PIXELS = 26
const PLACED_COLOR = '#2f8f4e'
const FALLBACK_FACTION_ID = 'marquise'
const REMOVED_COLOR = '#b3261e'
const BATTLE_COLOR = '#d43a2a'

/** Above the piece art (z-3), never behind it. */
const SIGN_BADGE_BASE_CLASS_NAME =
  'absolute z-4 flex items-center justify-center rounded-full font-mono leading-none font-bold text-white ring-1 ring-white'
/** Small, overlapping the top-right corner of the placed piece. */
const PLACED_SIGN_BADGE_CLASS_NAME = `${SIGN_BADGE_BASE_CLASS_NAME} -top-4 left-2.5 size-3 text-[10px]`
/** Off the top-left corner of the removed piece. */
const REMOVED_SIGN_BADGE_CLASS_NAME = `${SIGN_BADGE_BASE_CLASS_NAME} -top-6 -left-6 size-4 text-[13px]`
const BATTLE_BADGE_CLASS_NAME =
  'absolute flex -translate-x-1/2 -translate-y-1/2 flex-row items-center gap-1 rounded bg-ink-deep/85 px-1.5 py-0.5 text-[16px] text-white'

type ActiveEffect = {
  key: string
  effect: BoardEffect
}

export type BoardEffectPosition = {
  left: number
  top: number
}

type EffectContext = {
  factions: readonly string[]
  hitCenters: ReadonlyMap<number, ClearingHitCenter>
  /** Where a pawn stands in each forest (forest index → position). */
  forestCenters: ReadonlyMap<number, BoardEffectPosition>
}

function colorToCss(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`
}

function stackFor(
  effect: BoardMoveEffect | BoardPlaceEffect | BoardRemoveEffect,
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

/** Run a Web Animation on the element for as long as it is mounted. */
function useKeyframes(
  keyframes: Keyframe[],
  options: KeyframeAnimationOptions,
): RefObject<HTMLDivElement | null> {
  const elementRef = useRef<HTMLDivElement | null>(null)
  const keyframesRef = useRef<Keyframe[]>(keyframes)
  const optionsRef = useRef<KeyframeAnimationOptions>(options)
  useEffect(() => {
    const element = elementRef.current
    if (element === null || typeof element.animate !== 'function') {
      return undefined
    }
    const animation = element.animate(keyframesRef.current, optionsRef.current)
    return () => {
      animation.cancel()
    }
  }, [])
  return elementRef
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
/** A move waiting for the moves before it stays out of sight. */
const WAITING_EFFECT_CLASS_NAME = 'absolute inset-0 opacity-0'
const STARTED_EFFECT_CLASS_NAME = 'absolute inset-0'


type MoveEnd = {
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
  const center = context.hitCenters.get(end.clearing)
  return center === undefined ? undefined : stackPosition(center, end.slot)
}

function MoveEffectView(
  props: EffectContext & { effect: BoardMoveEffect },
): JSX.Element | null {
  const from = moveEndPosition(props, {
    clearing: props.effect.from,
    forest: props.effect.fromForest,
    slot: props.effect.fromSlot,
  })
  const to = moveEndPosition(props, {
    clearing: props.effect.to,
    forest: props.effect.toForest,
    slot: props.effect.toSlot,
  })
  const deltaX = (to?.left ?? 0) - (from?.left ?? 0)
  const deltaY = (to?.top ?? 0) - (from?.top ?? 0)
  const delay = moveStartDelay(props.effect)
  // A move is gone soon after the slide lands: a thin trail, no lingering.
  const fadeRef = useKeyframes(FADE_OUT_KEYFRAMES, {
    duration: MOVE_LIFETIME_MS,
    delay,
    fill: 'forwards',
  })
  const slideRef = useKeyframes(
    [
      { transform: 'translate(0px, 0px)' },
      { transform: `translate(${String(deltaX)}px, ${String(deltaY)}px)` },
    ],
    { duration: MOVE_SLIDE_MS, delay, easing: 'ease-in-out', fill: 'forwards' },
  )
  if (from === undefined || to === undefined) {
    return null
  }
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
      <svg
        className="absolute inset-0 overflow-visible"
        width="100%"
        height="100%"
        aria-hidden
      >
        <line
          x1={from.left}
          y1={from.top}
          x2={to.left}
          y2={to.top}
          stroke="var(--color-ink-deep)"
          strokeWidth={MOVE_TRAIL_BACKING_WIDTH_PIXELS}
          strokeLinecap="round"
          opacity={MOVE_TRAIL_BACKING_OPACITY}
        />
        <line
          x1={from.left}
          y1={from.top}
          x2={to.left}
          y2={to.top}
          stroke={color}
          strokeWidth={MOVE_TRAIL_WIDTH_PIXELS}
          strokeLinecap="round"
          strokeDasharray="4 6"
          opacity={MOVE_TRAIL_OPACITY}
        />
      </svg>
      <div
        ref={slideRef}
        className="absolute"
        style={from}
      >
        <PieceStack
          stack={stackFor(props.effect, props.factions)}
          left={0}
          top={0}
          clearingId={props.effect.to}
        />
      </div>
    </div>
  )
}

function PlaceEffectView(
  props: EffectContext & { effect: BoardPlaceEffect },
): JSX.Element | null {
  const center = props.hitCenters.get(props.effect.clearing)
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
  if (center === undefined) {
    return null
  }
  return (
    <div
      ref={fadeRef}
      className={
        delay > 0 ? WAITING_EFFECT_CLASS_NAME : STARTED_EFFECT_CLASS_NAME
      }
    >
      <div
        ref={popRef}
        className="absolute"
        style={stackPosition(center, props.effect.slot)}
      >
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

function RemoveEffectView(
  props: EffectContext & { effect: BoardRemoveEffect },
): JSX.Element | null {
  const center = props.hitCenters.get(props.effect.clearing)
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
  if (center === undefined) {
    return null
  }
  return (
    <div
      ref={driftRef}
      className="absolute"
      style={stackPosition(center, props.effect.slot)}
    >
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

function FactionIcon(props: {
  seat: number
  factions: readonly string[]
}): JSX.Element | null {
  const factionId = props.factions[props.seat] ?? FALLBACK_FACTION_ID
  const imagePath = imagePathForAssetKey(factionTextureKey(factionId))
  if (imagePath === null) {
    return null
  }
  return (
    <img
      className="block size-6 object-contain select-none"
      src={imagePath}
      alt={factionId}
      draggable={false}
    />
  )
}

function BattleEffectView(
  props: EffectContext & { effect: BoardBattleEffect },
): JSX.Element | null {
  const center = props.hitCenters.get(props.effect.clearing)
  const fadeRef = useKeyframes(FADE_OUT_KEYFRAMES, FADE_OUT_OPTIONS)
  const pulseRef = useKeyframes(
    [
      { transform: 'scale(0.85)', opacity: 1 },
      { transform: 'scale(1.3)', opacity: 0.15 },
    ],
    { duration: PULSE_MS, iterations: PULSE_REPEAT_COUNT, easing: 'ease-out' },
  )
  if (center === undefined) {
    return null
  }
  const diameter = center.radius * 2
  return (
    <div ref={fadeRef} className="absolute inset-0">
      <div
        ref={pulseRef}
        className="absolute rounded-full border-solid"
        style={{
          left: center.centerX - center.radius,
          top: center.centerY - center.radius,
          width: diameter,
          height: diameter,
          borderWidth: 5,
          borderColor: BATTLE_COLOR,
        }}
      />
      <div
        className={BATTLE_BADGE_CLASS_NAME}
        style={{ left: center.centerX, top: center.centerY }}
      >
        <FactionIcon seat={props.effect.attacker} factions={props.factions} />
        ⚔
        <FactionIcon seat={props.effect.defender} factions={props.factions} />
      </div>
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
 * move, placed pieces pop in, removed pieces drift away, a battle pulses.
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
        }
        if (entry.effect.kind === 'move') {
          return (
            <MoveEffectView key={entry.key} {...context} effect={entry.effect} />
          )
        }
        if (entry.effect.kind === 'place') {
          return (
            <PlaceEffectView key={entry.key} {...context} effect={entry.effect} />
          )
        }
        if (entry.effect.kind === 'remove') {
          return (
            <RemoveEffectView key={entry.key} {...context} effect={entry.effect} />
          )
        }
        return (
          <BattleEffectView key={entry.key} {...context} effect={entry.effect} />
        )
      })}
    </div>
  )
}
