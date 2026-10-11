import type {
  FlowDefinition,
  OptionLabels,
  OptionValue,
} from '#game/resolution/optionActionFlows.ts'

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
}

/** Tray labels of the card actions. */
export const CARD_ACTION_LABELS: Readonly<Record<string, string>> = {
  propagandaBureau: 'propaganda bureau',
}
