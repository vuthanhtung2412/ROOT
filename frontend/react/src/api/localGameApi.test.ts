import { describe, expect, it } from 'vitest'
import { ApiError } from '#api/client.ts'
import type { GameSocketPush } from '#api/gameSocket.ts'
import { createLocalGame, type LocalGame } from '#api/localGameApi.ts'
import type { PlayerIdentityStorage } from '#game/playerIdentity.ts'
import type { BotSettingsByFaction } from '@root/lib/bot-settings'

const SOLO_FACTIONS: string[] = ['alliance', 'mechanicalMarquise', 'electricEyrie']
const HUMAN_PLAYER_ID = 'alliance'

function makeMemoryStorage(): PlayerIdentityStorage {
  const entries: Map<string, string> = new Map<string, string>()
  return {
    getItem: (key: string): string | null => entries.get(key) ?? null,
    setItem: (key: string, value: string): void => {
      entries.set(key, value)
    },
    removeItem: (key: string): void => {
      entries.delete(key)
    },
  }
}

async function startSoloParty(localGame: LocalGame): Promise<void> {
  await localGame.api.createGame({ factions: SOLO_FACTIONS, replace: true })
  await localGame.api.join(HUMAN_PLAYER_ID)
  await localGame.api.start()
}

describe('createLocalGame', () => {
  it('seats both bots by themselves and starts a solo party', async () => {
    const localGame: LocalGame = createLocalGame(makeMemoryStorage())
    await startSoloParty(localGame)

    const game = await localGame.api.getGame()

    expect(game.state.status).not.toBe('waiting')
    expect(game.mode).toBe('hotseat')
    expect(game.state.players.map((player) => player.playerId)).toEqual([
      HUMAN_PLAYER_ID,
      'bot-mechanicalMarquise',
      'bot-electricEyrie',
    ])
    expect((await localGame.api.legalActions()).actions.length).toBeGreaterThan(0)
  })

  it('creates the solo party with the bot difficulty and traits picked in the menu', async () => {
    const localGame: LocalGame = createLocalGame(makeMemoryStorage())
    const botSettings: BotSettingsByFaction = {
      electricEyrie: { difficulty: 'nightmare', traits: ['swoop'] },
    }
    await localGame.api.createGame({ factions: SOLO_FACTIONS, replace: true, botSettings })

    expect((await localGame.api.getGame()).state.botSettings).toEqual(botSettings)
  })

  it('rejects an illegal action with an ApiError', async () => {
    const localGame: LocalGame = createLocalGame(makeMemoryStorage())
    await startSoloParty(localGame)

    await expect(
      localGame.api.submitAction({ type: 'craft', cardId: 'missing' }),
    ).rejects.toBeInstanceOf(ApiError)
  })

  it('has no game once deleted', async () => {
    const localGame: LocalGame = createLocalGame(makeMemoryStorage())
    await startSoloParty(localGame)

    await localGame.api.deleteGame()

    await expect(localGame.api.getGame()).rejects.toMatchObject({
      code: 'NO_GAME',
    })
  })

  it('pushes the new state to connected listeners after a change', async () => {
    const localGame: LocalGame = createLocalGame(makeMemoryStorage())
    const pushes: GameSocketPush[] = []
    localGame.connectSocket({
      url: 'local',
      handlers: {
        onPush: (payload: GameSocketPush): void => {
          pushes.push(payload)
        },
      },
    })

    await startSoloParty(localGame)
    await Promise.resolve()

    expect(pushes.at(-1)?.state?.status).not.toBe('waiting')
    expect(pushes.at(-1)?.legalActions.length).toBeGreaterThan(0)
  })

  it('restores the saved game after a page reload', async () => {
    const storage: PlayerIdentityStorage = makeMemoryStorage()
    const firstPage: LocalGame = createLocalGame(storage)
    await startSoloParty(firstPage)
    const before = await firstPage.api.getGame()

    const reloadedPage: LocalGame = createLocalGame(storage)

    expect(reloadedPage.restoreSavedGame()).toBe(true)
    const after = await reloadedPage.api.getGame()
    expect(after.state).toEqual(before.state)
    expect(after.historyLength).toBe(before.historyLength)
  })

  it('restores nothing when no game was saved', () => {
    expect(createLocalGame(makeMemoryStorage()).restoreSavedGame()).toBe(false)
  })
})

/** Settles the playback: its steps run between macrotasks. */
async function settleBotPlayback(): Promise<void> {
  for (let tick = 0; tick < PLAYBACK_SETTLE_TICKS; tick += 1) {
    await new Promise<void>((resolve: () => void): void => {
      setTimeout(resolve, 0)
    })
  }
}

const PLAYBACK_SETTLE_TICKS = 50
const HUMAN_SEAT = 0
const MAXIMUM_HUMAN_PHASE_ENDS = 20

describe('createLocalGame bot playback', () => {
  it('pushes each bot action on its own and pauses after it', async () => {
    let pauseCount = 0
    const localGame: LocalGame = createLocalGame(makeMemoryStorage(), {
      waitAfterBotAction: async (): Promise<void> => {
        pauseCount += 1
      },
    })
    const botSeatsPushed: number[] = []
    let botPromptsPushed = 0
    localGame.connectSocket({
      url: 'local',
      handlers: {
        onPush: (payload: GameSocketPush): void => {
          const seat: number | undefined = payload.state?.currentSeat
          if (seat !== undefined && seat !== HUMAN_SEAT) botSeatsPushed.push(seat)
          const isPromptPending: boolean = (payload.state?.pending.length ?? 0) > 0
          if (isPromptPending && payload.legalActions.every((spec) => spec.actor !== HUMAN_SEAT)) {
            botPromptsPushed += 1
          }
        },
      },
    })
    await startSoloParty(localGame)
    await settleBotPlayback()

    for (let phaseEnd = 0; phaseEnd < MAXIMUM_HUMAN_PHASE_ENDS; phaseEnd += 1) {
      const game = await localGame.api.getGame()
      if (game.state.turn > 1 && game.state.currentSeat === HUMAN_SEAT) break
      if (game.state.currentSeat === HUMAN_SEAT) {
        await localGame.api.submitAction({ type: 'endPhase' })
      }
      await settleBotPlayback()
    }

    expect(pauseCount).toBeGreaterThan(0)
    expect(new Set(botSeatsPushed)).toEqual(new Set([1, 2]))
    expect(botPromptsPushed).toBe(0)
    expect((await localGame.api.getGame()).state.currentSeat).toBe(HUMAN_SEAT)
  })
})
