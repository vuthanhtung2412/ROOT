import { describe, expect, it, vi } from 'vitest'
import { GameHub, type GameHubClient, type GamePushPayload } from '#ws/GameHub.js'

function makeClient(
  playerId: string,
  options: { open?: boolean; send?: (data: string) => void } = {},
): GameHubClient {
  const open = options.open ?? true
  return {
    playerId,
    send: options.send ?? vi.fn(),
    isOpen: () => open,
  }
}

const samplePayload: GamePushPayload = {
  state: { id: 'g1' },
  historyLength: 0,
  legalActions: [],
  log: [],
  aiPlayers: [],
}

describe('GameHub', () => {
  it('broadcastGame reaches every open client', () => {
    const hub = new GameHub()
    const firstSend = vi.fn()
    const secondSend = vi.fn()
    hub.addClient(makeClient('marquise', { send: firstSend }))
    hub.addClient(makeClient('eyrie', { send: secondSend }))

    hub.broadcastGame(samplePayload)

    const expected = JSON.stringify(samplePayload)
    expect(firstSend).toHaveBeenCalledWith(expected)
    expect(secondSend).toHaveBeenCalledWith(expected)
  })

  it('broadcastGame drops dead sockets and skips send', () => {
    const hub = new GameHub()
    const deadSend = vi.fn()
    const liveSend = vi.fn()
    hub.addClient(makeClient('marquise', { open: false, send: deadSend }))
    hub.addClient(makeClient('eyrie', { send: liveSend }))

    hub.broadcastGame(samplePayload)

    expect(deadSend).not.toHaveBeenCalled()
    expect(liveSend).toHaveBeenCalledTimes(1)
    expect(hub.clientCount()).toBe(1)
  })

  it('broadcastGame ignores sockets that throw on send', () => {
    const hub = new GameHub()
    const throwing = makeClient('marquise', {
      send: () => {
        throw new Error('closed')
      },
    })
    const liveSend = vi.fn()
    hub.addClient(throwing)
    hub.addClient(makeClient('eyrie', { send: liveSend }))

    hub.broadcastGame(samplePayload)

    expect(liveSend).toHaveBeenCalledTimes(1)
    expect(hub.clientCount()).toBe(1)
  })

  it('broadcastToViewers builds a payload per playerId', () => {
    const hub = new GameHub()
    const firstSend = vi.fn()
    const secondSend = vi.fn()
    hub.addClient(makeClient('marquise', { send: firstSend }))
    hub.addClient(makeClient('eyrie', { send: secondSend }))

    hub.broadcastToViewers((playerId) => ({
      ...samplePayload,
      state: { viewer: playerId },
    }))

    expect(firstSend).toHaveBeenCalledWith(
      JSON.stringify({ ...samplePayload, state: { viewer: 'marquise' } }),
    )
    expect(secondSend).toHaveBeenCalledWith(
      JSON.stringify({ ...samplePayload, state: { viewer: 'eyrie' } }),
    )
  })

  it('removeClient stops further broadcasts', () => {
    const hub = new GameHub()
    const send = vi.fn()
    const client = makeClient('marquise', { send })
    hub.addClient(client)
    hub.removeClient(client)

    hub.broadcastGame(samplePayload)

    expect(send).not.toHaveBeenCalled()
    expect(hub.clientCount()).toBe(0)
  })
})
