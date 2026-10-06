/**
 * Cards a seat just showed to the table: crafted, or revealed for a Lizard
 * Cult ritual. Read from the game log so every player sees the card fly out
 * of that seat's rail tile.
 */

export type CardFlightReason = 'craft' | 'reveal'

export type CardFlight = {
  seat: number
  cardId: string
  reason: CardFlightReason
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

/** Crafted and revealed cards among the log entries one update added. */
export function cardFlightsFromLog(entries: readonly unknown[]): CardFlight[] {
  const flights: CardFlight[] = []
  for (const entry of entries) {
    const flight = readFlight(entry)
    if (flight !== null) flights.push(flight)
  }
  return flights
}
