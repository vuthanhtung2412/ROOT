import { setTimeout as wait } from 'node:timers/promises'
import { AiPlayerDriver } from '#aiPlayer/AiPlayerDriver.js'
import type { ModelProviderName } from '#aiPlayer/modelIdentifier.js'
import type { ModelProvider } from '#aiPlayer/ModelProvider.js'
import { createModelProvider } from '#aiPlayer/providers/providerRegistry.js'
import { loadRulebook } from '#aiPlayer/rulebook.js'
import { persistCurrentGame } from '#store/gamePersistence.js'
import { broadcastCurrentGame } from '#ws/GameHub.js'

/** The driver of the server's single game slot, wired to the real world. */
export const aiPlayerDriver = new AiPlayerDriver({
  createProvider: (providerName: ModelProviderName): ModelProvider | null =>
    createModelProvider(providerName, process.env),
  loadRulebook,
  wait: (milliseconds: number): Promise<void> => wait(milliseconds),
  publishGameChange: (): void => {
    persistCurrentGame()
    broadcastCurrentGame()
  },
  publishStatusChange: broadcastCurrentGame,
})
