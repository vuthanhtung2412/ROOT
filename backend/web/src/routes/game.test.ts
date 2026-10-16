import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { app } from '#openapi.js'
import { DEFAULT_LOBBY_MODE, store } from '#store/GameStore.js'

function jsonRequest(method: string, body: object): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}

describe('game routes', () => {
  beforeEach((): void => {
    store.game = null
    store.mode = DEFAULT_LOBBY_MODE
  })

  afterEach((): void => {
    store.game = null
    store.mode = DEFAULT_LOBBY_MODE
  })

  it('supports the game lifecycle, snapshots, undo, and slot conflicts', async () => {
    const createResponse = await app.request(
      '/game',
      jsonRequest('POST', { factions: ['marquise', 'eyrie'] }),
    )
    expect(createResponse.status).toBe(201)

    const conflictResponse = await app.request(
      '/game',
      jsonRequest('POST', { factions: ['marquise', 'eyrie'] }),
    )
    expect(conflictResponse.status).toBe(409)

    const firstJoinResponse = await app.request(
      '/game/join',
      jsonRequest('POST', { playerId: 'first-player' }),
    )
    const secondJoinResponse = await app.request(
      '/game/join',
      jsonRequest('POST', { playerId: 'second-player' }),
    )
    expect(firstJoinResponse.status).toBe(200)
    expect(secondJoinResponse.status).toBe(200)

    const startResponse = await app.request('/game/start', { method: 'POST' })
    expect(startResponse.status).toBe(200)
    expect(store.game?.state.status).toBe('setup')

    const historyBeforeAction = store.game?.history.length
    const actionResponse = await app.request(
      '/game/actions',
      jsonRequest('POST', { type: 'resolveEvent', clearing: 0 }),
    )
    expect(actionResponse.status).toBe(200)
    expect(store.game?.history.length).toBe((historyBeforeAction ?? 0) + 1)

    const snapshotResponse = await app.request('/game/snapshot')
    expect(snapshotResponse.status).toBe(200)
    const snapshot = await snapshotResponse.text()

    const undoResponse = await app.request('/game/undo', { method: 'POST' })
    expect(undoResponse.status).toBe(200)
    expect(store.game?.history.length).toBe(historyBeforeAction)

    const snapshotConflictResponse = await app.request('/game/snapshot', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: snapshot,
    })
    expect(snapshotConflictResponse.status).toBe(409)

    const restoreResponse = await app.request('/game/snapshot?replace=1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: snapshot,
    })
    expect(restoreResponse.status).toBe(200)
    expect(store.game?.history.length).toBe((historyBeforeAction ?? 0) + 1)
  })

  describe('online mode seat checks', () => {
    const HOST_PLAYER_ID = 'host-secret'
    const GUEST_PLAYER_ID = 'guest-secret'
    const KEEP_CORNER_ACTION = { type: 'resolveEvent', clearing: 0 }
    const TURN_UNDO_ROUTE = '/game/undo?scope=turn'
    const MAX_SETUP_EVENTS = 20

    function asPlayer(playerId: string, method: string, body?: object): RequestInit {
      return {
        method,
        headers: { 'Content-Type': 'application/json', 'X-Player-Id': playerId },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }
    }

    async function createOnlineLobby(): Promise<void> {
      await app.request(
        '/game',
        jsonRequest('POST', { factions: ['marquise', 'eyrie'], mode: 'online' }),
      )
      await app.request('/game/join', jsonRequest('POST', { playerId: HOST_PLAYER_ID }))
      await app.request('/game/join', jsonRequest('POST', { playerId: GUEST_PLAYER_ID }))
    }

    it('only the host may start', async () => {
      await createOnlineLobby()
      const guestStart = await app.request('/game/start', asPlayer(GUEST_PLAYER_ID, 'POST'))
      expect(guestStart.status).toBe(403)
      expect(await guestStart.json()).toMatchObject({ code: 'NOT_YOUR_SEAT' })

      const anonymousStart = await app.request('/game/start', { method: 'POST' })
      expect(anonymousStart.status).toBe(403)

      const hostStart = await app.request('/game/start', asPlayer(HOST_PLAYER_ID, 'POST'))
      expect(hostStart.status).toBe(200)
    })

    it('REST views show only the caller hand, actions and join id', async () => {
      await createOnlineLobby()
      await app.request('/game/start', asPlayer(HOST_PLAYER_ID, 'POST'))

      const guestView = await app.request('/game', asPlayer(GUEST_PLAYER_ID, 'GET'))
      const guestBody = JSON.stringify(await guestView.json())
      expect(guestBody).toContain(GUEST_PLAYER_ID)
      expect(guestBody).not.toContain(HOST_PLAYER_ID)

      const hostState = store.game?.state.players[0]
      expect(hostState?.hand.length).toBeGreaterThan(0)
      const firstHostCardId = hostState?.hand[0]?.id ?? ''
      expect(guestBody).not.toContain(`"${firstHostCardId}"`)

      const guestActions = await app.request(
        '/game/actions',
        asPlayer(GUEST_PLAYER_ID, 'GET'),
      )
      expect(await guestActions.json()).toEqual({ actions: [] })

      const snapshotDump = await app.request(
        '/game/snapshot',
        asPlayer(GUEST_PLAYER_ID, 'GET'),
      )
      expect(snapshotDump.status).toBe(403)
    })

    it('only the host may remove or replace a live online game; undo is off', async () => {
      await createOnlineLobby()
      await app.request('/game/start', asPlayer(HOST_PLAYER_ID, 'POST'))

      const guestDelete = await app.request('/game', asPlayer(GUEST_PLAYER_ID, 'DELETE'))
      expect(guestDelete.status).toBe(403)
      expect(await guestDelete.json()).toMatchObject({ code: 'NOT_HOST' })

      const strangerReplace = await app.request(
        '/game?replace=1',
        jsonRequest('POST', { factions: ['marquise', 'eyrie'] }),
      )
      expect(strangerReplace.status).toBe(403)
      expect(store.mode).toBe('online')

      const hostUndo = await app.request('/game/undo', asPlayer(HOST_PLAYER_ID, 'POST'))
      expect(hostUndo.status).toBe(403)
      expect(await hostUndo.json()).toMatchObject({ code: 'ONLINE_MODE' })

      const hostDelete = await app.request('/game', asPlayer(HOST_PLAYER_ID, 'DELETE'))
      expect(hostDelete.status).toBe(204)
      expect(store.game).toBeNull()
    })

    it('open lobby: players pick their faction; a taken one is refused', async () => {
      await app.request(
        '/game',
        jsonRequest('POST', { factions: [], mode: 'online' }),
      )
      expect(store.game?.state.openLobby).toBe(true)

      const hostJoin = await app.request(
        '/game/join',
        jsonRequest('POST', { playerId: HOST_PLAYER_ID, faction: 'lizard' }),
      )
      expect(hostJoin.status).toBe(200)

      const takenJoin = await app.request(
        '/game/join',
        jsonRequest('POST', { playerId: GUEST_PLAYER_ID, faction: 'lizard' }),
      )
      expect(takenJoin.status).toBe(400)
      expect(await takenJoin.json()).toMatchObject({ code: 'FACTION_TAKEN' })

      const noFactionJoin = await app.request(
        '/game/join',
        jsonRequest('POST', { playerId: GUEST_PLAYER_ID }),
      )
      expect(noFactionJoin.status).toBe(400)

      const guestJoin = await app.request(
        '/game/join',
        jsonRequest('POST', { playerId: GUEST_PLAYER_ID, faction: 'riverfolk' }),
      )
      expect(guestJoin.status).toBe(200)
      expect(store.game?.state.factions).toEqual(['lizard', 'riverfolk'])

      const hostStart = await app.request('/game/start', asPlayer(HOST_PLAYER_ID, 'POST'))
      expect(hostStart.status).toBe(200)
    })

    /** Resolve setup straight on the store: the online game reaches turn 1. */
    function finishSetupOnStore(): void {
      const game = store.game
      if (game === null) throw new Error('no game in the store')
      let guard = 0
      while (game.state.pending.length > 0 && guard++ < MAX_SETUP_EVENTS) {
        const spec = game.legalActions()[0]
        const clearing = spec?.params?.clearing?.[0]
        const leader = spec?.params?.leaders?.[0]
        if (clearing !== undefined) {
          game.apply({ type: 'resolveEvent', clearing })
        } else if (leader !== undefined) {
          game.apply({ type: 'resolveEvent', leader })
        } else {
          throw new Error(`setup event not handled: ${JSON.stringify(spec)}`)
        }
      }
    }

    it('undo of the turn: only the player whose turn it is, only their own actions', async () => {
      await createOnlineLobby()
      await app.request('/game/start', asPlayer(HOST_PLAYER_ID, 'POST'))
      finishSetupOnStore()

      const nothingYet = await app.request(TURN_UNDO_ROUTE, asPlayer(HOST_PLAYER_ID, 'POST'))
      expect(nothingYet.status).toBe(400)
      expect(await nothingYet.json()).toMatchObject({ code: 'NOTHING_TO_UNDO' })

      // Two phase ends bring the Marquise to her Daylight actions; recruiting
      // is her first real decision of the turn.
      for (const action of [{ type: 'endPhase' }, { type: 'endPhase' }, { type: 'recruit' }]) {
        const hostAction = await app.request(
          '/game/actions',
          asPlayer(HOST_PLAYER_ID, 'POST', action),
        )
        expect(hostAction.status).toBe(200)
      }
      const historyBeforeRecruit = (store.game?.history.length ?? 0) - 1

      const guestUndo = await app.request(TURN_UNDO_ROUTE, asPlayer(GUEST_PLAYER_ID, 'POST'))
      expect(guestUndo.status).toBe(403)
      expect(await guestUndo.json()).toMatchObject({ code: 'NOT_YOUR_TURN' })

      const anonymousUndo = await app.request(TURN_UNDO_ROUTE, { method: 'POST' })
      expect(anonymousUndo.status).toBe(403)

      const hostUndo = await app.request(TURN_UNDO_ROUTE, asPlayer(HOST_PLAYER_ID, 'POST'))
      expect(hostUndo.status).toBe(200)
      expect(store.game?.history.length).toBe(historyBeforeRecruit)
    })

    it('rejects an action from a seat that is not the actor', async () => {
      await createOnlineLobby()
      await app.request('/game/start', asPlayer(HOST_PLAYER_ID, 'POST'))

      // Setup: Marquise (host, seat 0) must choose the keep corner.
      const guestAction = await app.request(
        '/game/actions',
        asPlayer(GUEST_PLAYER_ID, 'POST', KEEP_CORNER_ACTION),
      )
      expect(guestAction.status).toBe(403)

      const anonymousAction = await app.request(
        '/game/actions',
        jsonRequest('POST', KEEP_CORNER_ACTION),
      )
      expect(anonymousAction.status).toBe(403)

      const hostAction = await app.request(
        '/game/actions',
        asPlayer(HOST_PLAYER_ID, 'POST', KEEP_CORNER_ACTION),
      )
      expect(hostAction.status).toBe(200)
    })
  })

  describe('player view in a hotseat game', () => {
    const FIRST_PLAYER_ID = 'first-player'
    const SECOND_PLAYER_ID = 'second-player'
    const KEEP_CORNER_ACTION = { type: 'resolveEvent', clearing: 0 }

    function asPlayer(playerId: string, method: string, body?: object): RequestInit {
      return {
        method,
        headers: { 'Content-Type': 'application/json', 'X-Player-Id': playerId },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }
    }

    async function startHotseatGame(): Promise<void> {
      await app.request(
        '/game',
        jsonRequest('POST', { factions: ['marquise', 'eyrie'] }),
      )
      await app.request('/game/join', jsonRequest('POST', { playerId: FIRST_PLAYER_ID }))
      await app.request('/game/join', jsonRequest('POST', { playerId: SECOND_PLAYER_ID }))
      await app.request('/game/start', { method: 'POST' })
    }

    it('hides the other hand, join id and actions', async () => {
      await startHotseatGame()
      const firstCardId = store.game?.state.players[0]?.hand[0]?.id ?? ''
      expect(firstCardId).not.toBe('')

      const fullView = await app.request('/game', asPlayer(SECOND_PLAYER_ID, 'GET'))
      expect(JSON.stringify(await fullView.json())).toContain(`"${firstCardId}"`)

      const playerView = await app.request(
        '/game?view=player',
        asPlayer(SECOND_PLAYER_ID, 'GET'),
      )
      const playerViewBody = JSON.stringify(await playerView.json())
      expect(playerViewBody).toContain(SECOND_PLAYER_ID)
      expect(playerViewBody).not.toContain(FIRST_PLAYER_ID)
      expect(playerViewBody).not.toContain(`"${firstCardId}"`)

      const playerActions = await app.request(
        '/game/actions?view=player',
        asPlayer(SECOND_PLAYER_ID, 'GET'),
      )
      expect(await playerActions.json()).toEqual({ actions: [] })

      const playerLog = await app.request(
        '/game/log?view=player',
        asPlayer(SECOND_PLAYER_ID, 'GET'),
      )
      expect(JSON.stringify(await playerLog.json())).not.toContain(FIRST_PLAYER_ID)
    })

    it('formats the game and the log as that seat sees them', async () => {
      await startHotseatGame()

      const playerView = await app.request(
        '/game/view?view=player',
        asPlayer(SECOND_PLAYER_ID, 'GET'),
      )
      const playerLog = await app.request(
        '/game/log/view?view=player',
        asPlayer(SECOND_PLAYER_ID, 'GET'),
      )
      const fullView = await app.request('/game/view')

      const playerViewText = await playerView.text()
      expect(playerViewText).toContain(SECOND_PLAYER_ID)
      expect(playerViewText).not.toContain(FIRST_PLAYER_ID)
      expect(playerViewText).toContain('HIDDEN#hand-0-0')
      const playerLogText = await playerLog.text()
      expect(playerLogText).toContain('JOIN (marquise)')
      expect(playerLogText).not.toContain(FIRST_PLAYER_ID)
      expect(await fullView.text()).toContain(FIRST_PLAYER_ID)
    })

    it('lets only the seat that may act send the action', async () => {
      await startHotseatGame()

      const wrongSeat = await app.request(
        '/game/actions?view=player',
        asPlayer(SECOND_PLAYER_ID, 'POST', KEEP_CORNER_ACTION),
      )
      expect(wrongSeat.status).toBe(403)
      expect(await wrongSeat.json()).toMatchObject({ code: 'NOT_YOUR_SEAT' })

      const rightSeat = await app.request(
        '/game/actions?view=player',
        asPlayer(FIRST_PLAYER_ID, 'POST', KEEP_CORNER_ACTION),
      )
      expect(rightSeat.status).toBe(200)
      expect(JSON.stringify(await rightSeat.json())).not.toContain(SECOND_PLAYER_ID)
    })
  })

  it('seats a bot by itself and plays its turn without a request', async () => {
    await app.request(
      '/game',
      jsonRequest('POST', { factions: ['mechanicalMarquise', 'eyrie'] }),
    )
    await app.request('/game/join', jsonRequest('POST', { playerId: 'human' }))
    expect(store.game?.state.players.map((seated) => seated.playerId)).toEqual([
      'bot-mechanicalMarquise',
      'human',
    ])

    await app.request('/game/start', { method: 'POST' })
    const leaderResponse = await app.request(
      '/game/actions',
      jsonRequest('POST', { type: 'resolveEvent', leader: 'builder' }),
    )

    expect(leaderResponse.status).toBe(200)
    expect(store.game?.state.currentSeat).toBe(1)
    expect(
      store.game?.log.some(
        (entry) => entry.t === 'action' && entry.action.type === 'revealOrder',
      ),
    ).toBe(true)
  })

  it('defaults to hotseat mode and reports it on GET', async () => {
    const createResponse = await app.request(
      '/game',
      jsonRequest('POST', { factions: ['marquise', 'eyrie'] }),
    )
    expect(await createResponse.json()).toMatchObject({ mode: 'hotseat' })
    const getResponse = await app.request('/game')
    expect(await getResponse.json()).toMatchObject({ mode: 'hotseat' })
  })

  it('creates an online lobby; a loaded snapshot falls back to hotseat', async () => {
    const createResponse = await app.request(
      '/game',
      jsonRequest('POST', { factions: ['marquise', 'eyrie'], mode: 'online' }),
    )
    expect(await createResponse.json()).toMatchObject({ mode: 'online' })
    expect(store.mode).toBe('online')

    // GET /game/snapshot is blocked in online mode; dump straight from the store.
    const snapshot = JSON.stringify(store.game?.toJSON())
    const restoreResponse = await app.request('/game/snapshot?replace=1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: snapshot,
    })
    expect(restoreResponse.status).toBe(200)
    expect(store.mode).toBe('hotseat')
  })
})
