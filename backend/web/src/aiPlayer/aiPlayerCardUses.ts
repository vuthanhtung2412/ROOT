import type { CardDef, FactionId } from '@root/lib'

const BIRD_SUIT = 'bird'
const DISCARD_USE = 'discard: at Evening when your hand is over the limit'
const CRAFTABLE_CARD_TYPES: readonly CardDef['type'][] = [
  'item',
  'persistent',
  'partisan',
]

/** Where a card of this suit counts: a bird card matches every clearing. */
function clearingsOf(suit: string): string {
  return suit === BIRD_SUIT ? 'any clearing (bird is wild)' : `a ${suit} clearing`
}

/** Rule: 4.1 Craft, 4.3.1 Ambush, 3.3 Dominance — the same for every faction. */
function usesByCardType(definition: CardDef): string[] {
  if (CRAFTABLE_CARD_TYPES.includes(definition.type)) {
    return ['craft: pay the cost with your crafting pieces for its effect']
  }
  if (definition.type === 'ambush') {
    return [
      `ambush: as defender in a battle in ${clearingsOf(definition.suit)}, play to deal 2 hits before the roll`,
      'ambush: as attacker, play a matching ambush to cancel the one of the defender',
    ]
  }
  return [
    'dominance: in Daylight with 10 or more victory points, play it to win by its condition in place of points',
  ]
}

function usesByFaction(faction: FactionId, definition: CardDef): string[] {
  const where = clearingsOf(definition.suit)
  switch (faction) {
    case 'marquise':
      return [
        // Rule: 6.5.5 Overwork.
        `overwork: spend to place 1 wood at a sawmill in ${where}`,
        // Rule: 6.5 Extra Actions.
        ...(definition.suit === BIRD_SUIT
          ? ['spendBird: spend for 1 extra Daylight action']
          : []),
      ]
    case 'eyrie':
      return [
        // Rule: 7.4.2 Add to the Decree.
        `addToDecree: in any column; it then resolves every turn in ${where}`,
      ]
    case 'alliance':
      return [
        // Rule: 8.5.2 Mobilize, 8.5.3 Train, 8.4 Revolt and Spread Sympathy.
        `mobilize: add to your supporters, then spend it for a revolt or to spread sympathy in ${where}`,
        definition.suit === BIRD_SUIT
          ? 'train: spend to gain an officer if you have any base on the map'
          : `train: spend to gain an officer if your ${definition.suit} base is on the map`,
      ]
    case 'vagabond':
      return [
        // Rule: 9.5.4 Aid.
        `aid: exhaust an item and give it to a faction with pieces in your clearing, when you stand in ${where}`,
      ]
    case 'lizard':
      // Rule: 10.5 — bird cards are not wild for the Cult: sacrifice only.
      return definition.suit === BIRD_SUIT
        ? ['ritualSacrifice: reveal to move a warrior to your acolytes']
        : [
            `ritualBuild: reveal to place a garden in ${where} that you rule`,
            `ritualRecruit: reveal to place a warrior in ${where}`,
            'ritualScore: spend for the points of the matching Gardens track',
          ]
    case 'riverfolk':
      // Rule: 11.2.3 Public Hand, 11.2.6 Hand Card service.
      return ['hand card service: another player may buy this card from you']
    case 'mechanicalMarquise':
    case 'electricEyrie':
    case 'automatedAlliance':
    case 'vagabot':
      // Rule: Rootbotics 2.8.1 Poor Manual Dexterity — bots hold no cards.
      return []
  }
}

/** Everything a faction can do with a card in hand, whatever the phase. */
export function describeUsesInHand(
  faction: FactionId,
  definition: CardDef,
): string[] {
  return [
    ...usesByCardType(definition),
    ...usesByFaction(faction, definition),
    DISCARD_USE,
  ]
}
