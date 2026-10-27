import { describe, expect, it } from 'vitest'
import type { GameState } from '#api/client.ts'
import { woodlandMomentsBetween } from '#game/woodlandMoments.ts'
import { makeGameState } from '#test/factories.ts'

const EYRIE_SEAT = 1
const FOX_CLEARING = 0

type EyrieBoardFixture = {
  leader: string | null
  leadersFaceDown: string[]
  decree: Record<string, Array<{ id: string; defId: string }>>
}

function stateWithEyrieBoard(
  board: EyrieBoardFixture,
  overrides: Partial<GameState> = {},
): GameState {
  const base: GameState = makeGameState()
  return {
    ...base,
    players: base.players.map((player) =>
      player.seat === EYRIE_SEAT
        ? { ...player, board: { kind: 'eyrie', leadersFaceUp: [], ...board } }
        : player,
    ),
    ...overrides,
  }
}

const VIZIER = { id: 'VIZIER#1', defId: 'VIZIER' }
const EMPTY_DECREE = { recruit: [], move: [], battle: [], build: [] }

describe('woodlandMomentsBetween', () => {
  it('tells nothing for the first state seen', () => {
    const next: GameState = makeGameState()
    expect(
      woodlandMomentsBetween(null, next, [
        { t: 'action', actor: 0, action: { type: 'explore' } },
      ]),
    ).toEqual([])
  })

  it('tells an explore and a revolt with the suit of its clearing', () => {
    const state: GameState = makeGameState()
    expect(
      woodlandMomentsBetween(state, state, [
        { t: 'action', actor: 0, action: { type: 'explore' } },
        {
          t: 'action',
          actor: 1,
          action: { type: 'revolt', clearing: FOX_CLEARING, supporterIds: [] },
        },
      ]),
    ).toEqual([
      { kind: 'explore', seat: 0, faction: 'marquise' },
      { kind: 'revolt', seat: 1, faction: 'eyrie', suit: 'fox' },
    ])
  })

  it('tells a bot explore and a bot revolt like their human ones', () => {
    const state: GameState = makeGameState()
    expect(
      woodlandMomentsBetween(state, state, [
        {
          t: 'action',
          actor: 0,
          action: { type: 'botExplore', clearing: FOX_CLEARING, item: 'boot' },
        },
        {
          t: 'action',
          actor: 1,
          action: { type: 'botRevolt', clearing: FOX_CLEARING },
        },
      ]),
    ).toEqual([
      { kind: 'explore', seat: 0, faction: 'marquise' },
      { kind: 'revolt', seat: 1, faction: 'eyrie', suit: 'fox' },
    ])
  })

  it('tells a turmoil with the failed card, the loss and the deposed leader', () => {
    const previous: GameState = stateWithEyrieBoard(
      {
        leader: 'commander',
        leadersFaceDown: [],
        decree: {
          ...EMPTY_DECREE,
          recruit: [VIZIER],
          move: [{ id: 'ROOT-205#1', defId: 'ROOT-205' }],
        },
      },
      {
        turnScratch: { decree: { column: 'move', remaining: ['ROOT-205#1'] } },
      },
    )
    const [moment] = woodlandMomentsBetween(previous, previous, [
      { t: 'vp', actor: EYRIE_SEAT, delta: -1, reason: 'turmoil humiliate' },
      { t: 'action', actor: EYRIE_SEAT, action: { type: 'turmoil' } },
    ])
    expect(moment).toMatchObject({
      kind: 'turmoil',
      seat: EYRIE_SEAT,
      humiliateLoss: 1,
      deposedLeader: 'commander',
      failedCard: { columnId: 'move' },
    })
    expect(moment?.kind === 'turmoil' ? moment.decree[0]?.cards : []).toEqual([
      { suit: 'bird', isVizier: true, failed: false },
    ])
  })

  it('tells the chosen leader, the face-down ones and the vizier columns', () => {
    const previous: GameState = stateWithEyrieBoard({
      leader: null,
      leadersFaceDown: ['commander'],
      decree: EMPTY_DECREE,
    })
    const next: GameState = stateWithEyrieBoard({
      leader: 'charismatic',
      leadersFaceDown: ['commander'],
      decree: { ...EMPTY_DECREE, recruit: [VIZIER], battle: [VIZIER] },
    })
    expect(
      woodlandMomentsBetween(previous, next, [
        {
          t: 'event',
          event: { type: 'chooseLeader', seat: EYRIE_SEAT, reason: 'depose' },
        },
      ]),
    ).toEqual([
      {
        kind: 'leaderPick',
        seat: EYRIE_SEAT,
        faction: 'eyrie',
        chosen: 'charismatic',
        faceDown: ['commander'],
        vizierColumns: ['recruit', 'battle'],
      },
    ])
  })
})
