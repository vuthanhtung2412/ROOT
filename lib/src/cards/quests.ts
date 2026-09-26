import type { Suit } from '#map/types.js'
import type { ItemType } from '#pieces/types.js'

/** Clearing suit on a quest (never bird). Rule: Vagabond > Quest. */
export type QuestSuit = Suit

export type QuestDef = {
  defId: string
  name: string
  suit: QuestSuit
  /** Two items to exhaust (may be the same type twice). */
  items: readonly [ItemType, ItemType]
}

/**
 * Official 15-card quest deck (5 per fox/mouse/rabbit).
 * Item pairs from published combo chart (Make Craft Game / standard deck).
 * Rule: Vagabond > Setup 3; Quest 9.5.5; component list 15 Quests.
 */
export const QUEST_DEFS: readonly QuestDef[] = [
  // Fox (peaceful: no sword/crossbow)
  { defId: 'QUEST-F-FUNDS', name: 'Fundraising', suit: 'fox', items: ['coin', 'tea'] },
  { defId: 'QUEST-F-SHED', name: 'Repair a Shed', suit: 'fox', items: ['hammer', 'torch'] },
  { defId: 'QUEST-F-LOGS', name: 'Logistics', suit: 'fox', items: ['bag', 'boot'] },
  { defId: 'QUEST-F-SPEECH', name: 'Give a Speech', suit: 'fox', items: ['tea', 'torch'] },
  { defId: 'QUEST-F-ERRAND', name: 'Errand', suit: 'fox', items: ['boot', 'tea'] },
  // Mouse
  { defId: 'QUEST-M-BANDITS', name: 'Expel Bandits', suit: 'mouse', items: ['sword', 'sword'] },
  { defId: 'QUEST-M-BEAR', name: 'Fend Off a Bear', suit: 'mouse', items: ['crossbow', 'torch'] },
  { defId: 'QUEST-M-GUARD', name: 'Guard Duty', suit: 'mouse', items: ['sword', 'torch'] },
  { defId: 'QUEST-M-LOGS', name: 'Logistics', suit: 'mouse', items: ['bag', 'boot'] },
  { defId: 'QUEST-M-ESCORT', name: 'Escort', suit: 'mouse', items: ['boot', 'boot'] },
  // Rabbit
  { defId: 'QUEST-R-BANDITS', name: 'Expel Bandits', suit: 'rabbit', items: ['sword', 'sword'] },
  { defId: 'QUEST-R-BEAR', name: 'Fend Off a Bear', suit: 'rabbit', items: ['crossbow', 'torch'] },
  { defId: 'QUEST-R-GUARD', name: 'Guard Duty', suit: 'rabbit', items: ['sword', 'torch'] },
  { defId: 'QUEST-R-SPEECH', name: 'Give a Speech', suit: 'rabbit', items: ['tea', 'torch'] },
  { defId: 'QUEST-R-ERRAND', name: 'Errand', suit: 'rabbit', items: ['boot', 'tea'] },
] as const

/** One physical quest card. `id` = `${defId}#1`. */
export type QuestCard = {
  id: string
  defId: string
}

export function questDefOf(card: QuestCard): QuestDef {
  const definition = QUEST_DEFS.find((entry) => entry.defId === card.defId)
  if (definition === undefined) {
    throw new Error(`unknown quest defId: ${card.defId}`)
  }
  return definition
}

/** Expand defs into 15 physical quest cards. */
export function expandQuestDeck(): QuestCard[] {
  return QUEST_DEFS.map((definition) => ({
    id: `${definition.defId}#1`,
    defId: definition.defId,
  }))
}

export const QUEST_DECK: QuestCard[] = expandQuestDeck()
