/**
 * Cards a seat just showed to the table: crafted, or revealed for a Lizard
 * Cult ritual. Read from the game log so every player sees the card fly out
 * of that seat's rail tile.
 */

export type CardFlightReason = 'craft' | 'reveal' | 'buy'

export type CardFlight = {
  /** Seat the card comes from. */
  seat: number
  cardId: string
  reason: CardFlightReason
  /** `buy`: the seat the card ends at (the buyer). */
  toSeat?: number
}

/** One server update worth of flights; `sequence` grows with every batch. */
export type CardFlightBatch = {
  sequence: number
  flights: readonly CardFlight[]
}

export const EMPTY_CARD_FLIGHT_BATCH: CardFlightBatch = {
  sequence: 0,
  flights: [],
}

const ACTION_LOG_ENTRY_TYPE = 'action'

/** Action types that show one card (`cardId`) to every player. */
const FLIGHT_REASON_BY_ACTION_TYPE: Readonly<Record<string, CardFlightReason>> =
  {
    craft: 'craft',
    vbCraft: 'craft',
    riverfolkCraft: 'craft',
    // Rule: 10.5 — a ritual reveals the card it is performed with.
    ritualBuild: 'reveal',
    ritualRecruit: 'reveal',
    ritualScore: 'reveal',
    ritualSacrifice: 'reveal',
  }

function readFlight(entry: unknown): CardFlight | null {
  if (typeof entry !== 'object' || entry === null) return null
  if (Reflect.get(entry, 't') !== ACTION_LOG_ENTRY_TYPE) return null
  const seat: unknown = Reflect.get(entry, 'actor')
  const action: unknown = Reflect.get(entry, 'action')
  if (typeof seat !== 'number') return null
  if (typeof action !== 'object' || action === null) return null
  const actionType: unknown = Reflect.get(action, 'type')
  const cardId: unknown = Reflect.get(action, 'cardId')
  if (typeof actionType !== 'string' || typeof cardId !== 'string') return null
  const reason: CardFlightReason | undefined =
    FLIGHT_REASON_BY_ACTION_TYPE[actionType]
  return reason === undefined ? null : { seat, cardId, reason }
}

const EVENT_LOG_ENTRY_TYPE = 'event'
const BUY_SERVICES_EVENT_TYPE = 'buyServices'
/** Rule: 11.2.3 Public Hand — the hand the Hand Card service sells from. */
const SELLER_FACTION_ID = 'riverfolk'

export type CardFlightPlayer = {
  seat: number
  faction: string
  hand: readonly { id: string }[]
}

/** The part of a game state the bought cards are read from. */
export type CardFlightState = {
  players: readonly CardFlightPlayer[]
}

/** Buyer of the services the log entries tell; null without a purchase step. */
function readBuyer(entries: readonly unknown[]): number | null {
  for (const entry of entries) {
    if (typeof entry !== 'object' || entry === null) continue
    if (Reflect.get(entry, 't') !== EVENT_LOG_ENTRY_TYPE) continue
    const event: unknown = Reflect.get(entry, 'event')
    if (typeof event !== 'object' || event === null) continue
    if (Reflect.get(event, 'type') !== BUY_SERVICES_EVENT_TYPE) continue
    const buyer: unknown = Reflect.get(event, 'buyer')
    if (typeof buyer === 'number') return buyer
  }
  return null
}

function sellerOf(state: CardFlightState): CardFlightPlayer | null {
  return (
    state.players.find(
      (player: CardFlightPlayer): boolean =>
        player.faction === SELLER_FACTION_ID,
    ) ?? null
  )
}

/**
 * Rule: 11.2.6 Hand Card service — the cards that left the Riverfolk hand in
 * an update that bought services go to the buyer. The log names the buyer,
 * not the card: the card is the one missing from the public hand.
 */
export function boughtCardFlights(
  previous: CardFlightState,
  next: CardFlightState,
  newLogEntries: readonly unknown[],
): CardFlight[] {
  const buyer = readBuyer(newLogEntries)
  const sellerBefore = sellerOf(previous)
  const sellerAfter = sellerOf(next)
  if (buyer === null || sellerBefore === null || sellerAfter === null) {
    return []
  }
  const kept = new Set<string>(
    sellerAfter.hand.map((card: { id: string }): string => card.id),
  )
  return sellerBefore.hand
    .filter((card: { id: string }): boolean => !kept.has(card.id))
    .map(
      (card: { id: string }): CardFlight => ({
        seat: sellerBefore.seat,
        cardId: card.id,
        reason: 'buy',
        toSeat: buyer,
      }),
    )
}

/** Crafted and revealed cards among the log entries one update added. */
export function cardFlightsFromLog(entries: readonly unknown[]): CardFlight[] {
  const flights: CardFlight[] = []
  for (const entry of entries) {
    const flight = readFlight(entry)
    if (flight !== null) flights.push(flight)
  }
  return flights
}
