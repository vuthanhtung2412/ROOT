import type { JSX } from 'react'
import {
  BUY_HOLD_MS,
  BUY_LIFETIME_MS,
  BUY_TRAVEL_MS,
  CARD_FACE_CLASS_NAME,
  CARD_FRAME_CLASS_NAME,
  centeredTransform,
  railTileCenter,
  restPoint,
  START_SCALE,
  useFlightAnimation,
  type ActiveFlight,
  type AnimationSpec,
  type ScreenPoint,
} from '#react/cardFlightViews.tsx'

/** Part of the last leg the card stays solid for, before it fades out. */
const SOLID_PART_OF_LEAVE = 0.8
const BUY_LEFT_CENTER_MS = BUY_TRAVEL_MS + BUY_HOLD_MS
const BUY_FADE_START_MS =
  BUY_LEFT_CENTER_MS + (BUY_LIFETIME_MS - BUY_LEFT_CENTER_MS) * SOLID_PART_OF_LEAVE

/** Rail tile → scene centre → rail tile of the buyer. */
function boughtCardPath(entry: ActiveFlight): AnimationSpec {
  const buyerSeat: number = entry.flight.toSeat ?? entry.flight.seat
  const start: ScreenPoint = railTileCenter(entry.flight.seat)
  const rest: ScreenPoint = restPoint(entry)
  const end: ScreenPoint = railTileCenter(buyerSeat)
  const shown: string = centeredTransform(rest, 1)
  // Where the card is when it starts to fade, on its way to the buyer.
  const fadeStart: ScreenPoint = {
    x: rest.x + (end.x - rest.x) * SOLID_PART_OF_LEAVE,
    y: rest.y + (end.y - rest.y) * SOLID_PART_OF_LEAVE,
  }
  const fadeStartScale: number = 1 + (START_SCALE - 1) * SOLID_PART_OF_LEAVE
  return {
    lifetimeMs: BUY_LIFETIME_MS,
    keyframes: [
      {
        transform: centeredTransform(start, START_SCALE),
        opacity: 1,
        easing: 'ease-out',
      },
      { transform: shown, opacity: 1, offset: BUY_TRAVEL_MS / BUY_LIFETIME_MS },
      {
        transform: shown,
        opacity: 1,
        offset: BUY_LEFT_CENTER_MS / BUY_LIFETIME_MS,
      },
      {
        transform: centeredTransform(fadeStart, fadeStartScale),
        opacity: 1,
        offset: BUY_FADE_START_MS / BUY_LIFETIME_MS,
      },
      { transform: centeredTransform(end, START_SCALE), opacity: 0 },
    ],
  }
}

/**
 * A card bought from the Riverfolk hand: face up out of the seller's rail
 * tile, a second in the middle of the scene, then into the buyer's rail tile.
 */
export function BoughtCardFlight(props: { entry: ActiveFlight }): JSX.Element {
  const cardRef = useFlightAnimation<HTMLDivElement>(props.entry, boughtCardPath)
  return (
    <div ref={cardRef} className={CARD_FRAME_CLASS_NAME}>
      <img
        className={CARD_FACE_CLASS_NAME}
        src={props.entry.imagePath}
        alt="Bought card"
        draggable={false}
      />
    </div>
  )
}
