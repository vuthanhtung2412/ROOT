import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { app } from '#openapi.js'
import { PLAYER_VIEW } from '#schemas/common.js'
import { DEFAULT_LOBBY_MODE, store } from '#store/GameStore.js'
import {
  createPlayingTwoPlayerGame,
  FIRST_TEST_PLAYER_ID,
  SECOND_TEST_PLAYER_ID,
} from '#test/gameStateFixtures.js'
import type { ExplainedAction } from '#view/explainLegalActions.js'

const EXPLAINED_ACTIONS_PATH = '/game/actions/explained'
const NOT_FOUND_STATUS = 404

function asPlayer(playerId: string): RequestInit {
  return { headers: { 'X-Player-Id': playerId } }
}

describe('GET /game/actions/explained', () => {
  beforeEach((): void => {
    store.game = createPlayingTwoPlayerGame()
    store.mode = DEFAULT_LOBBY_MODE
  })

  afterEach((): void => {
    store.game = null
  })

  it('lists the legal actions with kind, rules and schema', async () => {
    const response = await app.request(EXPLAINED_ACTIONS_PATH)

    expect(response.status).toBe(200)
    const body: { actions: ExplainedAction[] } = await response.json()
    expect(body.actions).toContainEqual(
      expect.objectContaining({
        type: 'march',
        kind: 'March',
        rules: [
          { section: '6.5.2', title: 'March' },
          { section: '4.2', title: 'Move' },
        ],
      }),
    )
  })

  it('keeps only the seat of the caller in the player view', async () => {
    const path = `${EXPLAINED_ACTIONS_PATH}?view=${PLAYER_VIEW}`
    const asMarquise = await app.request(path, asPlayer(FIRST_TEST_PLAYER_ID))
    const asEyrie = await app.request(path, asPlayer(SECOND_TEST_PLAYER_ID))

    const marquiseBody: { actions: ExplainedAction[] } = await asMarquise.json()
    const eyrieBody: { actions: ExplainedAction[] } = await asEyrie.json()
    expect(marquiseBody.actions.length).toBeGreaterThan(0)
    expect(eyrieBody.actions).toEqual([])
  })

  it('answers 404 when no game is in the slot', async () => {
    store.game = null

    const response = await app.request(EXPLAINED_ACTIONS_PATH)

    expect(response.status).toBe(NOT_FOUND_STATUS)
  })
})
