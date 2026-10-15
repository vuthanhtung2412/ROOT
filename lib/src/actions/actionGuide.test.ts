import { describe, expect, it } from 'vitest'
import { ACTION_GUIDE, type ActionGuideEntry } from '#actions/actionGuide.js'

const RULE_NUMBER_PATTERN = /^\d+(\.\d+)*$/

describe('ACTION_GUIDE', () => {
  it('names every action type in plain words', () => {
    for (const entry of Object.values(ACTION_GUIDE)) {
      expect(entry.kind.trim()).not.toBe('')
    }
  })

  it('cites at least one rule number per action type', () => {
    for (const entry of Object.values(ACTION_GUIDE)) {
      expect(entry.ruleSections.length).toBeGreaterThan(0)
      for (const ruleSection of entry.ruleSections) {
        expect(ruleSection).toMatch(RULE_NUMBER_PATTERN)
      }
    }
  })

  it('cites the march under Marquise march then Move', () => {
    const march: ActionGuideEntry = ACTION_GUIDE.march
    expect(march).toEqual({ kind: 'March', ruleSections: ['6.5.2', '4.2'] })
  })
})
