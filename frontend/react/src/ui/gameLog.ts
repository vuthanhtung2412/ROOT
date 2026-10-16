/**
 * Game log for the players: one line per action taken, in words. A card is
 * shown by name, a clearing as a reference the UI can point at on the map.
 */

export type GameLogPart =
  | { kind: 'text'; text: string }
  | { kind: 'card'; name: string }
  | { kind: 'clearing'; clearingId: number }

export type GameLogLine =
  | { kind: 'turn'; key: string; faction: string }
  | { kind: 'action'; key: string; faction: string; parts: GameLogPart[] }

export type GameLogContext = {
  factionOfSeat: (seat: number) => string
  /** Name of a card from its id; null when the id names no known card. */
  cardName: (cardId: string) => string | null
}

type JsonRecord = Record<string, unknown>

const ACTION_ENTRY_TYPE = 'action'
const PHASE_ENTRY_TYPE = 'phase'
const FIRST_PHASE_OF_A_TURN = 'birdsong'
/** Phase bookkeeping: the turn headings already tell where the game is. */
const SILENT_ACTION_TYPES: ReadonlySet<string> = new Set<string>(['endPhase'])
const UNKNOWN_CARD_NAME = 'a card'
const DECLINE_TEXT = 'declines'

/** Names that read better than the action type split into words. */
const ACTION_NAMES: Readonly<Record<string, string>> = {
  birdsongWood: 'places wood',
  eveningDraw: 'draws',
  eveningScore: 'scores roosts',
  addToDecree: 'adds to the Decree',
  decree: 'Decree',
  vbMove: 'moves',
  vbBattle: 'battles',
  vbCraft: 'crafts',
  resolveEvent: 'answers',
  informantsTakeAmbush: 'Informants: takes',
  leagueMove: 'League: moves',
  leagueBattle: 'League: battles',
  eyrieEmigre: 'Eyrie Émigré: moves',
  // Rootbotics bots (they act on their own).
  revealOrder: 'reveals the order',
  botCraft: 'crafts',
  botRecruit: 'recruits',
  botBuild: 'builds',
  botMove: 'moves',
  botBattle: 'battles',
  botTurmoil: 'falls into turmoil',
}

/** Fields that hold a seat: shown as the faction sitting there. */
const SEAT_FIELD_WORDS: Readonly<Record<string, string>> = {
  defender: 'against',
  target: 'on',
  fundOwner: 'with the fund of',
  alliedSeat: 'allied with',
}
const CARD_LIST_FIELDS: readonly string[] = ['cardIds', 'supporterIds']
/** Fields a reader has no use for, or that another field already tells. */
const SKIPPED_FIELDS: ReadonlySet<string> = new Set<string>([
  'type',
  'playerId',
  'pieceId',
  'itemIndex',
  'from',
  'to',
  'count',
])

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: string): GameLogPart {
  return { kind: 'text', text: value }
}

function clearing(clearingId: number): GameLogPart {
  return { kind: 'clearing', clearingId }
}

/** `leagueMove` → "league move". */
function wordsOf(camelCase: string): string {
  return camelCase.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase()
}

function actionName(actionType: string): string {
  return ACTION_NAMES[actionType] ?? wordsOf(actionType)
}

function cardPart(cardId: unknown, context: GameLogContext): GameLogPart {
  const name: string | null =
    typeof cardId === 'string' ? context.cardName(cardId) : null
  return { kind: 'card', name: name ?? UNKNOWN_CARD_NAME }
}

/** "2 × C7 → C6": the warriors of one move. */
function moveParts(move: JsonRecord): GameLogPart[] {
  const { from, to, count } = move
  if (typeof from !== 'number' || typeof to !== 'number') return []
  const countParts: GameLogPart[] =
    typeof count === 'number' ? [text(`${String(count)} ×`)] : []
  return [...countParts, clearing(from), text('→'), clearing(to)]
}

function listParts(field: string, values: unknown[], context: GameLogContext): GameLogPart[] {
  if (CARD_LIST_FIELDS.includes(field)) {
    return values.map((cardId: unknown): GameLogPart => cardPart(cardId, context))
  }
  if (field === 'moves') {
    return values.filter(isJsonRecord).flatMap(moveParts)
  }
  if (field === 'cards') {
    // Add to the Decree: each card goes to a column.
    return values.filter(isJsonRecord).flatMap((entry: JsonRecord): GameLogPart[] => [
      cardPart(entry.cardId, context),
      text(`→ ${String(entry.column)}`),
    ])
  }
  if (field === 'pieceIds') {
    const pieces: string = values.length === 1 ? 'piece' : 'pieces'
    return [text(`removes ${String(values.length)} ${pieces}`)]
  }
  return []
}

function fieldParts(field: string, value: unknown, context: GameLogContext): GameLogPart[] {
  if (SKIPPED_FIELDS.has(field)) return []
  if (Array.isArray(value)) return listParts(field, value, context)
  if (field === 'cardId' || field === 'giveCardId') return [cardPart(value, context)]
  if (field === 'clearing' && typeof value === 'number') {
    return [text('in'), clearing(value)]
  }
  const seatWord: string | undefined = SEAT_FIELD_WORDS[field]
  if (seatWord !== undefined && typeof value === 'number') {
    return [text(`${seatWord} ${context.factionOfSeat(value)}`)]
  }
  if (field === 'decline') return value === true ? [text(DECLINE_TEXT)] : []
  if (typeof value === 'boolean') return value ? [text(`(${wordsOf(field)})`)] : []
  if (typeof value === 'string' || typeof value === 'number') {
    return [text(String(value))]
  }
  return []
}

/** One action in words: its name, then what each of its fields says. */
function actionParts(action: JsonRecord, context: GameLogContext): GameLogPart[] {
  const parts: GameLogPart[] = [text(actionName(String(action.type)))]
  for (const [field, value] of Object.entries(action)) {
    parts.push(...fieldParts(field, value, context))
  }
  // A single move (not a list of moves): origin, destination, count.
  parts.push(...moveParts(action))
  return parts
}

/**
 * Lines of the log panel: a heading when a turn starts, then the actions.
 * Game state (pieces placed, points) is left out: the board shows it.
 */
export function buildGameLogLines(
  log: readonly unknown[],
  context: GameLogContext,
): GameLogLine[] {
  const lines: GameLogLine[] = []
  let factionOfOpenTurn: string | null = null
  log.forEach((entry: unknown, index: number): void => {
    if (!isJsonRecord(entry) || typeof entry.actor !== 'number') return
    const faction: string = context.factionOfSeat(entry.actor)
    const key: string = String(index)
    if (entry.t === PHASE_ENTRY_TYPE && entry.phase === FIRST_PHASE_OF_A_TURN) {
      // Birdsong logs a phase entry per step: one heading per turn is enough.
      if (factionOfOpenTurn !== faction) {
        factionOfOpenTurn = faction
        lines.push({ kind: 'turn', key, faction })
      }
      return
    }
    if (entry.t !== ACTION_ENTRY_TYPE || !isJsonRecord(entry.action)) return
    if (SILENT_ACTION_TYPES.has(String(entry.action.type))) return
    lines.push({
      kind: 'action',
      key,
      faction,
      parts: actionParts(entry.action, context),
    })
  })
  return lines
}
