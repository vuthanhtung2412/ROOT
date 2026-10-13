import { describe, expect, it } from 'vitest'
import {
  loadRulebook,
  lookupRules,
  parseRulebook,
  type RuleSection,
} from '#aiPlayer/rulebook.js'

const RULEBOOK_FIXTURE = `# The Law of Test

Front matter.

## 4. Key Actions

### 4.3 Battle

#### 4.3.1 Step 1: Defender May Ambush.

The defender may play an ambush card.

#### 4.3.2 Step 2: Roll Dice.

Roll two dice. The attacker deals the higher roll.

## 7. Eyrie Dynasties

### 7.1 Overview

The Eyrie must follow the Decree or fall into turmoil.

## Appendix G. Glossary

Ambush: a card played by the defender.
`

function createRulebookSections(): RuleSection[] {
  return parseRulebook(RULEBOOK_FIXTURE)
}

function sectionTitles(sections: readonly RuleSection[]): string[] {
  return sections.map((section: RuleSection): string => section.title)
}

describe('parseRulebook', () => {
  it('splits by heading and reads the rule number', () => {
    const sections = createRulebookSections()

    expect(sections).toContainEqual({
      sectionNumber: '4.3.2',
      title: 'Step 2: Roll Dice.',
      text: 'Roll two dice. The attacker deals the higher roll.',
    })
    expect(sections).toContainEqual({
      sectionNumber: null,
      title: 'Appendix G. Glossary',
      text: 'Ambush: a card played by the defender.',
    })
  })
})

describe('lookupRules', () => {
  it('returns a numbered rule with its sub-rules', () => {
    const found = lookupRules(createRulebookSections(), '4.3')

    expect(found.map((section) => section.sectionNumber)).toEqual([
      '4.3',
      '4.3.1',
      '4.3.2',
    ])
  })

  it('does not treat 4.3 as a prefix of another number', () => {
    const sections: RuleSection[] = [
      { sectionNumber: '4.3', title: 'Battle', text: '' },
      { sectionNumber: '4.30', title: 'Other', text: '' },
    ]

    expect(sectionTitles(lookupRules(sections, '4.3'))).toEqual(['Battle'])
  })

  it('ranks keyword matches, heading words first', () => {
    const found = lookupRules(createRulebookSections(), 'ambush')

    expect(sectionTitles(found)).toEqual([
      'Step 1: Defender May Ambush.',
      'Appendix G. Glossary',
    ])
  })

  it('needs every query word in the section', () => {
    const found = lookupRules(createRulebookSections(), 'decree turmoil')

    expect(sectionTitles(found)).toEqual(['Overview'])
  })

  it('finds nothing for an unknown number or word', () => {
    expect(lookupRules(createRulebookSections(), '99')).toEqual([])
    expect(lookupRules(createRulebookSections(), 'submarine')).toEqual([])
  })
})

describe('loadRulebook', () => {
  it('reads the Law of Root', () => {
    const battle = lookupRules(loadRulebook(), '4.3')

    expect(battle[0]?.title).toContain('Battle')
  })
})
