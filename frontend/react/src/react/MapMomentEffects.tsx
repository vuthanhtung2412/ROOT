import type { CSSProperties, JSX } from 'react'
import {
  GAME_ASSET_KEYS,
  imagePathForAssetKey,
  itemTextureKey,
} from '#assets/gameAssets.ts'
import type { BoardExploreEffect } from '#game/mapMoments.ts'
import { PIECE_DRAW } from '#game/theme.ts'
import type { BoardEffectPosition } from '#react/BoardEffectsLayer.tsx'
import type { ClearingHitCenter } from '#react/PieceStack.tsx'
import { useMomentKeyframeSteps, type KeyframeStep } from '#react/useKeyframes.ts'

/** Smooth stop, used by most beats of the moments. */
const SETTLE_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)'
export const CENTERED = 'translate(-50%, -50%)'
/** Above the pieces and the other effects of the layer. */
export const MOMENT_CLASS_NAME = 'pointer-events-none absolute z-7'
const CENTERED_PART_CLASS_NAME =
  'absolute top-0 left-0 opacity-0 [transform:translate(-50%,-50%)]'
const DUST_COLOR = '#e7d8b4'
const CRUMBLE_DUST_COLOR = '#bfb08c'
const FLOATING_TEXT_CLASS_NAME =
  'absolute top-0 left-0 font-display text-2xl text-gold-light opacity-0 [text-shadow:0_0_6px_rgb(0_0_0/0.9),1px_1px_0_var(--color-ink)]'
const GLINT_CLASS_NAME =
  'absolute top-0 left-0 rounded-full opacity-0 [mask:radial-gradient(circle,#000_20%,transparent_70%)] bg-[conic-gradient(from_0deg,transparent_0_8%,rgb(251_233_168/0.75)_10%,transparent_14%_33%,rgb(251_233_168/0.6)_35%,transparent_39%_58%,rgb(251_233_168/0.75)_60%,transparent_64%_83%,rgb(251_233_168/0.6)_85%,transparent_89%)]'

export function centeredAt(left: number, top: number): CSSProperties {
  return { left, top }
}

// ---------- Dust ----------

const DUST_PUFF_MS = 700
/** Turn between two dots: the golden angle spreads them evenly. */
const DUST_TURN_RADIANS = Math.PI * (3 - Math.sqrt(5))
/** Dots fly out flatter than they fly up: the map is seen from above. */
const DUST_VERTICAL_SQUASH = 0.7
const DUST_DOT_SHARE_OF_RADIUS = 0.12
const DUST_SPREAD_SHARE_OF_RADIUS = 0.8
const DUST_START_SCALE = 0.6
const DUST_END_SCALE = 2.2
const DUST_START_OPACITY = 0.9

type DustBurstProps = {
  radius: number
  delayMs: number
  count: number
  color: string
}

function DustDot(props: DustBurstProps & { index: number }): JSX.Element {
  const angle: number = props.index * DUST_TURN_RADIANS
  const distance: number = props.radius * DUST_SPREAD_SHARE_OF_RADIUS
  const dotRef = useMomentKeyframeSteps([
    {
      keyframes: [
        {
          opacity: DUST_START_OPACITY,
          transform: `${CENTERED} scale(${String(DUST_START_SCALE)})`,
        },
        {
          opacity: 0,
          transform: `translate(calc(-50% + ${String(Math.cos(angle) * distance)}px), calc(-50% + ${String(Math.sin(angle) * distance * DUST_VERTICAL_SQUASH)}px)) scale(${String(DUST_END_SCALE)})`,
        },
      ],
      options: {
        duration: DUST_PUFF_MS,
        delay: props.delayMs,
        easing: SETTLE_EASING,
        fill: 'both',
      },
    },
  ])
  const size: number = props.radius * DUST_DOT_SHARE_OF_RADIUS
  return (
    <div
      ref={dotRef}
      className="absolute top-0 left-0 rounded-full opacity-0"
      style={{ width: size, height: size, background: props.color }}
    />
  )
}

function DustBurst(props: DustBurstProps): JSX.Element {
  return (
    <>
      {Array.from({ length: props.count }, (_, index: number) => (
        <DustDot key={index} {...props} index={index} />
      ))}
    </>
  )
}

// ---------- Explore ----------

/** Beats of an explore, from the update arriving (ms). */
const RUIN_RATTLE_AT_MS = 450
const RUIN_RATTLE_MS = 480
const RUIN_RATTLE_DEGREES = 5
const RATTLE_SWINGS = 7
const ITEM_RISE_AT_MS = 950
const ITEM_RISE_MS = 800
const GLINT_MS = 1100
const ITEM_FADE_AT_MS = 1750
const ITEM_FADE_MS = 350
const RUIN_CRUMBLE_MS = 700
const CRUMBLE_DUST_AT_MS = 1900
const RATTLE_DUST_AT_MS = 520
const RATTLE_DUST_COUNT = 7
const CRUMBLE_DUST_COUNT = 9
const VICTORY_POINT_AT_MS = 2100
const FLOATING_TEXT_MS = 1100
/**
 * The ruin keeps the size the map draws it at; the rest is sized off it:
 * the item, its glint, how high it rises and how far the dust flies.
 */
const RUIN_SIZE: number = PIECE_DRAW.buildingIconSize
const ITEM_SHARE_OF_RUIN = 0.9
const GLINT_SHARE_OF_RUIN = 2
const ITEM_RISE_SHARE_OF_RUIN = 1.1
const DUST_REACH_SHARE_OF_RUIN = 1.2
const VICTORY_POINT_SHARE_OF_RUIN = 0.6
/** The crumbled ruin settles this far into the ground as it fades. */
const RUIN_SINK_PIXELS = 6

function rattleKeyframes(): Keyframe[] {
  return Array.from({ length: RATTLE_SWINGS + 1 }, (_, index: number) => {
    const swing: number =
      index === RATTLE_SWINGS
        ? 0
        : index % 2 === 0
          ? RUIN_RATTLE_DEGREES
          : -RUIN_RATTLE_DEGREES
    return { transform: `${CENTERED} rotate(${String(swing)}deg)` }
  })
}

function ruinSteps(): KeyframeStep[] {
  return [
    {
      keyframes: [{ opacity: 1 }, { opacity: 1 }],
      options: { duration: RUIN_RATTLE_AT_MS, fill: 'forwards' },
    },
    {
      keyframes: rattleKeyframes(),
      options: { duration: RUIN_RATTLE_MS, delay: RUIN_RATTLE_AT_MS },
    },
    {
      // Greys out and fades where it stands: never bigger or smaller.
      keyframes: [
        { opacity: 1, transform: CENTERED, filter: 'none' },
        {
          opacity: 1,
          transform: CENTERED,
          filter: 'grayscale(1) brightness(0.8)',
          offset: 0.3,
        },
        {
          opacity: 0,
          transform: `translate(-50%, calc(-50% + ${String(RUIN_SINK_PIXELS)}px))`,
          filter: 'grayscale(1) brightness(0.6)',
        },
      ],
      options: {
        duration: RUIN_CRUMBLE_MS,
        delay: ITEM_FADE_AT_MS,
        easing: 'ease-in',
        fill: 'forwards',
      },
    },
  ]
}

function itemSteps(riseHeight: number): KeyframeStep[] {
  const risen = `translate(-50%, calc(-50% - ${String(riseHeight)}px))`
  return [
    {
      keyframes: [
        { opacity: 0, transform: `${CENTERED} scale(0.3)` },
        { opacity: 1, transform: `${risen} scale(1.35)`, offset: 0.6 },
        { opacity: 1, transform: `${risen} scale(1.2)` },
      ],
      options: {
        duration: ITEM_RISE_MS,
        delay: ITEM_RISE_AT_MS,
        easing: SETTLE_EASING,
        fill: 'both',
      },
    },
    {
      keyframes: [
        { opacity: 1, transform: `${risen} scale(1.2)` },
        { opacity: 0, transform: `${risen} translateY(-8px) scale(0.9)` },
      ],
      options: {
        duration: ITEM_FADE_MS,
        delay: ITEM_FADE_AT_MS,
        easing: 'ease-in',
        fill: 'forwards',
      },
    },
  ]
}

function glintSteps(riseHeight: number): KeyframeStep[] {
  const risen = `translate(-50%, calc(-50% - ${String(riseHeight)}px))`
  return [
    {
      keyframes: [
        { opacity: 0, transform: `${CENTERED} rotate(0deg) scale(0.4)` },
        { opacity: 1, transform: `${risen} rotate(90deg) scale(1.1)`, offset: 0.5 },
        { opacity: 0, transform: `${risen} rotate(220deg) scale(1.3)` },
      ],
      options: {
        duration: GLINT_MS,
        delay: ITEM_RISE_AT_MS,
        easing: 'ease-out',
        fill: 'both',
      },
    },
  ]
}

type FloatingTextProps = {
  text: string
  delayMs: number
  left: number
  top: number
}

/** A score change floating up off the map, then gone. */
export function FloatingText(props: FloatingTextProps): JSX.Element {
  const textRef = useMomentKeyframeSteps([
    {
      keyframes: [
        { opacity: 0, transform: 'translate(-50%, -20%) scale(0.6)' },
        { opacity: 1, transform: 'translate(-50%, -80%) scale(1.15)', offset: 0.25 },
        { opacity: 1, transform: 'translate(-50%, -130%) scale(1)', offset: 0.7 },
        { opacity: 0, transform: 'translate(-50%, -180%) scale(1)' },
      ],
      options: {
        duration: FLOATING_TEXT_MS,
        delay: props.delayMs,
        easing: 'ease-out',
        fill: 'both',
      },
    },
  ])
  return (
    <div
      ref={textRef}
      className={FLOATING_TEXT_CLASS_NAME}
      style={centeredAt(props.left, props.top)}
    >
      {props.text}
    </div>
  )
}

export type MapMomentProps<Effect> = {
  effect: Effect
  center: ClearingHitCenter
}

export type ExploreMomentProps = {
  effect: BoardExploreEffect
  /** Where the map draws the ruin icon, in its building slot. */
  ruin: BoardEffectPosition
}

/**
 * The ruin rattles in its slot, its item rises with a glint and fades, then
 * the emptied ruin greys out and fades in a puff of dust and +1 floats off.
 */
export function ExploreMomentView(props: ExploreMomentProps): JSX.Element {
  const riseHeight: number = RUIN_SIZE * ITEM_RISE_SHARE_OF_RUIN
  const dustReach: number = RUIN_SIZE * DUST_REACH_SHARE_OF_RUIN
  const ruinRef = useMomentKeyframeSteps(ruinSteps())
  const itemRef = useMomentKeyframeSteps(itemSteps(riseHeight))
  const glintRef = useMomentKeyframeSteps(glintSteps(riseHeight))
  const ruinPath: string | null = imagePathForAssetKey(GAME_ASSET_KEYS.markerRuin)
  const itemKey: string | null = itemTextureKey(props.effect.itemType)
  const itemPath: string | null =
    itemKey === null ? null : imagePathForAssetKey(itemKey)
  const itemSize: number = RUIN_SIZE * ITEM_SHARE_OF_RUIN
  const glintSize: number = RUIN_SIZE * GLINT_SHARE_OF_RUIN
  return (
    <div
      className={MOMENT_CLASS_NAME}
      style={centeredAt(props.ruin.left, props.ruin.top)}
    >
      {ruinPath !== null ? (
        <div
          ref={ruinRef}
          className={CENTERED_PART_CLASS_NAME}
          style={{ width: RUIN_SIZE, height: RUIN_SIZE }}
        >
          <img className="block size-full object-fill" src={ruinPath} alt="" />
        </div>
      ) : null}
      <DustBurst
        radius={dustReach}
        delayMs={RATTLE_DUST_AT_MS}
        count={RATTLE_DUST_COUNT}
        color={DUST_COLOR}
      />
      <div
        ref={glintRef}
        className={GLINT_CLASS_NAME}
        style={{ width: glintSize, height: glintSize }}
      />
      {itemPath !== null ? (
        <div
          ref={itemRef}
          className={`${CENTERED_PART_CLASS_NAME} drop-shadow-[0_0_8px_rgb(251_233_168/0.9)]`}
          style={{ width: itemSize }}
        >
          <img className="block w-full" src={itemPath} alt="" />
        </div>
      ) : null}
      <DustBurst
        radius={dustReach}
        delayMs={CRUMBLE_DUST_AT_MS}
        count={CRUMBLE_DUST_COUNT}
        color={CRUMBLE_DUST_COLOR}
      />
      <FloatingText
        text="+1"
        delayMs={VICTORY_POINT_AT_MS}
        left={0}
        top={-RUIN_SIZE * VICTORY_POINT_SHARE_OF_RUIN}
      />
    </div>
  )
}

