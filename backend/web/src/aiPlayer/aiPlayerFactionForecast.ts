import type {
  Game,
  MarquiseForecast,
  PlayerState,
  SympathyForecast,
} from '@root/lib'

const NOTE =
  'As the map stands now. "affordable" and "buildableIn" count what you hold now, not what this turn will add.'

type OwnFaction = 'marquise' | 'alliance'

export type FactionForecast = (MarquiseForecast | SympathyForecast) & {
  note: string
}

/**
 * The economy of the seat's own faction: Marquise wood and buildings, or
 * Alliance supporters and sympathy targets. Null when the seat is not
 * `faction`: supporters are face down for everyone else.
 */
export function forecastOwnFaction(
  game: Game,
  playerId: string,
  faction: OwnFaction,
): FactionForecast | null {
  const viewer = game.state.players.find(
    (player: PlayerState): boolean => player.playerId === playerId,
  )
  if (viewer === undefined || viewer.faction !== faction) return null
  return {
    ...(faction === 'marquise'
      ? game.forecastMarquise(viewer.seat)
      : game.forecastSympathy(viewer.seat)),
    note: NOTE,
  }
}
