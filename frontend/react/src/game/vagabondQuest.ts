import type { ActionSpec } from '#api/client.ts'
import { readChoiceParams } from '#game/resolution/ActionComposer.ts'

export const QUEST_ACTION_TYPE = 'quest'

export interface QuestPick {
  seat: number
  questId: string
}

/**
 * Rule: 9.5.5 Quest — the legal quest action narrowed to this one quest, or
 * null when the Vagabond cannot complete it now.
 */
export function findQuestSpec(
  actions: readonly ActionSpec[],
  pick: QuestPick,
): ActionSpec | null {
  for (const spec of actions) {
    if (spec.type !== QUEST_ACTION_TYPE || spec.actor !== pick.seat) {
      continue
    }
    const completableQuestIds = readChoiceParams(spec).questIds ?? []
    if (completableQuestIds.includes(pick.questId)) {
      return { ...spec, params: { ...spec.params, questIds: [pick.questId] } }
    }
  }
  return null
}
