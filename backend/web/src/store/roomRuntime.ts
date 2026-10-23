import { setTimeout as wait } from 'node:timers/promises'
import type { LogEntry } from '@root/lib'
import {
  aiPlayerActivityFeed,
  type AiPlayerSeatActivity,
} from '#aiPlayer/AiPlayerActivityFeed.js'
import { AiPlayerDriver } from '#aiPlayer/AiPlayerDriver.js'
import type { ModelProviderName } from '#aiPlayer/modelIdentifier.js'
import type { ModelProvider } from '#aiPlayer/ModelProvider.js'
import { createModelProvider } from '#aiPlayer/providers/providerRegistry.js'
import { loadRulebook } from '#aiPlayer/rulebook.js'
import { BotStepDriver } from '#bots/BotStepDriver.js'
import { logGameEvent } from '#debug/logGame.js'
import { persistRoom } from '#store/gamePersistence.js'
import type { GameRoom } from '#store/GameStore.js'
import { broadcastCurrentGame } from '#ws/GameHub.js'

/** What plays the seats no human sits at, for one room. */
export type RoomRuntime = {
  aiPlayerDriver: AiPlayerDriver
  botStepDriver: BotStepDriver
}

const runtimesByRoom = new WeakMap<GameRoom, RoomRuntime>()

function createRoomRuntime(room: GameRoom): RoomRuntime {
  const aiPlayerDriver = new AiPlayerDriver({
    room,
    createProvider: (providerName: ModelProviderName): ModelProvider | null =>
      createModelProvider(providerName, process.env),
    loadRulebook,
    wait: (milliseconds: number): Promise<void> => wait(milliseconds),
    publishGameChange: (): void => {
      persistRoom(room)
      broadcastCurrentGame(room)
    },
    publishStatusChange: (): void => {
      broadcastCurrentGame(room)
    },
    publishActivity: (activity: AiPlayerSeatActivity): void => {
      aiPlayerActivityFeed.publish(activity)
    },
  })
  const botStepDriver = new BotStepDriver({
    room,
    wait: (milliseconds: number): Promise<void> => wait(milliseconds),
    publishGameChange: (stepLog: readonly LogEntry[]): void => {
      if (room.game !== null) logGameEvent('ACT', room.game.state, undefined, [...stepLog])
      persistRoom(room)
      broadcastCurrentGame(room)
      aiPlayerDriver.handleGameChanged()
    },
    reportFailure: (error: unknown): void => {
      console.error('bot step failed', error)
    },
  })
  return { aiPlayerDriver, botStepDriver }
}

/** The room's drivers, made on first use and kept while the room lives. */
export function runtimeOf(room: GameRoom): RoomRuntime {
  const existing = runtimesByRoom.get(room)
  if (existing !== undefined) {
    return existing
  }
  const runtime = createRoomRuntime(room)
  runtimesByRoom.set(room, runtime)
  return runtime
}
