import { describe, expect, it } from 'vitest'
import { LuFootprints, LuPlay } from 'react-icons/lu'
import { makeActionSpec } from '#test/factories.ts'
import { FALLBACK_ACTION_ICON, actionIconFor } from '#ui/actionIcons.ts'

const UNKNOWN_ACTION_TYPE = 'notAnActionType'
const MOVE_ACTION_TYPES: readonly string[] = [
  'march',
  'vbMove',
  'crusadeMove',
  'riverfolkMove',
]

describe('actionIconFor', () => {
  it('gives every move action the same icon', () => {
    for (const actionType of MOVE_ACTION_TYPES) {
      const spec = makeActionSpec({ type: actionType })
      expect(actionIconFor(spec.type)).toBe(LuFootprints)
    }
  })

  it('gives end phase the play icon', () => {
    const spec = makeActionSpec({ type: 'endPhase' })
    expect(actionIconFor(spec.type)).toBe(LuPlay)
  })

  it('falls back for an action type without an icon', () => {
    const spec = makeActionSpec({ type: UNKNOWN_ACTION_TYPE })
    expect(actionIconFor(spec.type)).toBe(FALLBACK_ACTION_ICON)
  })
})
