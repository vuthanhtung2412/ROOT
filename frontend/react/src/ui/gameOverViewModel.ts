import { isBotFaction } from '@root/lib/bot-factions'
import type { GameState } from '#api/client.ts'
import { factionDisplayName, isMenuFactionId } from '#game/menuPartySetup.ts'

const FINISHED_STATUS = 'finished'
/** Rule: Rootbotics 3.5.1 — the humans' team and the bots' team. */
const WOODLAND_WINS_TITLE = 'The Woodland holds'
const CLOCKWORK_WINS_TITLE = 'The Clockwork wins'
const SCORE_SEPARATOR = ' · '
const TEAM_SEPARATOR = ' — '

type GamePlayer = GameState['players'][number]

/** The end screen: who won, and in a co-op game both teams' scores. */
export type GameOverView = {
  title: string
  /** Co-op: winners' scores, then the losers'. Null in free-for-all. */
  scoreLine: string | null
}

function factionName(faction: string): string {
  return isMenuFactionId(faction) ? factionDisplayName(faction) : faction
}

function scoresOf(players: readonly GamePlayer[]): string {
  return players
    .map((player: GamePlayer): string => `${factionName(player.faction)} ${String(player.vp)}`)
    .join(SCORE_SEPARATOR)
}

/** Null while the game goes on. */
export function buildGameOverView(state: GameState): GameOverView | null {
  if (state.status !== FINISHED_STATUS || state.winner === undefined) return null
  if (state.winningTeam !== undefined) {
    const humansWon: boolean = state.winningTeam === 'humans'
    const humans: GamePlayer[] = state.players.filter(
      (player: GamePlayer): boolean => !isBotFaction(player.faction),
    )
    const bots: GamePlayer[] = state.players.filter((player: GamePlayer): boolean =>
      isBotFaction(player.faction),
    )
    const [winners, losers] = humansWon ? [humans, bots] : [bots, humans]
    return {
      title: humansWon ? WOODLAND_WINS_TITLE : CLOCKWORK_WINS_TITLE,
      scoreLine: `${scoresOf(winners)}${TEAM_SEPARATOR}${scoresOf(losers)}`,
    }
  }
  const winnerSeat: number = state.winner
  const winner: GamePlayer | undefined = state.players.find(
    (player: GamePlayer): boolean => player.seat === winnerSeat,
  )
  const name: string = winner === undefined ? `seat ${String(winnerSeat)}` : factionName(winner.faction)
  return { title: `${name} wins`, scoreLine: null }
}
