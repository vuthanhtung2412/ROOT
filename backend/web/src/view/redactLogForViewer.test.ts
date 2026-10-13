import { describe, expect, it } from 'vitest'
import type { LogEntry } from '@root/lib'
import { createTwoPlayerGameState } from '#test/gameStateFixtures.js'
import { redactLogForViewer } from '#view/redactLogForViewer.js'

const MARQUISE_PLAYER_ID = 'marquise-secret'
const EYRIE_PLAYER_ID = 'eyrie-secret'
const MARQUISE_SEAT = 0
const EYRIE_SEAT = 1

describe('redactLogForViewer', () => {
  const state = createTwoPlayerGameState([
    { playerId: MARQUISE_PLAYER_ID, hand: [] },
    { playerId: EYRIE_PLAYER_ID, hand: [] },
  ])

  it('removes join ids from join entries', () => {
    const log: LogEntry[] = [
      { t: 'join', playerId: MARQUISE_PLAYER_ID, faction: 'marquise' },
      { t: 'join', playerId: EYRIE_PLAYER_ID, faction: 'eyrie' },
    ]
    const forEyrie = redactLogForViewer(log, state, EYRIE_PLAYER_ID)
    expect(forEyrie).toEqual([
      { t: 'join', faction: 'marquise' },
      { t: 'join', faction: 'eyrie' },
    ])
  })

  it('removes the join id from an expel entry', () => {
    const log: LogEntry[] = [
      { t: 'expel', playerId: EYRIE_PLAYER_ID, faction: 'eyrie' },
    ]

    const forMarquise = redactLogForViewer(log, state, MARQUISE_PLAYER_ID)

    expect(forMarquise).toEqual([{ t: 'expel', faction: 'eyrie' }])
  })

  it('hides the card of another seat hidden-card action, keeps the viewer own', () => {
    const log: LogEntry[] = [
      {
        t: 'action',
        actor: MARQUISE_SEAT,
        action: { type: 'aid', target: EYRIE_SEAT, cardId: 'ROOT-202#1' },
      },
      {
        t: 'action',
        actor: EYRIE_SEAT,
        action: { type: 'resolveEvent', cardId: 'ROOT-200#1' },
      },
    ]
    const forEyrie = redactLogForViewer(log, state, EYRIE_PLAYER_ID)
    expect(forEyrie).toEqual([
      {
        t: 'action',
        actor: MARQUISE_SEAT,
        action: { type: 'aid', target: EYRIE_SEAT, cardId: 'HIDDEN' },
      },
      log[1],
    ])
  })

  it('keeps public plays (craft) and does not mutate the log', () => {
    const craftEntry: LogEntry = {
      t: 'action',
      actor: MARQUISE_SEAT,
      action: { type: 'craft', cardId: 'ROOT-204#1' },
    }
    const log: LogEntry[] = [craftEntry]
    expect(redactLogForViewer(log, state, EYRIE_PLAYER_ID)).toEqual([craftEntry])
    expect(log[0]).toBe(craftEntry)
  })
})
