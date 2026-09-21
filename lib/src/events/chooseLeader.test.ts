import { describe, expect, it, beforeEach } from 'vitest'
import { isVizier } from '../factions/eyrie/viziers.js'
import { Game } from '../game/Game.js'
import { FALL } from '../map/fall.js'
import { resetPlaceIds } from '../rules/place.js'
import { EYRIE_LEADERS, type DecreeColumn, type EyrieLeader } from '../state/boards.js'

function lobbyAfterKeep(seed = 42): Game {
  const game = Game.create({ seed })
  game.join('a')
  game.join('b')
  game.start()
  game.apply({ type: 'resolveEvent', clearing: FALL.corners[0]! })
  return game
}

describe('chooseLeader setup', () => {
  beforeEach(() => resetPlaceIds())

  it('Rule: 7.3.3 — after keep, all 4 leaders face-up for choose', () => {
    const game = lobbyAfterKeep()
    expect(game.state.status).toBe('setup')
    expect(game.state.pending[0]?.type).toBe('chooseLeader')
    const specs = game.legalActions()
    expect(specs[0]!.params?.leaders).toEqual([
      'builder',
      'charismatic',
      'commander',
      'despot',
    ])
  })

  it('Rule: 7.3.3 / 7.8 — each leader tucks viziers on matching columns', () => {
    const expected: Record<EyrieLeader, [DecreeColumn, DecreeColumn]> = {
      builder: ['recruit', 'move'],
      charismatic: ['recruit', 'battle'],
      commander: ['move', 'battle'],
      despot: ['move', 'build'],
    }
    for (const leader of EYRIE_LEADERS) {
      const [colA, colB] = expected[leader]
      resetPlaceIds()
      const game = lobbyAfterKeep(leader.length)
      game.apply({ type: 'resolveEvent', leader })
      expect(game.state.status).toBe('playing')
      const board = game.state.players[1]!.board
      expect(board.kind).toBe('eyrie')
      if (board.kind !== 'eyrie') throw new Error('expected eyrie')
      expect(board.leader).toBe(leader)
      expect(board.leadersFaceUp).not.toContain(leader)
      expect(board.leadersFaceDown).toEqual([])
      expect(isVizier(board.decree[colA][0]!)).toBe(true)
      expect(isVizier(board.decree[colB][0]!)).toBe(true)
    }
  })
})
