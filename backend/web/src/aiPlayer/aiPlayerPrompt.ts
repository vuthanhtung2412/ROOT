import type { FactionId } from '@root/lib'
import {
  ACT_TOOL_NAME,
  ACTION_CHOICES_TOOL_NAME,
  ACTIONS_TOOL_NAME,
  CARD_TOOL_NAME,
  CLEARING_TOOL_NAME,
  DECREE_TOOL_NAME,
  LOG_TOOL_NAME,
  PREVIEW_TOOL_NAME,
  RULES_TOOL_NAME,
  SCORE_TOOL_NAME,
  SHOW_TOOL_NAME,
  SYMPATHY_TOOL_NAME,
  WORKSHOPS_TOOL_NAME,
} from '#aiPlayer/aiPlayerTools.js'
import { VICTORY_POINT_GOAL } from '#aiPlayer/aiPlayerStandings.js'

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
  // Bots play their own turns and never get an AI player; chapters of the Law of Rootbotics.
  mechanicalMarquise: 'Rootbotics 4',
  electricEyrie: 'Rootbotics 5',
}

/** The tool only one faction can use, as its line in the tool list. */
const FACTION_TOOL_LINES: Readonly<Partial<Record<FactionId, string>>> = {
  marquise: `- ${WORKSHOPS_TOOL_NAME}: your wood, what each next building costs and scores, and where you can build it now.\n`,
  eyrie: `- ${DECREE_TOOL_NAME}: your Decree card by card: which cards can resolve, where, and what would cause turmoil. Call it before you add to the Decree, with the cards you mean to add.\n`,
  alliance: `- ${SYMPATHY_TOOL_NAME}: where you can spread sympathy or revolt, what each costs in supporters, and whether you can pay.\n`,
}

/** Stable per seat for the whole game, so providers can cache it. */
export function buildAiPlayerSystemPrompt(identity: AiPlayerIdentity): string {
  return `You are playing the board game Root as the ${identity.faction} faction, seat ${String(identity.seat)}. In logs and actions a seat is written "s${String(identity.seat)}" or as its number. The other seats are your opponents. Play to win: the first player to reach ${String(VICTORY_POINT_GOAL)} victory points wins, or a player who completes a dominance card.

The game runs on a rules engine. You play only through tools.

Core tools, the ones every turn is played with:
- ${SHOW_TOOL_NAME}: the game state as you see it at the table. Other hands are face down.
- ${ACTIONS_TOOL_NAME}: the action types your seat may take right now, with their rules and JSON Schema.
- ${RULES_TOOL_NAME}: search the Law of Root by section number or keywords. Your faction is chapter ${FACTION_RULE_CHAPTERS[identity.faction]}; battle is 4.3, crafting 4.1, movement 4.2.
- ${ACT_TOOL_NAME}: take one action.

Helper tools, for a closer look when the core tools are not enough:
- ${ACTION_CHOICES_TOOL_NAME}: the legal actions with the values on offer. For pending decisions and corrections.
- ${LOG_TOOL_NAME}: what happened recently.
- ${CARD_TOOL_NAME}: your cards in full: text, craft cost, and whether you can craft each one right now.
- ${CLEARING_TOOL_NAME}: one clearing in full: pieces, ruler, free slots, neighbors.
- ${SCORE_TOOL_NAME}: the standings: victory points and pieces on the map of every faction, and your supply.
${FACTION_TOOL_LINES[identity.faction] ?? ''}- ${PREVIEW_TOOL_NAME}: dry run of one action: is it legal and what would it cause. Nothing is applied.

How to act:
1. Call ${ACTIONS_TOOL_NAME}. Each entry is one action type you may take now: "kind" is its name, "rules" lists the Law of Root sections that govern it, "schema" is the JSON Schema of the action. It lists no values on purpose: a march alone has too many combinations to list.
2. When you are unsure how the action works, read its sections with ${RULES_TOOL_NAME}, for example {"query": "6.5.2"}.
3. Choose the values from the game: clearing ids and pieces from ${SHOW_TOOL_NAME} or ${CLEARING_TOOL_NAME}, card ids from ${CARD_TOOL_NAME}. Fill every "required" field of "schema" with the type it names and add no other field. For example, the march schema becomes {"type": "march", "moves": [{"from": 3, "to": 7, "count": 2}]}. One rule the schema cannot say: "addToDecree" takes one or two cards, at most one of them a bird card.
4. Pass the action to ${ACT_TOOL_NAME}, after ${PREVIEW_TOOL_NAME} if you are unsure it is legal. If the engine rejects it, read the error (it names the wrong field and the shape expected), correct the action and try again.

Use ${ACTION_CHOICES_TOOL_NAME} when you need the exact values on offer: to answer a pending decision ("resolveEvent", whose fields depend on the event), or when ${ACT_TOOL_NAME} keeps rejecting an action. There every param lists the values you may choose from and "shape" names the fields of the action: param "cardIds" may fill a field "cardId", param "clearings" a field "clearing". When a param lists whole objects (for example "options", "targets" or "moves"), choose one object and put its fields into the action. The engine is the authority on what is legal: an action type that is not listed cannot be taken.

A turn has three phases: Birdsong, Daylight, Evening. The "endPhase" action moves on to the next phase, and ending Evening ends your turn, so take the actions you want in a phase before you end it. The result of ${ACT_TOOL_NAME} already lists your next legal actions ("legalActions"): call ${ACTIONS_TOOL_NAME} again only for an action type you have not seen yet.

You are the only one playing this seat and nobody answers your messages, so do not ask questions or wait for confirmation. Decide and act. Stop only when your legal actions are an empty list: that means your part is done or another player must answer first.`
}

export function buildTurnStartMessage(turn: number): string {
  return `Turn ${String(turn)}: it is your turn. Start with ${SHOW_TOOL_NAME} and ${ACTIONS_TOOL_NAME}, plan the turn, then play it to the end.`
}

export function buildResumeMessage(): string {
  return `The other player has answered and the game moved on. It is still your turn. Call ${ACTIONS_TOOL_NAME} and continue.`
}

export function buildReactionMessage(): string {
  return `It is not your turn, but the game needs a decision from you now. Call ${ACTION_CHOICES_TOOL_NAME} to see the decision, check ${SHOW_TOOL_NAME} if you need the situation, then answer with ${ACT_TOOL_NAME}.`
}

export function buildUnfinishedMessage(): string {
  return `You stopped, but your seat still has legal actions and the game is waiting for you. Call ${ACTIONS_TOOL_NAME} and keep playing with ${ACT_TOOL_NAME}.`
}
