import type {
  FlowDefinition,
  OptionLabels,
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
  propagandaBureau: 'propaganda bureau',
  saboteurs: 'saboteurs',
}
