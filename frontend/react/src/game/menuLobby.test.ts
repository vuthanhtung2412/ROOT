import { describe, expect, it } from 'vitest'
import type { AiPlayer, GameState } from '#api/client.ts'
import type { MenuFactionChoice, MenuLobbySeat } from '#game/hudStore.ts'
import { buildMenuLobby } from '#game/menuLobby.ts'
import { makeGameState } from '#test/factories.ts'

/** Open lobby with one player per picked faction, in seat order. */
function openLobbyState(pickedFactions: readonly string[]): GameState {
  return {
    ...makeGameState({ status: 'waiting' }),
    openLobby: true,
    factions: [...pickedFactions],
    players: pickedFactions.map((faction: string, seat: number) => ({
      playerId: `player-${String(seat)}`,
      seat,
      faction,
      vp: 0,
      hand: [],
    })),
  }
}

function choiceOf(
  choices: readonly MenuFactionChoice[],
  faction: string,
): MenuFactionChoice | undefined {
  return choices.find(
    (choice: MenuFactionChoice): boolean => choice.faction === faction,
  )
}

describe('buildMenuLobby — open lobby', () => {
  it('offers all six factions before anyone picked', () => {
    const lobby = buildMenuLobby(openLobbyState([]), null, false)

    expect(lobby.seats).toEqual([])
    expect(lobby.factionChoices).toHaveLength(6)
    expect(
      lobby.factionChoices.every(
        (choice: MenuFactionChoice): boolean => choice.takenBy === null,
      ),
    ).toBe(true)
  })

  it('marks a faction as taken by you or by another player', () => {
    const lobby = buildMenuLobby(openLobbyState(['lizard', 'riverfolk']), 1, false)

    expect(choiceOf(lobby.factionChoices, 'lizard')?.takenBy).toBe('other')
    expect(choiceOf(lobby.factionChoices, 'riverfolk')?.takenBy).toBe('you')
    expect(choiceOf(lobby.factionChoices, 'eyrie')?.takenBy).toBeNull()
    expect(lobby.seats).toEqual([
      { faction: 'lizard', occupied: true, isLocalPlayer: false, aiModel: null },
      { faction: 'riverfolk', occupied: true, isLocalPlayer: true, aiModel: null },
    ])
  })

  it('counts the seats of the table nobody took yet', () => {
    expect(buildMenuLobby(openLobbyState([]), null, false).openSeatCount).toBe(4)
    expect(
      buildMenuLobby(openLobbyState(['lizard', 'eyrie', 'marquise']), 0, true)
        .openSeatCount,
    ).toBe(1)
  })

  it('the host starts once two players have picked, not before', () => {
    expect(buildMenuLobby(openLobbyState(['lizard']), 0, true).canStart).toBe(false)
    expect(
      buildMenuLobby(openLobbyState(['lizard', 'eyrie']), 0, true).canStart,
    ).toBe(true)
  })

  it('a player who is not the host cannot start', () => {
    expect(
      buildMenuLobby(openLobbyState(['lizard', 'eyrie']), 1, false).canStart,
    ).toBe(false)
  })
})

describe('buildMenuLobby — preset lobby', () => {
  it('shows one seat per decided faction and starts when full', () => {
    const waiting: GameState = makeGameState({ status: 'waiting' })
    const oneJoined: GameState = { ...waiting, players: [waiting.players[0]!] }

    const lobby = buildMenuLobby(oneJoined, 0, true)

    expect(lobby.seats).toEqual([
      { faction: 'marquise', occupied: true, isLocalPlayer: true, aiModel: null },
      { faction: 'eyrie', occupied: false, isLocalPlayer: false, aiModel: null },
    ])
    expect(lobby.canStart).toBe(false)
    expect(lobby.factionChoices).toEqual([])
    expect(lobby.openSeatCount).toBe(0)
    expect(buildMenuLobby(waiting, 0, true).canStart).toBe(true)
  })

  it('marks the seat an AI player holds with its model', () => {
    const waiting: GameState = makeGameState({ status: 'waiting' })
    const aiPlayers: AiPlayer[] = [
      { seat: 1, model: 'anthropic:claude-opus-5-5', status: 'idle' },
    ]

    const lobby = buildMenuLobby(waiting, 0, true, aiPlayers)

    expect(lobby.seats.map((seat: MenuLobbySeat) => seat.aiModel)).toEqual([
      null,
      'anthropic:claude-opus-5-5',
    ])
  })
})
