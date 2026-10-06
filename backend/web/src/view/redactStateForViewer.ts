import type { GameState, PlayerState } from '@root/lib'

/** Placeholder shown instead of another seat's join id. */
export const HIDDEN_PLAYER_ID_PREFIX = 'hidden-seat-'

/** Face-down card: keeps pile sizes visible without naming the card. */
export const HIDDEN_CARD_DEFINITION_ID = 'HIDDEN'

const HIDDEN_SEED = 0

const PUBLIC_HAND_FACTION = 'riverfolk'

type HiddenCard = { id: string; defId: string }

/** Same number of cards, none identifiable. */
function faceDownCards(count: number, pileName: string): HiddenCard[] {
  return Array.from(
    { length: count },
    (_unused: unknown, index: number): HiddenCard => ({
      id: `${HIDDEN_CARD_DEFINITION_ID}#${pileName}-${String(index)}`,
      defId: HIDDEN_CARD_DEFINITION_ID,
    }),
  )
}

/**
 * Seat-scoped view of the game: the viewer keeps their own secrets, everything
 * face-down on a real table is hidden. Does not mutate `state`.
 *
 * Hidden: other hands, other join ids, Alliance supporters of other seats,
 * draw pile order, quest deck order, and the RNG seed.
 */
export function redactStateForViewer(
  state: GameState,
  viewerPlayerId: string,
): GameState {
  return {
    ...state,
    seed: HIDDEN_SEED,
    deck: {
      ...state.deck,
      draw: faceDownCards(state.deck.draw.length, 'draw'),
    },
    questDeck: faceDownCards(state.questDeck.length, 'quest'),
    players: state.players.map((player) =>
      redactPlayerForViewer(player, viewerPlayerId),
    ),
  }
}

function redactPlayerForViewer(
  player: PlayerState,
  viewerPlayerId: string,
): PlayerState {
  if (player.playerId === viewerPlayerId) {
    return player
  }
  return {
    ...player,
    // A join id is that seat's secret: never hand it to another viewer.
    playerId: `${HIDDEN_PLAYER_ID_PREFIX}${String(player.seat)}`,
    // Rule: 11.2.3 Public Hand — the Riverfolk hand is face up for everyone.
    hand: player.faction === PUBLIC_HAND_FACTION ? player.hand : [],
    board:
      player.board.kind === 'alliance'
        ? {
            ...player.board,
            // Rule: 8.2.1 — supporters are face down; only the count is public.
            supporters: faceDownCards(
              player.board.supporters.length,
              `supporters-${String(player.seat)}`,
            ),
          }
        : player.board,
  }
}
