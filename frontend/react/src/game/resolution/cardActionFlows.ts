import type {
  FlowDefinition,
  OptionLabels,
  OptionStep,
  OptionValue,
} from '#game/resolution/optionActionFlows.ts'

/** Label of a player, for a seat choice. */
function seatLabel(value: OptionValue, labels: OptionLabels): string {
  return typeof value === 'number' ? labels.seatName(value) : String(value)
}

/** Label of the enemy a warrior belongs to, for a `pieceId` choice. */
function warriorOwnerLabel(value: OptionValue, labels: OptionLabels): string {
  return labels.warriorOwnerName(String(value)) ?? String(value)
}

/** Name of an item in the actor's Crafted Items box, for an `itemIndex` choice. */
function craftedItemLabel(value: OptionValue, labels: OptionLabels): string {
  const name: string | null =
    typeof value === 'number' ? labels.craftedItemName(value) : null
  return name ?? `item ${String(value)}`
}

const ITEM_TO_EXHAUST_STEP: OptionStep = {
  field: 'itemIndex',
  kind: 'choice',
  prompt: 'pick item to exhaust',
  label: craftedItemLabel,
}

/**
 * Actions granted by crafted persistent cards. Every step is asked: a card
 * action is rare and optional, so nothing is picked for the player.
 */
export const CARD_ACTION_FLOWS: Readonly<Record<string, FlowDefinition>> = {
  // Propaganda Bureau: spend a card to replace an enemy warrior.
  propagandaBureau: {
    title: 'Propaganda Bureau',
    asksEveryStep: true,
    steps: [
      { field: 'clearing', kind: 'clearing', prompt: 'pick clearing' },
      {
        field: 'pieceId',
        kind: 'choice',
        prompt: 'whose warrior to replace?',
        label: warriorOwnerLabel,
      },
      { field: 'cardId', kind: 'card', prompt: 'pick matching card to spend' },
    ],
  },
  // Charm Offensive: draw a card, another player scores one point.
  charmOffensive: {
    title: 'Charm Offensive',
    asksEveryStep: true,
    steps: [
      {
        field: 'target',
        kind: 'choice',
        prompt: 'who scores one point?',
        label: seatLabel,
      },
    ],
  },
  // Informants: take an ambush card from the Discarded pile instead of drawing.
  informantsTakeAmbush: {
    title: 'Informants',
    asksEveryStep: true,
    steps: [
      {
        field: 'cardId',
        kind: 'pileCard',
        prompt: 'Take an ambush card instead of drawing',
      },
    ],
  },
  // League of Adventurous Mice: exhaust a crafted item to move or battle.
  leagueMove: {
    title: 'League of Adventurous Mice',
    asksEveryStep: true,
    steps: [
      ITEM_TO_EXHAUST_STEP,
      { field: 'from', kind: 'clearing', prompt: 'pick origin' },
      { field: 'to', kind: 'clearing', prompt: 'pick destination' },
      { field: 'count', kind: 'count', prompt: 'how many warriors?' },
    ],
  },
  leagueBattle: {
    title: 'League of Adventurous Mice',
    asksEveryStep: true,
    steps: [
      ITEM_TO_EXHAUST_STEP,
      { field: 'clearing', kind: 'clearing', prompt: 'pick clearing' },
      {
        field: 'defender',
        kind: 'choice',
        prompt: 'pick defender',
        label: seatLabel,
      },
    ],
  },
  // Swap Meet: take a random card; the card to give is asked next.
  swapMeet: {
    title: 'Swap Meet',
    asksEveryStep: true,
    steps: [
      {
        field: 'target',
        kind: 'choice',
        prompt: 'take a random card from…',
        label: seatLabel,
      },
    ],
  },
  // Saboteurs: discard it to discard a crafted card of an enemy.
  saboteurs: {
    title: 'Saboteurs',
    asksEveryStep: true,
    steps: [
      {
        field: 'target',
        kind: 'choice',
        prompt: 'pick enemy',
        label: seatLabel,
      },
      {
        field: 'cardId',
        kind: 'pileCard',
        prompt: 'Pick a crafted card to discard',
      },
    ],
  },
}

/** Tray labels of the card actions. */
export const CARD_ACTION_LABELS: Readonly<Record<string, string>> = {
  charmOffensive: 'charm offensive',
  informantsTakeAmbush: 'informants',
  leagueMove: 'league: move',
  leagueBattle: 'league: battle',
  propagandaBureau: 'propaganda bureau',
  saboteurs: 'saboteurs',
  swapMeet: 'swap meet',
}
