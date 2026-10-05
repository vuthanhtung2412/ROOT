import { describe, expect, it } from 'vitest'
import {
  QUEST_DECK,
  QUEST_DEFS,
  expandQuestDeck,
  questDefOf,
} from '#cards/quests.js'
import type { ItemType } from '#pieces/types.js'

describe('quest deck', () => {
  it('Rule: Vagabond components — 15 quests, 5 per fox/mouse/rabbit', () => {
    expect(QUEST_DEFS).toHaveLength(15)
    expect(expandQuestDeck()).toHaveLength(15)
    expect(QUEST_DECK).toHaveLength(15)

    const bySuit = { fox: 0, mouse: 0, rabbit: 0 }
    for (const definition of QUEST_DEFS) {
      bySuit[definition.suit] += 1
      expect(definition.items).toHaveLength(2)
    }
    expect(bySuit).toEqual({ fox: 5, mouse: 5, rabbit: 5 })
  })

  it('Rule: Vagabond > Quest — item pairs match standard combo chart', () => {
    const pairKey = (items: readonly [ItemType, ItemType]): string => {
      const sorted = [...items].sort()
      return `${sorted[0]!}+${sorted[1]!}`
    }
    const counts = new Map<string, number>()
    for (const definition of QUEST_DEFS) {
      const key = pairKey(definition.items)
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    expect(Object.fromEntries(counts)).toEqual({
      'boot+boot': 1,
      'bag+boot': 2,
      'sword+sword': 2,
      'crossbow+torch': 2,
      'sword+torch': 2,
      'tea+torch': 2,
      'boot+tea': 2,
      'coin+tea': 1,
      'hammer+torch': 1,
    })
  })

  it('questDefOf resolves physical card', () => {
    const card = QUEST_DECK[0]!
    expect(questDefOf(card).defId).toBe(card.defId)
  })
})
