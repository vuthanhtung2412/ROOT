import {
  Game,
  type Action,
  type ActionSpec,
  type FactionId,
  type GameState,
  type LogEntry,
} from '@root/lib'
import { buildActionReport } from '#aiPlayer/aiPlayerActionReport.js'

/** Highest face of a Root battle die. Rule: 4.3.2. */
const HIGHEST_DIE_FACE = 3
const BATTLE_NOTE =
  'Dice are not rolled in a preview. Rolled hits are capped by the warriors of the side dealing them; ambush cards and battle effects are not counted.'
const HIDDEN_OUTCOME_NOTE =
  'The outcome depends on dice or on cards that are face down, so a preview does not show it.'

type PendingEvent = GameState['pending'][number]
type BattleEvent = Extract<PendingEvent, { type: 'battle' }>

export type BattlePreview = {
  clearing: number
  yourWarriors: number
  defenderWarriors: number
  maxRolledHitsYouDeal: number
  maxRolledHitsYouTake: number
  note: string
}

/** A dry run of one action: what `act` would answer, with nothing applied. */
export type ActionPreview = {
  legal: true
  wouldApply: string
  /** Everything the action would cause. Absent when chance decides it. */
  wouldLog?: string[]
  phaseAfter?: string
  yourTurnAfter?: boolean
  nextLegalActionTypes?: string[]
  waitingFor?: FactionId[]
  battle?: BattlePreview
  outcomeNotShown?: string
}

export type ActionPreviewRequest = {
  game: Game
  playerId: string
  action: Action
}

function isBattleEvent(event: PendingEvent): event is BattleEvent {
  return event.type === 'battle'
}

function findBattle(
  state: GameState,
  log: readonly LogEntry[],
): BattleEvent | undefined {
  const loggedEvents: PendingEvent[] = log.flatMap(
    (entry: LogEntry): PendingEvent[] =>
      entry.t === 'event' ? [entry.event] : [],
  )
  return [...state.pending, ...loggedEvents].find(isBattleEvent)
}

function countWarriors(state: GameState, clearing: number, seat: number): number {
  const pieces = state.clearings[clearing]?.pieces ?? []
  return pieces.filter(
    (piece: (typeof pieces)[number]): boolean =>
      piece.kind === 'warrior' && piece.owner === seat,
  ).length
}

/** The battle as it stands before the action: numbers anyone at the table sees. */
function previewBattle(state: GameState, battle: BattleEvent): BattlePreview {
  const yourWarriors = countWarriors(state, battle.clearing, battle.attacker)
  const defenderWarriors = countWarriors(
    state,
    battle.clearing,
    battle.defender,
  )
  return {
    clearing: battle.clearing,
    yourWarriors,
    defenderWarriors,
    maxRolledHitsYouDeal: Math.min(HIGHEST_DIE_FACE, yourWarriors),
    maxRolledHitsYouTake: Math.min(HIGHEST_DIE_FACE, defenderWarriors),
    note: BATTLE_NOTE,
  }
}

/**
 * Applies the action to a copy of the game and reports the result. The real
 * game is not touched. An illegal action throws exactly as `Game.apply` does.
 *
 * A copy rolls the same dice and draws the same cards as the real game would,
 * so an outcome that used either is withheld: the preview must not tell the
 * future, nor whether a defender holds an ambush card.
 */
export function previewAction(request: ActionPreviewRequest): ActionPreview {
  const { game, playerId, action } = request
  const snapshot = game.toJSON()
  const copy = Game.fromJSON(snapshot)
  const result = copy.apply(action)
  const report = buildActionReport({
    game: copy,
    playerId,
    action,
    logEntryCount: result.log.length,
  })
  const preview: ActionPreview = { legal: true, wouldApply: report.applied }

  const battle = findBattle(copy.state, result.log)
  if (battle !== undefined) {
    return { ...preview, battle: previewBattle(game.state, battle) }
  }
  const usedHiddenInformation: boolean =
    copy.toJSON().rng.cursor !== snapshot.rng.cursor ||
    copy.state.deck.draw.length !== snapshot.state.deck.draw.length ||
    copy.state.questDeck.length !== snapshot.state.questDeck.length
  if (usedHiddenInformation) {
    return { ...preview, outcomeNotShown: HIDDEN_OUTCOME_NOTE }
  }
  return {
    ...preview,
    wouldLog: report.log,
    phaseAfter: report.phase,
    yourTurnAfter: report.yourTurn,
    nextLegalActionTypes: [
      ...new Set<string>(
        report.legalActions.map((spec: ActionSpec): string => spec.type),
      ),
    ],
    ...(report.waitingFor === undefined
      ? {}
      : { waitingFor: report.waitingFor }),
  }
}
