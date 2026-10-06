import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type JSX,
} from 'react'
import { cardImagePublicPath } from '#assets/gameAssets.ts'
import type { CardFlight, CardFlightBatch } from '#game/cardFlights.ts'
import { getHudSnapshot, subscribeHud } from '#game/hudStore.ts'
import { cardFaceFromId } from '#game/resolution/allianceActionComposer.ts'

/** Rail tile to the middle of the scene. */
const FLIGHT_TRAVEL_MS = 650
/** The card rests in the middle long enough to be read. */
const FLIGHT_HOLD_MS = 1300
const FLIGHT_FADE_MS = 350
const FLIGHT_LIFETIME_MS = FLIGHT_TRAVEL_MS + FLIGHT_HOLD_MS + FLIGHT_FADE_MS
/** Several cards of one update leave the rail one after the other. */
const FLIGHT_STAGGER_MS = 450
/** Size of the card as it leaves the rail tile, against its resting size. */
const FLIGHT_START_SCALE = 0.2
/** Later cards of one update rest a little to the right of the one before. */
const FLIGHT_FAN_OFFSET_PIXELS = 36
const HALF = 0.5

const FLIGHT_CARD_CLASS_NAME =
  'card-flight fixed top-0 left-0 z-250 block h-77.5 w-55 rounded-md border-3 border-ink-deep object-fill opacity-0 shadow-card select-none pointer-events-none'

type ScreenPoint = {
  x: number
  y: number
}

type ActiveFlight = {
  key: string
  flight: CardFlight
  /** Position among the cards of its update: start delay and fan offset. */
  order: number
  imagePath: string
}

function sceneCenter(): ScreenPoint {
  return { x: window.innerWidth * HALF, y: window.innerHeight * HALF }
}

/** Middle of the seat's rail tile; the scene centre when the tile is not drawn. */
function railTileCenter(seat: number): ScreenPoint {
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

/** Centre the card on a point, at a scale. */
function cardTransform(point: ScreenPoint, scale: number): string {
  return `translate(${String(point.x)}px, ${String(point.y)}px) translate(-50%, -50%) scale(${String(scale)})`
}

function FlyingCard(props: { entry: ActiveFlight }): JSX.Element {
  const imageRef = useRef<HTMLImageElement | null>(null)
  const entryRef = useRef<ActiveFlight>(props.entry)
  useEffect(() => {
    const image = imageRef.current
    if (image === null || typeof image.animate !== 'function') {
      return undefined
    }
    const entry: ActiveFlight = entryRef.current
    const start: ScreenPoint = railTileCenter(entry.flight.seat)
    const center: ScreenPoint = sceneCenter()
    const rest: ScreenPoint = {
      x: center.x + entry.order * FLIGHT_FAN_OFFSET_PIXELS,
      y: center.y,
    }
    const landed: string = cardTransform(rest, 1)
    const animation = image.animate(
      [
        {
          transform: cardTransform(start, FLIGHT_START_SCALE),
          opacity: 1,
          easing: 'ease-out',
        },
        {
          transform: landed,
          opacity: 1,
          offset: FLIGHT_TRAVEL_MS / FLIGHT_LIFETIME_MS,
        },
        {
          transform: landed,
          opacity: 1,
          offset: (FLIGHT_TRAVEL_MS + FLIGHT_HOLD_MS) / FLIGHT_LIFETIME_MS,
        },
        { transform: landed, opacity: 0 },
      ],
      {
        duration: FLIGHT_LIFETIME_MS,
        delay: entry.order * FLIGHT_STAGGER_MS,
        fill: 'forwards',
      },
    )
    return () => {
      animation.cancel()
    }
  }, [])
  return (
    <img
      ref={imageRef}
      className={FLIGHT_CARD_CLASS_NAME}
      src={props.entry.imagePath}
      alt={`${props.entry.flight.reason} card`}
      draggable={false}
    />
  )
}

function activate(batch: CardFlightBatch): ActiveFlight[] {
  const active: ActiveFlight[] = []
  for (const flight of batch.flights) {
    const imagePath: string | null = cardImagePublicPath(
      cardFaceFromId(flight.cardId).defId,
    )
    if (imagePath === null) continue
    active.push({
      key: `${String(batch.sequence)}-${String(active.length)}`,
      flight,
      order: active.length,
      imagePath,
    })
  }
  return active
}

/**
 * A crafted or revealed card flies out of its seat's rail tile, rests in the
 * middle of the scene, then fades. Played for every player from the game log.
 */
export function CardFlightLayer(): JSX.Element {
  const batch: CardFlightBatch = useSyncExternalStore(
    subscribeHud,
    () => getHudSnapshot().cardFlights,
    () => getHudSnapshot().cardFlights,
  )
  const [active, setActive] = useState<ActiveFlight[]>([])
  // A batch already in the store when the layer mounts is old news.
  const seenSequenceRef = useRef<number>(batch.sequence)
  const timersRef = useRef<Set<number>>(new Set<number>())

  useEffect(() => {
    if (batch.sequence === seenSequenceRef.current) {
      return
    }
    seenSequenceRef.current = batch.sequence
    const started: ActiveFlight[] = activate(batch)
    if (started.length === 0) {
      return
    }
    const startedKeys = new Set(started.map((entry: ActiveFlight) => entry.key))
    setActive((current: ActiveFlight[]) => [...current, ...started])
    // Each batch ends on its own timer: a newer batch must not cut it short.
    const timer = window.setTimeout(
      () => {
        timersRef.current.delete(timer)
        setActive((current: ActiveFlight[]) =>
          current.filter((entry: ActiveFlight) => !startedKeys.has(entry.key)),
        )
      },
      FLIGHT_LIFETIME_MS + (started.length - 1) * FLIGHT_STAGGER_MS,
    )
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
    <>
      {active.map((entry: ActiveFlight) => (
        <FlyingCard key={entry.key} entry={entry} />
      ))}
    </>
  )
}
