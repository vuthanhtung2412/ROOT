/**
 * Bot turn banner: while a Rootbotics bot takes its turn, the order card it
 * plays to and the actions it took so far, latest last, so the player can
 * follow the sequence one action at a time.
 */
import { isBotFaction } from '@root/lib/bot-factions'
import type { GameState } from '#api/client.ts'
import { buildBotBoardViewModel, type BotCardView } from '#ui/botBoardViewModel.ts'
import {
  buildGameLogLines,
  type GameLogContext,
  type GameLogLine,
  type GameLogPart,
} from '#ui/gameLog.ts'

const PLAYING_STATUS = 'playing'
/** Earlier actions shown under the latest one: enough to read the sequence. */
export const BOT_TURN_EARLIER_ACTIONS_SHOWN = 3

export type BotTurnAction = {
  key: string
  /** 1 for the bot's first action of the turn. */
  number: number
  parts: GameLogPart[]
}

export type BotOrderCardView = BotCardView & {
  /** Card definition id: picks the card art. */
  definitionId: string
}

export type BotTurnBannerViewModel = {
  faction: string
  phase: string
  step: string
  orderCard: BotOrderCardView | null
  /** Actions of the latest bot step (a Recruit can place in several clearings); empty before the first. */
  latestActions: BotTurnAction[]
  /** Before the latest step, oldest first. */
  earlierActions: BotTurnAction[]
}

export type BotTurnLog = {
  log: readonly unknown[]
  /** Index in the log where the latest bot step starts. */
  latestStepStart: number
}

const CARD_ID_SEPARATOR = '#'

function orderCardOf(state: GameState, seat: number): BotOrderCardView | null {
  const player = state.players.find((candidate) => candidate.seat === seat)
  if (player === undefined) return null
  const orderCard: BotCardView | null = buildBotBoardViewModel(player)?.orderCard ?? null
  if (orderCard === null) return null
  return {
    ...orderCard,
    definitionId: orderCard.cardId.split(CARD_ID_SEPARATOR)[0] ?? orderCard.cardId,
  }
}

/** Action lines of the turn in progress: after its turn heading. */
function actionsOfCurrentTurn(lines: readonly GameLogLine[], faction: string): BotTurnAction[] {
  const turnStartIndex: number = lines.findLastIndex(
    (line: GameLogLine): boolean => line.kind === 'turn' && line.faction === faction,
  )
  const actions: BotTurnAction[] = []
  for (const line of lines.slice(turnStartIndex + 1)) {
    if (line.kind !== 'action' || line.faction !== faction) continue
    actions.push({ key: line.key, number: actions.length + 1, parts: line.parts })
  }
  return actions
}

const ACTION_ENTRY_TYPE = 'action'
const PHASE_END_ACTION_TYPE = 'endPhase'

function isShownActionEntry(entry: unknown): boolean {
  if (typeof entry !== 'object' || entry === null) return false
  const action: unknown = Reflect.get(entry, 'action')
  return (
    Reflect.get(entry, 't') === ACTION_ENTRY_TYPE &&
    typeof action === 'object' &&
    action !== null &&
    Reflect.get(action, 'type') !== PHASE_END_ACTION_TYPE
  )
}

/**
 * Where the latest step starts once a new log arrives: the end of the log
 * before, when the new entries hold an action; else the start kept so far.
 */
export function nextLatestStepStart(
  previousLog: readonly unknown[],
  nextLog: readonly unknown[],
  previousStart: number,
): number {
  const hasNewAction: boolean = nextLog.slice(previousLog.length).some(isShownActionEntry)
  return hasNewAction ? previousLog.length : previousStart
}

function latestStepActions(actions: readonly BotTurnAction[], latestStepStart: number): BotTurnAction[] {
  const latest: BotTurnAction[] = actions.filter(
    (action: BotTurnAction): boolean => Number(action.key) >= latestStepStart,
  )
  return latest.length > 0 ? latest : actions.slice(-1)
}

/** The faction of the bot taking its turn; null on a player's turn. */
export function botTakingTurn(state: GameState): string | null {
  if (state.status !== PLAYING_STATUS) return null
  const faction: string | undefined = state.factions[state.currentSeat]
  return faction !== undefined && isBotFaction(faction) ? faction : null
}

/** Null when no bot is taking its turn. */
export function buildBotTurnBannerViewModel(
  state: GameState,
  turnLog: BotTurnLog,
  context: GameLogContext,
): BotTurnBannerViewModel | null {
  const faction: string | null = botTakingTurn(state)
  if (faction === null) return null
  const actions: BotTurnAction[] = actionsOfCurrentTurn(
    buildGameLogLines(turnLog.log, context),
    context.factionOfSeat(state.currentSeat),
  )
  const latestActions: BotTurnAction[] = latestStepActions(actions, turnLog.latestStepStart)
  const earlierActions: BotTurnAction[] = actions.slice(0, actions.length - latestActions.length)
  return {
    faction,
    phase: state.phase,
    step: state.step,
    orderCard: orderCardOf(state, state.currentSeat),
    latestActions,
    earlierActions: earlierActions.slice(-BOT_TURN_EARLIER_ACTIONS_SHOWN),
  }
}
