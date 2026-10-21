import { setTimeout as wait } from 'node:timers/promises'
import type { LogEntry } from '@root/lib'
import { aiPlayerDriver } from '#aiPlayer/aiPlayerRuntime.js'
import { BotStepDriver } from '#bots/BotStepDriver.js'
import { logGameEvent } from '#debug/logGame.js'
import { persistCurrentGame } from '#store/gamePersistence.js'
import { store } from '#store/GameStore.js'
import { broadcastCurrentGame } from '#ws/GameHub.js'

/** The bot pacer of the server's single game slot, wired to the real world. */
export const botStepDriver = new BotStepDriver({
  wait: (milliseconds: number): Promise<void> => wait(milliseconds),
  publishGameChange: (stepLog: readonly LogEntry[]): void => {
    if (store.game !== null) logGameEvent('ACT', store.game.state, undefined, [...stepLog])
    persistCurrentGame()
    broadcastCurrentGame()
    aiPlayerDriver.handleGameChanged()
  },
  reportFailure: (error: unknown): void => {
    console.error('bot step failed', error)
  },
})
