import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { app } from '#openapi.js'
import { DEFAULT_LOBBY_MODE, store } from '#store/GameStore.js'
import {
  createPlayingTwoPlayerGame,
  FIRST_TEST_PLAYER_ID,
  SECOND_TEST_PLAYER_ID,
} from '#test/gameStateFixtures.js'

const ROOST_CLEARING = 2

function toolRequest(body: object, playerId?: string): RequestInit {
  return {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(playerId === undefined ? {} : { 'X-Player-Id': playerId }),
    },
    body: JSON.stringify(body),
  }
}

describe('player tool routes', () => {
  beforeEach((): void => {
    store.game = createPlayingTwoPlayerGame()
    store.mode = DEFAULT_LOBBY_MODE
  })

  afterEach((): void => {
    store.game = null
  })

  it('runs a read-only tool as the seat of the caller', async () => {
    const response = await app.request(
      '/game/player-tools/clearing',
      toolRequest({ clearing: ROOST_CLEARING }, FIRST_TEST_PLAYER_ID),
    )

    expect(response.status).toBe(200)
    const body: { content: string; isError: boolean } = await response.json()
    expect(body.isError).toBe(false)
    expect(JSON.parse(body.content)).toMatchObject({
      id: ROOST_CLEARING,
      ruler: 'eyrie',
    })
  })

  it('previews an action without applying it', async () => {
    const historyLength = store.game?.history.length

    const response = await app.request(
      '/game/player-tools/preview',
      toolRequest({ action: { type: 'endPhase' } }, FIRST_TEST_PLAYER_ID),
    )

    const body: { content: string; isError: boolean } = await response.json()
    expect(JSON.parse(body.content)).toMatchObject({ legal: true })
    expect(store.game?.history.length).toBe(historyLength)
  })

  it('answers a seat-only tool with an error to another faction or to nobody', async () => {
    const asMarquise = await app.request(
      '/game/player-tools/decree',
      toolRequest({}, FIRST_TEST_PLAYER_ID),
    )
    const asEyrie = await app.request(
      '/game/player-tools/decree',
      toolRequest({}, SECOND_TEST_PLAYER_ID),
    )
    const asNobody = await app.request(
      '/game/player-tools/card',
      toolRequest({}),
    )

    expect(await asMarquise.json()).toMatchObject({ isError: true })
    expect(await asEyrie.json()).toMatchObject({ isError: false })
    expect(await asNobody.json()).toMatchObject({ isError: true })
  })

  it('refuses act and unknown tools: this route never changes the game', async () => {
    const historyLength = store.game?.history.length

    const act = await app.request(
      '/game/player-tools/act',
      toolRequest({ action: { type: 'endPhase' } }, FIRST_TEST_PLAYER_ID),
    )
    const unknown = await app.request(
      '/game/player-tools/snapshot',
      toolRequest({}, FIRST_TEST_PLAYER_ID),
    )

    expect(act.status).toBe(400)
    expect(await act.json()).toMatchObject({ code: 'UNKNOWN_PLAYER_TOOL' })
    expect(unknown.status).toBe(400)
    expect(store.game?.history.length).toBe(historyLength)
  })

  it('answers 404 when no game is in the slot', async () => {
    store.game = null

    const response = await app.request(
      '/game/player-tools/score',
      toolRequest({}, FIRST_TEST_PLAYER_ID),
    )

    expect(response.status).toBe(404)
  })
})
