import { describe, expect, it } from 'vitest'
import { findQuestSpec, QUEST_ACTION_TYPE } from '#game/vagabondQuest.ts'
import { makeActionSpec } from '#test/factories.ts'

const VAGABOND_SEAT = 3
const OTHER_SEAT = 0
const ESCORT_QUEST_ID = 'QUEST-M-ESCORT#1'
const GUARD_DUTY_QUEST_ID = 'QUEST-M-GUARD#1'
const FUNDRAISING_QUEST_ID = 'QUEST-F-FUNDS#1'

describe('findQuestSpec', () => {
  const questSpec = makeActionSpec({
    type: QUEST_ACTION_TYPE,
    actor: VAGABOND_SEAT,
    params: {
      questIds: [ESCORT_QUEST_ID, GUARD_DUTY_QUEST_ID],
      rewards: ['vp', 'draw'],
    },
  })
  const actions = [makeActionSpec(), questSpec]

  it('Rule: 9.5.5 Quest — narrows the action to the picked quest', () => {
    const spec = findQuestSpec(actions, {
      seat: VAGABOND_SEAT,
      questId: GUARD_DUTY_QUEST_ID,
    })

    expect(spec?.params).toEqual({
      questIds: [GUARD_DUTY_QUEST_ID],
      rewards: ['vp', 'draw'],
    })
  })

  it('returns null for a quest the Vagabond cannot complete now', () => {
    expect(
      findQuestSpec(actions, {
        seat: VAGABOND_SEAT,
        questId: FUNDRAISING_QUEST_ID,
      }),
    ).toBeNull()
  })

  it('ignores specs of another seat', () => {
    expect(
      findQuestSpec(actions, { seat: OTHER_SEAT, questId: ESCORT_QUEST_ID }),
    ).toBeNull()
  })
})
