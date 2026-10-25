import { appendFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Game } from '@root/lib'
import type { AiPlayerActivity } from '#aiPlayer/AiPlayerActivityFeed.js'
import { logAiPlayerActivity } from '#debug/logAiPlayerActivity.js'
import { store } from '#store/GameStore.js'
import { createStartedTwoPlayerGame } from '#test/gameStateFixtures.js'
import { resetAllRooms } from '#test/roomFixtures.js'

const GAME_LOGS_DIRECTORY = '/logs'

vi.mock('node:fs', () => ({ appendFileSync: vi.fn() }))
vi.mock('#debug/logGame.js', () => ({
  gameLogDirectory: (gameId: string): string => `${GAME_LOGS_DIRECTORY}/${gameId}`,
}))

function makeActivity(text: string): AiPlayerActivity {
  return {
    kind: 'reply',
    toolName: null,
    text,
    isError: false,
    roomCode: null,
    seat: 1,
    model: 'anthropic:claude-opus-5-5',
    sequence: 1,
    at: '2026-10-13T20:00:00.000Z',
  }
}

describe('logAiPlayerActivity', () => {
  beforeEach(() => {
    vi.mocked(appendFileSync).mockReset()
  })

  afterEach(() => {
    resetAllRooms()
  })

  it('appends the whole activity as one JSON line beside the log of its game', () => {
    const game: Game = createStartedTwoPlayerGame()
    store.game = game
    const activity = makeActivity('I recruit first.\nThen I march to the roost.')

    logAiPlayerActivity(activity)

    expect(appendFileSync).toHaveBeenCalledWith(
      `${GAME_LOGS_DIRECTORY}/${game.state.id}/ai-players.jsonl`,
      `${JSON.stringify(activity)}\n`,
      'utf8',
    )
  })

  it('skips an activity whose room no longer has a game', () => {
    logAiPlayerActivity(makeActivity('too late'))

    expect(appendFileSync).not.toHaveBeenCalled()
  })

  it('does not throw when the file cannot be written', () => {
    store.game = createStartedTwoPlayerGame()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(appendFileSync).mockImplementation(() => {
      throw new Error('disk full')
    })

    expect(() => {
      logAiPlayerActivity(makeActivity('unsaved'))
    }).not.toThrow()
    expect(consoleError).toHaveBeenCalledWith(
      'AI player activity not logged: disk full',
    )
    consoleError.mockRestore()
  })
})
