import { describe, expect, it } from 'vitest'
import {
  EYRIE_LEADER_CATALOG,
  formatEyrieLeaderOptionLabel,
  isEyrieLeaderId,
  lookupEyrieLeader,
} from './eyrieLeaderCatalog.ts'

describe('eyrieLeaderCatalog', () => {
  it('covers all four official leaders with card ability text', () => {
    expect(Object.keys(EYRIE_LEADER_CATALOG).sort()).toEqual([
      'builder',
      'charismatic',
      'commander',
      'despot',
    ])
    expect(lookupEyrieLeader('builder')?.ability).toContain('Disdain for Trade')
    expect(lookupEyrieLeader('charismatic')?.ability).toContain('two warriors')
    expect(lookupEyrieLeader('commander')?.ability).toContain('extra hit')
    expect(lookupEyrieLeader('despot')?.ability).toContain('building or token')
  })

  it('formats option labels with decree columns', () => {
    expect(formatEyrieLeaderOptionLabel('builder')).toBe(
      'Builder · Recruit & Move',
    )
    expect(formatEyrieLeaderOptionLabel('unknown')).toBe('unknown')
    expect(isEyrieLeaderId('despot')).toBe(true)
    expect(isEyrieLeaderId('vagabond')).toBe(false)
  })
})
