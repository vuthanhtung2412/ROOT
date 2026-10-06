import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type JSX,
} from 'react'
import { cardImagePublicPath } from '#assets/gameAssets.ts'
import type { CardFlightBatch } from '#game/cardFlights.ts'
import { getHudSnapshot, subscribeHud } from '#game/hudStore.ts'
import { cardFaceFromId } from '#game/resolution/allianceActionComposer.ts'
import {
  CraftedCardFlight,
  flightEndMs,
  RevealedCardFlight,
  type ActiveFlight,
} from '#react/cardFlightViews.tsx'

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
 * Cards a seat shows to the table, played for every player from the game log.
 * Crafted: an anvil leaves the seat's rail tile, the hammer strikes, the card
 * pops out. Revealed: the card leaves the rail tile face down, then flips.
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
      Math.max(...started.map(flightEndMs)),
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
      {active.map((entry: ActiveFlight) =>
        entry.flight.reason === 'craft' ? (
          <CraftedCardFlight key={entry.key} entry={entry} />
        ) : (
          <RevealedCardFlight key={entry.key} entry={entry} />
        ),
      )}
    </>
  )
}
