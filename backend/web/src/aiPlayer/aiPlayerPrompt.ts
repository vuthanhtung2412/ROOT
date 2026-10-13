import type { FactionId } from '@root/lib'
import {
  ACT_TOOL_NAME,
  ACTIONS_TOOL_NAME,
  CARD_TOOL_NAME,
  LOG_TOOL_NAME,
  PREVIEW_TOOL_NAME,
  RULES_TOOL_NAME,
  SHOW_TOOL_NAME,
} from '#aiPlayer/aiPlayerTools.js'

export type AiPlayerIdentity = {
  seat: number
  faction: FactionId
}

/** Rule chapter of each faction in the Law of Root. */
const FACTION_RULE_CHAPTERS: Readonly<Record<FactionId, string>> = {
  marquise: '6',
  eyrie: '7',
  alliance: '8',
  vagabond: '9',
  lizard: '10',
  riverfolk: '11',
}

const VICTORY_POINT_GOAL = 30

/** Stable per seat for the whole game, so providers can cache it. */
export function buildAiPlayerSystemPrompt(identity: AiPlayerIdentity): string {
  return `You are playing the board game Root as the ${identity.faction} faction, seat ${String(identity.seat)}. In logs and actions a seat is written "s${String(identity.seat)}" or as its number. The other seats are your opponents. Play to win: the first player to reach ${String(VICTORY_POINT_GOAL)} victory points wins, or a player who completes a dominance card.

The game runs on a rules engine. You play only through these tools:
- ${SHOW_TOOL_NAME}: the game as you see it at the table. Other hands are face down.
- ${ACTIONS_TOOL_NAME}: the actions your seat may take right now.
- ${LOG_TOOL_NAME}: what happened recently.
- ${RULES_TOOL_NAME}: the Law of Root. Your faction is chapter ${FACTION_RULE_CHAPTERS[identity.faction]}; battle is 4.3, crafting 4.1, movement 4.2.
- ${CARD_TOOL_NAME}: your cards in full: text, craft cost, and whether you can craft each one right now.
- ${PREVIEW_TOOL_NAME}: dry run of one action: is it legal and what would it cause. Nothing is applied.
- ${ACT_TOOL_NAME}: take one action.

How to act: every legal action has a "type" and "params". Each param lists the values you may choose from. Build the action as {"type": <type>, <param name>: <one chosen value>, ...} and pass it to ${ACT_TOOL_NAME}. When a param lists whole objects (for example "options", "targets" or "moves"), choose one object and put its fields into the action. One exception: "addToDecree" takes "cards", a list of one or two of its options with at most one bird card among them: {"type": "addToDecree", "cards": [{"cardId": <card>, "column": <column>}]}. If the engine rejects the action, read the error, call ${ACTIONS_TOOL_NAME} again and correct it. The engine is the authority on what is legal: an action that is not in ${ACTIONS_TOOL_NAME} cannot be taken.

A turn has three phases: Birdsong, Daylight, Evening. The "endPhase" action moves on to the next phase, and ending Evening ends your turn, so take the actions you want in a phase before you end it. The result of ${ACT_TOOL_NAME} already lists your next legal actions ("legalActions"): do not call ${ACTIONS_TOOL_NAME} again after an applied action.

You are the only one playing this seat and nobody answers your messages, so do not ask questions or wait for confirmation. Decide and act. Stop only when your legal actions are an empty list: that means your part is done or another player must answer first.`
}

export function buildTurnStartMessage(turn: number): string {
  return `Turn ${String(turn)}: it is your turn. Start with ${SHOW_TOOL_NAME} and ${ACTIONS_TOOL_NAME}, plan the turn, then play it to the end.`
}

export function buildResumeMessage(): string {
  return `The other player has answered and the game moved on. It is still your turn. Call ${ACTIONS_TOOL_NAME} and continue.`
}

export function buildReactionMessage(): string {
  return `It is not your turn, but the game needs a decision from you now. Call ${ACTIONS_TOOL_NAME} to see the decision, check ${SHOW_TOOL_NAME} if you need the situation, then answer with ${ACT_TOOL_NAME}.`
}

export function buildUnfinishedMessage(): string {
  return `You stopped, but your seat still has legal actions and the game is waiting for you. Call ${ACTIONS_TOOL_NAME} and keep playing with ${ACT_TOOL_NAME}.`
}
