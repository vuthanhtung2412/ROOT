import { describe, expect, it } from 'vitest'
import { createTwoPlayerGameState } from '#test/gameStateFixtures.js'
import { describePlayerLogEntry } from '#view/playerLogWords.js'

const MARQUISE_SEAT = 0
const EYRIE_SEAT = 1

describe('describePlayerLogEntry', () => {
  const state = createTwoPlayerGameState([
    { playerId: 'marquise-player' },
    { playerId: 'eyrie-player' },
  ])

  it('says who attacks whom in a battle and who takes the hits', () => {
    expect(
      describePlayerLogEntry(
        {
          t: 'event',
          event: {
            type: 'battle',
            clearing: 10,
            attacker: MARQUISE_SEAT,
            defender: EYRIE_SEAT,
            stage: 'roll',
            rolls: [3, 0],
            hits: { attacker: 2, defender: 0 },
          },
        },
        state,
      ),
    ).toBe(
      'BATTLE at C10: marquise (s0) attacks eyrie (s1) (stage roll); dice rolled 3 and 0; hits still to take: eyrie (s1) 2, marquise (s0) 0',
    )
  })

  it('counts the pieces each faction placed or lost in a clearing', () => {
    expect(
      describePlayerLogEntry(
        {
          t: 'pieces',
          clearing: 10,
          placed: [
            { id: 'sawmill', kind: 'building', type: 'sawmill', owner: MARQUISE_SEAT },
          ],
          removed: [
            { id: 'warrior-1', kind: 'warrior', owner: EYRIE_SEAT },
            { id: 'warrior-2', kind: 'warrior', owner: EYRIE_SEAT },
            { id: 'wood', kind: 'token', type: 'wood', owner: MARQUISE_SEAT },
          ],
        },
        state,
      ),
    ).toBe(
      'C10: marquise (s0) placed 1 sawmill; eyrie (s1) lost 2 warrior; marquise (s0) lost 1 wood',
    )
  })

  it('names the faction that scored, lost points, moved on or won', () => {
    expect(
      describePlayerLogEntry(
        { t: 'vp', actor: EYRIE_SEAT, delta: 2, reason: 'roosts' },
        state,
      ),
    ).toBe('eyrie (s1) scored 2 VP (roosts)')
    expect(
      describePlayerLogEntry(
        { t: 'vp', actor: EYRIE_SEAT, delta: -1, reason: 'turmoil humiliate' },
        state,
      ),
    ).toBe('eyrie (s1) lost 1 VP (turmoil humiliate)')
    expect(
      describePlayerLogEntry(
        { t: 'phase', actor: MARQUISE_SEAT, phase: 'daylight', step: 'actions' },
        state,
      ),
    ).toBe('marquise (s0) is now in daylight/actions')
    expect(
      describePlayerLogEntry({ t: 'win', winner: EYRIE_SEAT }, state),
    ).toBe('eyrie (s1) wins the game')
  })

  it('puts the faction in front of an action and keeps join ids out', () => {
    expect(
      describePlayerLogEntry(
        { t: 'action', actor: MARQUISE_SEAT, action: { type: 'recruit' } },
        state,
      ),
    ).toBe('marquise (s0): RECRUIT warriors at recruiters')
    expect(describePlayerLogEntry({ t: 'join', faction: 'eyrie' }, state)).toBe(
      'JOIN (eyrie)',
    )
  })
})
