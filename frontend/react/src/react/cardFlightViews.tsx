import { useEffect, useRef, type JSX, type RefObject } from 'react'
import {
  GiAnvil,
  GiFlatHammer,
  GiPolarStar,
} from 'react-icons/gi'
import { publicAssetUrl } from '#assets/publicAssetUrl.ts'
import type { CardFlight, CardFlightReason } from '#game/cardFlights.ts'

/** Several cards of one update start one after the other. */
export const FLIGHT_STAGGER_MS = 450
/** The card rests in the middle long enough to be read. */
const HOLD_MS = 1300
const FADE_MS = 350

/** Reveal: face down from the rail tile, a beat, then the flip. */
const REVEAL_TRAVEL_MS = 650
const REVEAL_PAUSE_MS = 200
const REVEAL_FLIP_MS = 450
const REVEAL_FLIP_START_MS = REVEAL_TRAVEL_MS + REVEAL_PAUSE_MS
const REVEAL_FLIP_END_MS = REVEAL_FLIP_START_MS + REVEAL_FLIP_MS
const REVEAL_LIFETIME_MS = REVEAL_FLIP_END_MS + HOLD_MS + FADE_MS
const FACE_DOWN_TRANSFORM = 'perspective(900px) rotateY(180deg)'
const FACE_UP_TRANSFORM = 'perspective(900px) rotateY(0deg)'

/**
 * Craft: the anvil comes from the rail tile, the hammer strikes it three
 * times (a fast fall, a slower lift), the card pops out.
 */
const CRAFT_TRAVEL_MS = 500
const CRAFT_STRIKE_FALL_MS = 110
const CRAFT_STRIKE_LIFT_MS = 230
const CRAFT_STRIKE_MS = CRAFT_STRIKE_FALL_MS + CRAFT_STRIKE_LIFT_MS
const CRAFT_STRIKE_COUNT = 3
const CRAFT_FORGED_MS = CRAFT_TRAVEL_MS + CRAFT_STRIKE_COUNT * CRAFT_STRIKE_MS
const CRAFT_POP_MS = 240
const CRAFT_SETTLE_MS = 110
const CRAFT_POPPED_MS = CRAFT_FORGED_MS + CRAFT_POP_MS
const CRAFT_SETTLED_MS = CRAFT_POPPED_MS + CRAFT_SETTLE_MS
const CRAFT_LIFETIME_MS = CRAFT_SETTLED_MS + HOLD_MS + FADE_MS
const HAMMER_RAISED_TRANSFORM = 'rotate(62deg)'
const HAMMER_STRUCK_TRANSFORM = 'rotate(0deg)'
/** The anvil gives under a blow, then springs back. */
const ANVIL_STILL_TRANSFORM = 'translateY(0px) scale(1, 1)'
const ANVIL_STRUCK_TRANSFORM = 'translateY(5px) scale(1.06, 0.9)'
const ANVIL_JOLT_MS = 40
const ANVIL_RECOVER_MS = 150
/** Sparks burst from the blow and are gone before the next one. */
const SPARK_LIFETIME_MS = 220
const SPARK_START_SCALE = 0.3
const SPARK_END_SCALE = 1.6
/** Each burst is turned a little so the blows do not look stamped. */
const SPARK_TURN_DEGREES = 50
/** The smallest step between two keyframes: an instant change. */
const INSTANT_MS = 1

/** Moment the hammer lands for a strike (0 = first). */
function strikeImpactMs(strike: number): number {
  return CRAFT_TRAVEL_MS + strike * CRAFT_STRIKE_MS + CRAFT_STRIKE_FALL_MS
}

const STRIKES: readonly number[] = Array.from(
  { length: CRAFT_STRIKE_COUNT },
  (_unused: undefined, strike: number): number => strike,
)

/**
 * Buy: out of the seller's rail tile, a second in the middle, then on to the
 * buyer's rail tile, gone as it lands.
 */
export const BUY_TRAVEL_MS = 650
export const BUY_HOLD_MS = 1000
export const BUY_LEAVE_MS = 650
export const BUY_LIFETIME_MS = BUY_TRAVEL_MS + BUY_HOLD_MS + BUY_LEAVE_MS

/** Size leaving the rail tile, against the resting size. */
export const START_SCALE = 0.2
const CARD_POP_START_SCALE = 0.1
const CARD_POP_OVERSHOOT_SCALE = 1.08
const ANVIL_GONE_SCALE = 0.6
/** Later cards of one update rest a little to the right of the one before. */
const FAN_OFFSET_PIXELS = 36
const HALF = 0.5

const FLIGHT_BASE_CLASS_NAME =
  'pointer-events-none fixed top-0 left-0 z-250 opacity-0 select-none'
export const CARD_FRAME_CLASS_NAME = `card-flight ${FLIGHT_BASE_CLASS_NAME} h-77.5 w-55`
export const CARD_FACE_CLASS_NAME =
  'absolute inset-0 block size-full rounded-md border-3 border-ink-deep object-fill shadow-card backface-hidden'
/** The whole back as printed, white margin included, framed like the face. */
const CARD_BACK_CLASS_NAME = `${CARD_FACE_CLASS_NAME} rotate-y-180`
/**
 * Back of the shared deck (Exiles & Partisans). The base game back sits
 * beside it as `card-back-base.webp`.
 */
const CARD_BACK_IMAGE_PATH: string = publicAssetUrl('assets/cards/card-back.webp')
const ANVIL_CLASS_NAME = `card-flight__anvil ${FLIGHT_BASE_CLASS_NAME} root-paper root-medallion flex size-36 items-end justify-center pb-4 text-8xl text-parchment`
/** The anvil itself, squashed from its foot by each blow. */
const ANVIL_ICON_CLASS_NAME = 'block origin-bottom'
const INK_OUTLINE_FILTER_CLASS_NAME =
  '[filter:drop-shadow(0_2px_0_var(--color-ink-deep))]'
/**
 * Hammer over the anvil, swinging on its handle end (top right); the icon is
 * turned so its head comes down on the anvil face.
 */
const HAMMER_CLASS_NAME = `absolute -top-1 left-9 origin-top-right text-7xl text-paper-bright ${INK_OUTLINE_FILTER_CLASS_NAME}`
const HAMMER_ICON_CLASS_NAME = 'block rotate-180'
/** Burst on the anvil face, where the hammer lands. */
const SPARK_CLASS_NAME = `absolute top-14 left-1/2 text-6xl text-gold opacity-0 ${INK_OUTLINE_FILTER_CLASS_NAME}`

export type ActiveFlight = {
  key: string
  flight: CardFlight
  /** Position among the cards of its update: start delay and fan offset. */
  order: number
  imagePath: string
}

const LIFETIME_MS_BY_REASON: Readonly<Record<CardFlightReason, number>> = {
  craft: CRAFT_LIFETIME_MS,
  reveal: REVEAL_LIFETIME_MS,
  buy: BUY_LIFETIME_MS,
}

/** How long a flight stays on screen, its start delay included. */
export function flightEndMs(entry: ActiveFlight): number {
  return (
    entry.order * FLIGHT_STAGGER_MS + LIFETIME_MS_BY_REASON[entry.flight.reason]
  )
}

export type ScreenPoint = {
  x: number
  y: number
}

export type AnimationSpec = {
  keyframes: Keyframe[]
  lifetimeMs: number
}

function sceneCenter(): ScreenPoint {
  return { x: window.innerWidth * HALF, y: window.innerHeight * HALF }
}

/** Middle of the seat's rail tile; the scene centre when the tile is not drawn. */
export function railTileCenter(seat: number): ScreenPoint {
  const tile: Element | null = document.querySelector(
    `[data-rail-seat="${String(seat)}"]`,
  )
  if (tile === null) {
    return sceneCenter()
  }
  const bounds: DOMRect = tile.getBoundingClientRect()
  return {
    x: bounds.left + bounds.width * HALF,
    y: bounds.top + bounds.height * HALF,
  }
}

/** Where the flight comes to rest: the scene centre, fanned by its order. */
export function restPoint(entry: ActiveFlight): ScreenPoint {
  const center: ScreenPoint = sceneCenter()
  return { x: center.x + entry.order * FAN_OFFSET_PIXELS, y: center.y }
}

/** Centre an element on a point, at a scale. */
export function centeredTransform(point: ScreenPoint, scale: number): string {
  return `translate(${String(point.x)}px, ${String(point.y)}px) translate(-50%, -50%) scale(${String(scale)})`
}

/**
 * Run one Web Animation on the element for as long as it is mounted. The
 * keyframes are built on mount, once the rail tile can be measured.
 */
export function useFlightAnimation<Target extends HTMLElement>(
  entry: ActiveFlight,
  build: (entry: ActiveFlight) => AnimationSpec,
): RefObject<Target | null> {
  const elementRef = useRef<Target | null>(null)
  const entryRef = useRef<ActiveFlight>(entry)
  const buildRef = useRef<(entry: ActiveFlight) => AnimationSpec>(build)
  useEffect(() => {
    const element = elementRef.current
    if (element === null || typeof element.animate !== 'function') {
      return undefined
    }
    const spec: AnimationSpec = buildRef.current(entryRef.current)
    const animation = element.animate(spec.keyframes, {
      duration: spec.lifetimeMs,
      delay: entryRef.current.order * FLIGHT_STAGGER_MS,
      fill: 'forwards',
    })
    return () => {
      animation.cancel()
    }
  }, [])
  return elementRef
}

function revealTravel(entry: ActiveFlight): AnimationSpec {
  const start: string = centeredTransform(
    railTileCenter(entry.flight.seat),
    START_SCALE,
  )
  const landed: string = centeredTransform(restPoint(entry), 1)
  return {
    lifetimeMs: REVEAL_LIFETIME_MS,
    keyframes: [
      { transform: start, opacity: 1, easing: 'ease-out' },
      {
        transform: landed,
        opacity: 1,
        offset: REVEAL_TRAVEL_MS / REVEAL_LIFETIME_MS,
      },
      {
        transform: landed,
        opacity: 1,
        offset: (REVEAL_LIFETIME_MS - FADE_MS) / REVEAL_LIFETIME_MS,
      },
      { transform: landed, opacity: 0 },
    ],
  }
}

function revealFlip(): AnimationSpec {
  return {
    lifetimeMs: REVEAL_LIFETIME_MS,
    keyframes: [
      { transform: FACE_DOWN_TRANSFORM },
      {
        transform: FACE_DOWN_TRANSFORM,
        offset: REVEAL_FLIP_START_MS / REVEAL_LIFETIME_MS,
        easing: 'ease-in-out',
      },
      {
        transform: FACE_UP_TRANSFORM,
        offset: REVEAL_FLIP_END_MS / REVEAL_LIFETIME_MS,
      },
      { transform: FACE_UP_TRANSFORM },
    ],
  }
}

/** A revealed card: flies in face down, then flips face up. */
export function RevealedCardFlight(props: { entry: ActiveFlight }): JSX.Element {
  const frameRef = useFlightAnimation<HTMLDivElement>(props.entry, revealTravel)
  const flipRef = useFlightAnimation<HTMLDivElement>(props.entry, revealFlip)
  return (
    <div ref={frameRef} className={CARD_FRAME_CLASS_NAME}>
      <div ref={flipRef} className="relative size-full transform-3d">
        <img
          className={CARD_FACE_CLASS_NAME}
          src={props.entry.imagePath}
          alt="Revealed card"
          draggable={false}
        />
        <img
          className={CARD_BACK_CLASS_NAME}
          src={CARD_BACK_IMAGE_PATH}
          alt=""
          draggable={false}
        />
      </div>
    </div>
  )
}

function anvilTravel(entry: ActiveFlight): AnimationSpec {
  const rest: ScreenPoint = restPoint(entry)
  const landed: string = centeredTransform(rest, 1)
  const gone: string = centeredTransform(rest, ANVIL_GONE_SCALE)
  return {
    lifetimeMs: CRAFT_LIFETIME_MS,
    keyframes: [
      {
        transform: centeredTransform(
          railTileCenter(entry.flight.seat),
          START_SCALE,
        ),
        opacity: 1,
        easing: 'ease-out',
      },
      {
        transform: landed,
        opacity: 1,
        offset: CRAFT_TRAVEL_MS / CRAFT_LIFETIME_MS,
      },
      {
        transform: landed,
        opacity: 1,
        offset: CRAFT_FORGED_MS / CRAFT_LIFETIME_MS,
      },
      {
        transform: gone,
        opacity: 0,
        offset: CRAFT_POPPED_MS / CRAFT_LIFETIME_MS,
      },
      { transform: gone, opacity: 0 },
    ],
  }
}

function hammerStrikes(): AnimationSpec {
  const keyframes: Keyframe[] = [
    { transform: HAMMER_RAISED_TRANSFORM },
    {
      transform: HAMMER_RAISED_TRANSFORM,
      offset: CRAFT_TRAVEL_MS / CRAFT_LIFETIME_MS,
      easing: 'ease-in',
    },
  ]
  for (const strike of STRIKES) {
    const impactMs: number = strikeImpactMs(strike)
    keyframes.push(
      {
        transform: HAMMER_STRUCK_TRANSFORM,
        offset: impactMs / CRAFT_LIFETIME_MS,
        easing: 'ease-out',
      },
      {
        transform: HAMMER_RAISED_TRANSFORM,
        offset: (impactMs + CRAFT_STRIKE_LIFT_MS) / CRAFT_LIFETIME_MS,
        easing: 'ease-in',
      },
    )
  }
  keyframes.push({ transform: HAMMER_RAISED_TRANSFORM })
  return { lifetimeMs: CRAFT_LIFETIME_MS, keyframes }
}

function anvilJolts(): AnimationSpec {
  const keyframes: Keyframe[] = [{ transform: ANVIL_STILL_TRANSFORM }]
  for (const strike of STRIKES) {
    const impactMs: number = strikeImpactMs(strike)
    keyframes.push(
      {
        transform: ANVIL_STILL_TRANSFORM,
        offset: impactMs / CRAFT_LIFETIME_MS,
      },
      {
        transform: ANVIL_STRUCK_TRANSFORM,
        offset: (impactMs + ANVIL_JOLT_MS) / CRAFT_LIFETIME_MS,
        easing: 'ease-out',
      },
      {
        transform: ANVIL_STILL_TRANSFORM,
        offset: (impactMs + ANVIL_RECOVER_MS) / CRAFT_LIFETIME_MS,
      },
    )
  }
  keyframes.push({ transform: ANVIL_STILL_TRANSFORM })
  return { lifetimeMs: CRAFT_LIFETIME_MS, keyframes }
}

/** Centre the burst on its anchor, turned and scaled. */
function sparkTransform(strike: number, scale: number): string {
  return `translate(-50%, -50%) rotate(${String(strike * SPARK_TURN_DEGREES)}deg) scale(${String(scale)})`
}

function sparkBursts(): AnimationSpec {
  const keyframes: Keyframe[] = [
    { transform: sparkTransform(0, SPARK_START_SCALE), opacity: 0 },
  ]
  for (const strike of STRIKES) {
    const impactMs: number = strikeImpactMs(strike)
    const small: string = sparkTransform(strike, SPARK_START_SCALE)
    keyframes.push(
      {
        transform: small,
        opacity: 0,
        offset: (impactMs - INSTANT_MS) / CRAFT_LIFETIME_MS,
      },
      {
        transform: small,
        opacity: 1,
        offset: impactMs / CRAFT_LIFETIME_MS,
        easing: 'ease-out',
      },
      {
        transform: sparkTransform(strike, SPARK_END_SCALE),
        opacity: 0,
        offset: (impactMs + SPARK_LIFETIME_MS) / CRAFT_LIFETIME_MS,
      },
    )
  }
  keyframes.push({
    transform: sparkTransform(0, SPARK_END_SCALE),
    opacity: 0,
  })
  return { lifetimeMs: CRAFT_LIFETIME_MS, keyframes }
}

function craftedCardPop(entry: ActiveFlight): AnimationSpec {
  const rest: ScreenPoint = restPoint(entry)
  const hidden: string = centeredTransform(rest, CARD_POP_START_SCALE)
  const landed: string = centeredTransform(rest, 1)
  return {
    lifetimeMs: CRAFT_LIFETIME_MS,
    keyframes: [
      { transform: hidden, opacity: 0 },
      {
        transform: hidden,
        opacity: 0,
        offset: CRAFT_FORGED_MS / CRAFT_LIFETIME_MS,
        easing: 'ease-out',
      },
      {
        transform: centeredTransform(rest, CARD_POP_OVERSHOOT_SCALE),
        opacity: 1,
        offset: CRAFT_POPPED_MS / CRAFT_LIFETIME_MS,
      },
      {
        transform: landed,
        opacity: 1,
        offset: CRAFT_SETTLED_MS / CRAFT_LIFETIME_MS,
      },
      {
        transform: landed,
        opacity: 1,
        offset: (CRAFT_LIFETIME_MS - FADE_MS) / CRAFT_LIFETIME_MS,
      },
      { transform: landed, opacity: 0 },
    ],
  }
}

/** A crafted card: an anvil from the rail, hammer strikes, the card pops out. */
export function CraftedCardFlight(props: { entry: ActiveFlight }): JSX.Element {
  const anvilRef = useFlightAnimation<HTMLDivElement>(props.entry, anvilTravel)
  const hammerRef = useFlightAnimation<HTMLSpanElement>(
    props.entry,
    hammerStrikes,
  )
  const anvilIconRef = useFlightAnimation<HTMLSpanElement>(
    props.entry,
    anvilJolts,
  )
  const sparkRef = useFlightAnimation<HTMLSpanElement>(props.entry, sparkBursts)
  const cardRef = useFlightAnimation<HTMLDivElement>(props.entry, craftedCardPop)
  return (
    <>
      <div ref={anvilRef} className={ANVIL_CLASS_NAME} aria-hidden="true">
        <span ref={anvilIconRef} className={ANVIL_ICON_CLASS_NAME}>
          <GiAnvil />
        </span>
        <span ref={sparkRef} className={SPARK_CLASS_NAME}>
          <GiPolarStar />
        </span>
        <span ref={hammerRef} className={HAMMER_CLASS_NAME}>
          <GiFlatHammer className={HAMMER_ICON_CLASS_NAME} />
        </span>
      </div>
      <div ref={cardRef} className={CARD_FRAME_CLASS_NAME}>
        <img
          className={CARD_FACE_CLASS_NAME}
          src={props.entry.imagePath}
          alt="Crafted card"
          draggable={false}
        />
      </div>
    </>
  )
}
