import { appendFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AiPlayerActivity } from '#aiPlayer/AiPlayerActivityFeed.js'
import { logAiPlayerActivity } from '#debug/logAiPlayerActivity.js'

const GAME_LOG_DIRECTORY = '/logs/13-10-2026-20h00m'

vi.mock('node:fs', () => ({ appendFileSync: vi.fn() }))
vi.mock('#debug/logGame.js', () => ({
  currentGameLogDirectory: (): string => GAME_LOG_DIRECTORY,
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

  it('appends the whole activity as one JSON line beside the game log', () => {
    const activity = makeActivity('I recruit first.\nThen I march to the roost.')

    logAiPlayerActivity(activity)

    expect(appendFileSync).toHaveBeenCalledWith(
      `${GAME_LOG_DIRECTORY}/ai-players.jsonl`,
      `${JSON.stringify(activity)}\n`,
      'utf8',
    )
  })

  it('does not throw when the file cannot be written', () => {
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
