import type { Card } from '#cards/types.js'
import { taskDone, type BotTaskResult } from '#factions/bots/BotFaction.js'
import { placeBotWarriors } from '#factions/bots/botQueries.js'
import { botDifficultyOf, isChallengingOrHarder } from '#factions/bots/botSettings.js'
import { byHighestPriority, inTargetOrder } from '#factions/bots/priority.js'
import type { Ctx } from '#game/ctx.js'
import type { LogEntry } from '#log/types.js'
import { FALL } from '#map/fall.js'
import type { ClearingId } from '#map/types.js'
import type { Piece, Seat } from '#pieces/types.js'
import { canPlace } from '#queries/place.js'
import { piecesIn, warriors } from '#queries/pieces.js'
import { removePieces } from '#rules/remove.js'
import type { GameState } from '#state/types.js'

/** Difficulty Challenging / Nightmare — the bird Ambush! card. */
const BIRD_AMBUSH_CARD = 'ROOT-200'
/** Difficulty Easy — "place only one Loyal Vizier in the bird column". */
const EASY_VIZIER_COUNT = 1
/** Trait Swoop — warriors recruited at the end of Daylight. */
const SWOOP_WARRIORS = 2

/**
 * Difficulty Easy: one vizier; Challenging / Nightmare: a bird Ambush taken
 * from the draw pile joins the bird column (none left there: nothing).
 */
export function difficultyBirdColumn(state: GameState, seat: Seat, viziers: Card[]): Card[] {
  if (botDifficultyOf(state, seat) === 'easy') return viziers.slice(0, EASY_VIZIER_COUNT)
  if (!isChallengingOrHarder(state, seat)) return viziers
  const ambushIndex = state.deck.draw.findIndex(
    (drawCard: Card): boolean => drawCard.defId === BIRD_AMBUSH_CARD,
  )
  if (ambushIndex < 0) return viziers
  const [ambush] = state.deck.draw.splice(ambushIndex, 1)
  return ambush === undefined ? viziers : [...viziers, ambush]
}

function isDefenseless(state: GameState, clearing: ClearingId, piece: Piece): boolean {
  return warriors(state, clearing, piece.owner) === 0
}

/**
 * Trait Relentless — after the Decree, remove every defenseless enemy
 * building and token where the Eyrie has warriors (scoring them as usual).
 */
export function relentless(state: GameState, seat: Seat, ctx: Ctx): BotTaskResult {
  const logs: LogEntry[] = []
  for (const clearing of FALL.clearings.map((entry): ClearingId => entry.id)) {
    if (warriors(state, clearing, seat) === 0) continue
    const pieceIds = piecesIn(state, clearing)
      .filter(
        (piece: Piece): boolean =>
          piece.owner !== seat &&
          (piece.kind === 'building' || piece.kind === 'token') &&
          isDefenseless(state, clearing, piece),
      )
      .map((piece: Piece): string => piece.id)
    if (pieceIds.length === 0) continue
    logs.push(...removePieces(state, { clearing, pieceIds, scorer: seat }, ctx))
  }
  return taskDone(logs)
}

/**
 * Trait Swoop — at the end of Daylight, two warriors in the highest-priority
 * clearing where the Eyrie has no piece.
 */
export function swoop(state: GameState, seat: Seat): BotTaskResult {
  const clearing = inTargetOrder(
    FALL.clearings
      .map((entry): ClearingId => entry.id)
      .filter(
        (candidate: ClearingId): boolean =>
          !piecesIn(state, candidate).some((piece: Piece): boolean => piece.owner === seat) &&
          canPlace(state, seat, candidate),
      ),
    [byHighestPriority],
  )[0]
  if (clearing === undefined) return taskDone()
  return taskDone(placeBotWarriors(state, { seat, clearing, count: SWOOP_WARRIORS }))
}
