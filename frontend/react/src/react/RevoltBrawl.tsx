import type { CSSProperties, JSX } from 'react'
import { publicAssetUrl } from '#assets/publicAssetUrl.ts'
import type { BoardRevoltEffect } from '#game/mapMoments.ts'
import { REVOLT_LEAD_IN_MS } from '#react/boardEffectTiming.ts'
import {
  CENTERED,
  centeredAt,
  MOMENT_CLASS_NAME,
  type MapMomentProps,
} from '#react/MapMomentEffects.tsx'
import { useKeyframeSteps, type KeyframeStep } from '#react/useKeyframes.ts'

const POP_EASING = 'cubic-bezier(0.34, 1.56, 0.64, 1)'


const BRAWL_POP_MS = 380
const BRAWL_THIN_MS = 500
const BRAWL_WIDTH_SHARE_OF_RADIUS = 2.6
const BRAWL_HEIGHT_SHARE_OF_RADIUS = 2
const BRAWL_SHAKE_PIXELS = 3
const BRAWL_SHAKE_MS = 320
const BRAWL_SHAKE_SWINGS = 6
const BRAWL_SHAKE_AT_MS: readonly number[] = [100, 500, 900]
const PUFF_WOBBLE_MS = 260
const PUFF_WOBBLE_STAGGER_MS = 30
const PUFF_WOBBLE_EXTRA_MS = 60
const PUFF_WOBBLE_KINDS = 3
const PUFF_WOBBLE_COUNT = 5
const FIST_JAB_AT_MS = 150
const FIST_JAB_STAGGER_MS = 70
const FIST_JAB_MS = 1200
const FIST_JABS = 6
const FIST_SWING_FORWARD_DEGREES = 28
const FIST_SWING_BACK_DEGREES = -18
const FIST_SHARE_OF_RADIUS = 0.45
const SPARK_AT_MS = 200
const SPARK_STAGGER_MS = 230
const SPARK_MS = 320
const SPARK_FLASHES = 2
const FIST_IMAGE_PATH = '/assets/tokens/alliance/fist.png'

/** A spot inside the brawl cloud, as % of its box. */
type BrawlSpot = { left: number; top: number }
/** Puff of the cloud: size as a share of the clearing radius. */
type BrawlPuff = BrawlSpot & { size: number }
/** A fist punching out of the cloud, turned to face out. */
type BrawlFist = BrawlSpot & { angle: number }

const BRAWL_PUFFS: readonly BrawlPuff[] = [
  { left: 50, top: 50, size: 1.15 },
  { left: 32, top: 48, size: 0.92 },
  { left: 68, top: 46, size: 0.92 },
  { left: 42, top: 30, size: 0.85 },
  { left: 60, top: 30, size: 0.77 },
  { left: 24, top: 62, size: 0.7 },
  { left: 76, top: 62, size: 0.77 },
  { left: 50, top: 70, size: 0.92 },
  { left: 36, top: 70, size: 0.7 },
  { left: 64, top: 72, size: 0.7 },
]
const BRAWL_FISTS: readonly BrawlFist[] = [
  { left: 18, top: 28, angle: -40 },
  { left: 84, top: 30, angle: 25 },
  { left: 86, top: 76, angle: 130 },
  { left: 14, top: 74, angle: -150 },
  { left: 52, top: 10, angle: 10 },
]
const BRAWL_SPARKS: readonly BrawlSpot[] = [
  { left: 30, top: 22 },
  { left: 74, top: 20 },
  { left: 80, top: 56 },
  { left: 20, top: 50 },
  { left: 58, top: 86 },
]
const BRAWL_PUFF_CLASS_NAME =
  'absolute [transform:translate(-50%,-50%)] rounded-full bg-[radial-gradient(circle_at_38%_35%,#f3ead2_0%,#ddcfa9_55%,#b9a77c_100%)] shadow-[inset_-6px_-8px_0_rgb(120_96_60/0.25)]'
const BRAWL_SPARK_CLASS_NAME =
  'absolute [transform:translate(-50%,-50%)] font-display text-3xl text-gold-light opacity-0 [text-shadow:0_0_3px_var(--color-ink),1px_1px_0_var(--color-ink)]'

function spotStyle(spot: BrawlSpot): CSSProperties {
  return { left: `${String(spot.left)}%`, top: `${String(spot.top)}%` }
}

function BrawlPuffView(props: { puff: BrawlPuff; index: number; radius: number }): JSX.Element {
  const puffRef = useKeyframeSteps([
    {
      keyframes: [
        { transform: `${CENTERED} scale(1)` },
        { transform: `${CENTERED} scale(1.14)` },
        { transform: `${CENTERED} scale(0.94)` },
        { transform: `${CENTERED} scale(1)` },
      ],
      options: {
        duration: PUFF_WOBBLE_MS + (props.index % PUFF_WOBBLE_KINDS) * PUFF_WOBBLE_EXTRA_MS,
        delay: props.index * PUFF_WOBBLE_STAGGER_MS,
        iterations: PUFF_WOBBLE_COUNT,
        easing: 'ease-in-out',
      },
    },
  ])
  const size: number = props.radius * props.puff.size
  return (
    <span
      ref={puffRef}
      className={BRAWL_PUFF_CLASS_NAME}
      style={{ ...spotStyle(props.puff), width: size, height: size }}
    />
  )
}

function fistTransform(angle: number, scale: number): string {
  return `${CENTERED} rotate(${String(angle)}deg) scale(${String(scale)})`
}

function BrawlFistView(props: { fist: BrawlFist; index: number; radius: number }): JSX.Element {
  const angle: number = props.fist.angle
  const fistRef = useKeyframeSteps([
    {
      keyframes: Array.from({ length: FIST_JABS + 1 }, (_, step: number) =>
        step % 2 === 0
          ? { transform: fistTransform(angle + FIST_SWING_BACK_DEGREES, 0.9) }
          : { transform: fistTransform(angle + FIST_SWING_FORWARD_DEGREES, 1.1) },
      ),
      options: {
        duration: FIST_JAB_MS,
        delay: FIST_JAB_AT_MS + props.index * FIST_JAB_STAGGER_MS,
        easing: 'ease-in-out',
      },
    },
  ])
  return (
    <div
      ref={fistRef}
      className="absolute -z-1 drop-shadow-[1px_2px_1px_rgb(0_0_0/0.5)]"
      style={{
        ...spotStyle(props.fist),
        width: props.radius * FIST_SHARE_OF_RADIUS,
        transform: fistTransform(angle, 1),
      }}
    >
      <img className="block w-full" src={publicAssetUrl(FIST_IMAGE_PATH)} alt="" />
    </div>
  )
}

function BrawlSparkView(props: { spark: BrawlSpot; index: number }): JSX.Element {
  const sparkRef = useKeyframeSteps([
    {
      keyframes: [
        { opacity: 0, transform: `${CENTERED} scale(0.3)` },
        { opacity: 1, transform: `${CENTERED} scale(1.3)`, offset: 0.4 },
        { opacity: 0, transform: `${CENTERED} scale(0.6)` },
      ],
      options: {
        duration: SPARK_MS,
        delay: SPARK_AT_MS + props.index * SPARK_STAGGER_MS,
        iterations: SPARK_FLASHES,
      },
    },
  ])
  return (
    <span ref={sparkRef} className={BRAWL_SPARK_CLASS_NAME} style={spotStyle(props.spark)}>
      ✶
    </span>
  )
}

function shakeStep(delayMs: number): KeyframeStep {
  return {
    keyframes: Array.from({ length: BRAWL_SHAKE_SWINGS + 1 }, (_, index: number) => {
      const horizontal: number =
        index === BRAWL_SHAKE_SWINGS
          ? 0
          : index % 2 === 0
            ? BRAWL_SHAKE_PIXELS
            : -BRAWL_SHAKE_PIXELS
      return { transform: `translateX(${String(horizontal)}px)` }
    }),
    options: { duration: BRAWL_SHAKE_MS, delay: delayMs, easing: 'linear' },
  }
}

/**
 * A cloud of dust swallows the clearing, Alliance fists punch out of it and
 * sparks fly; it thins out as the removed pieces drift away.
 */
export function RevoltMomentView(
  props: MapMomentProps<BoardRevoltEffect>,
): JSX.Element {
  const radius: number = props.center.radius
  const cloudRef = useKeyframeSteps([
    {
      keyframes: [
        { opacity: 0, transform: `${CENTERED} scale(0.2)` },
        { opacity: 1, transform: `${CENTERED} scale(1.08)`, offset: 0.7 },
        { opacity: 1, transform: `${CENTERED} scale(1)` },
      ],
      options: { duration: BRAWL_POP_MS, easing: POP_EASING, fill: 'both' },
    },
    {
      keyframes: [
        { opacity: 1, transform: `${CENTERED} scale(1)` },
        { opacity: 0, transform: `${CENTERED} scale(1.25)` },
      ],
      options: {
        duration: BRAWL_THIN_MS,
        delay: REVOLT_LEAD_IN_MS,
        easing: 'ease-in',
        fill: 'forwards',
      },
    },
  ])
  const shakeRef = useKeyframeSteps(BRAWL_SHAKE_AT_MS.map(shakeStep))
  return (
    <div
      className={MOMENT_CLASS_NAME}
      style={centeredAt(props.center.centerX, props.center.centerY)}
    >
      <div
        ref={cloudRef}
        className="absolute top-0 left-0 opacity-0"
        style={{
          width: radius * BRAWL_WIDTH_SHARE_OF_RADIUS,
          height: radius * BRAWL_HEIGHT_SHARE_OF_RADIUS,
        }}
      >
        <div ref={shakeRef} className="absolute inset-0 isolate">
          {BRAWL_FISTS.map((fist: BrawlFist, index: number) => (
            <BrawlFistView key={`fist-${String(index)}`} fist={fist} index={index} radius={radius} />
          ))}
          {BRAWL_PUFFS.map((puff: BrawlPuff, index: number) => (
            <BrawlPuffView key={`puff-${String(index)}`} puff={puff} index={index} radius={radius} />
          ))}
          {BRAWL_SPARKS.map((spark: BrawlSpot, index: number) => (
            <BrawlSparkView key={`spark-${String(index)}`} spark={spark} index={index} />
          ))}
        </div>
      </div>
    </div>
  )
}
