import { afterEach, describe, expect, it, vi } from 'vitest'
import { Game, type LogEntry } from '@root/lib'
import { BotStepDriver } from '#bots/BotStepDriver.js'
import { DEFAULT_BOT_STEP_DELAY_SECONDS, DEFAULT_LOBBY_MODE, store } from '#store/GameStore.js'

const BOT_FIRST_TABLE = ['electricEyrie', 'alliance'] as const
const HOST_PACE_SECONDS = 2
const MILLISECONDS_PER_SECOND = 1000

/** Started game where the Electric Eyrie (seat 0) takes the first turn, bots paced. */
function botFirstGame(): Game {
  const game = Game.create({ seed: 3, factions: [...BOT_FIRST_TABLE] })
  game.setBotPacing(true)
  game.join('alliance-player')
  game.start()
  expect(game.state.status).toBe('playing')
  return game
}

function createDriver(publishedLogs: LogEntry[][], waits: number[]): BotStepDriver {
  return new BotStepDriver({
    room: store,
    wait: async (milliseconds: number): Promise<void> => {
      waits.push(milliseconds)
    },
    publishGameChange: (stepLog: readonly LogEntry[]): void => {
      publishedLogs.push([...stepLog])
    },
    reportFailure: (error: unknown): void => {
      throw error
    },
  })
}

describe('BotStepDriver', () => {
  afterEach((): void => {
    store.game = null
    store.mode = DEFAULT_LOBBY_MODE
    store.botStepDelaySeconds = DEFAULT_BOT_STEP_DELAY_SECONDS
  })

  it('online: plays the bot one action at a time, a push and the host pace after each', async () => {
    const game = botFirstGame()
    store.game = game
    store.mode = 'online'
    store.botStepDelaySeconds = HOST_PACE_SECONDS
    const publishedLogs: LogEntry[][] = []
    const waits: number[] = []

    createDriver(publishedLogs, waits).handleGameChanged()

    await vi.waitFor((): void => {
      expect(game.botHasWork()).toBe(false)
    })
    expect(publishedLogs.length).toBeGreaterThan(1)
    expect(waits.length).toBeGreaterThan(0)
    expect(new Set(waits)).toEqual(new Set([HOST_PACE_SECONDS * MILLISECONDS_PER_SECOND]))
  })

  it('hotseat: leaves the bots alone', () => {
    const game = botFirstGame()
    store.game = game
    store.mode = 'hotseat'
    const publishedLogs: LogEntry[][] = []

    createDriver(publishedLogs, []).handleGameChanged()

    expect(game.botHasWork()).toBe(true)
    expect(publishedLogs).toEqual([])
  })
})
