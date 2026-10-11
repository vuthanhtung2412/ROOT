import type { GameState } from '#api/client.ts'
import type { AutoPromptController } from '#game/resolution/autoPromptController.ts'
import type { GameSceneModals } from '#game/gameSceneModals.ts'
import type { GameSession, GameSessionSnapshot } from '#game/GameSession.ts'
import { collapsePieceIdsRemovalSpecs } from '#game/battleRemovalStepper.ts'
import { syncGameLog } from '#react/GameLog.tsx'
import { syncGameDrawer, syncWinnerOverlay } from '#react/HudChrome.tsx'
import { syncActionTray } from '#react/ActionTray.tsx'
import { syncCardHand } from '#react/CardHand.tsx'
import { syncPlayerRail } from '#react/PlayerRail.tsx'
import { syncStatusMessage } from '#react/StatusMessage.tsx'
import { syncTurnBannerTurn } from '#react/TurnBanner.tsx'
import type { ActionTraySyncOptions } from '#ui/ActionTray.ts'
import { buildTurnBannerViewModel } from '#ui/TurnBanner.ts'

export type GameSceneHudPaintDeps = {
  getSession: () => GameSession | null
  getModals: () => GameSceneModals | null
  getAutoPrompts: () => AutoPromptController | null
  localPlayerControlsSeat: (actorSeat: number) => boolean
  actionTraySyncOptions: () => ActionTraySyncOptions | undefined
  syncBattleOverlay: () => void
  syncBattleClearingHighlight: (state: GameState) => void
  goToMenu: () => void
}

/** Snapshot → turn banner / tray / hand / winner / auto-prompts. */
export function paintGameSceneHud(
  snapshot: GameSessionSnapshot,
  deps: GameSceneHudPaintDeps,
): void {
  if (snapshot.state === null) {
    if (deps.getSession() !== null) {
      deps.goToMenu()
    }
    return
  }
  const banner = buildTurnBannerViewModel(
    snapshot.state,
    snapshot.legalActions,
  )
  const localControlsActor = deps.localPlayerControlsSeat(banner.actorSeat)
  syncTurnBannerTurn(banner)
  syncPlayerRail(snapshot.state, banner.actorSeat)
  syncCardHand({
    state: snapshot.state,
    legalActions: snapshot.legalActions,
    localSeat: deps.getSession()?.getLocalSeat() ?? null,
  })
  syncActionTray({
    actions: localControlsActor
      ? collapsePieceIdsRemovalSpecs(snapshot.legalActions)
      : [],
    actorSeat: banner.actorSeat,
    pending: snapshot.state.pending[0],
    options: deps.actionTraySyncOptions(),
    state: snapshot.state,
  })
  deps.getModals()?.refreshFactionBoard(snapshot.state)
  deps.getModals()?.refreshCraftedCards(snapshot.state)
  deps.getModals()?.refreshCompletedQuests(snapshot.state)
  syncGameDrawer({
    // Rule of the table, not of Root: only the host ends an online game.
    canEndGame: deps.getSession()?.isOnlineGuest() !== true,
    discardCount: snapshot.state.deck?.discard.length ?? 0,
    canUndo: canUndoTurnAction(
      snapshot.state,
      deps.localPlayerControlsSeat(snapshot.state.currentSeat),
    ),
  })
  syncGameLog(snapshot.log)
  deps.syncBattleOverlay()
  deps.syncBattleClearingHighlight(snapshot.state)
  syncWinner(snapshot.state)
  deps.getAutoPrompts()?.runAfterHudPaint(
    snapshot,
    banner.actorSeat,
    localControlsActor,
  )
  syncStatusMessage(
    localControlsActor
      ? snapshot.error
      : (snapshot.error ?? 'Waiting for other player…'),
  )
}

const PLAYING_STATUS = 'playing'

/**
 * Undo is for the player whose turn it is, and only for actions of that turn
 * the server still counts as undoable (none after a battle or a new turn).
 */
export function canUndoTurnAction(
  state: GameState,
  localControlsCurrentSeat: boolean,
): boolean {
  return (
    localControlsCurrentSeat &&
    state.status === PLAYING_STATUS &&
    (state.undoableActions ?? 0) > 0
  )
}

function syncWinner(state: GameState): void {
  if (state.status !== 'finished' || state.winner === undefined) {
    syncWinnerOverlay(null)
    return
  }
  const winnerSeat = state.winner
  const winnerPlayer = state.players.find(
    (player) => player.seat === winnerSeat,
  )
  syncWinnerOverlay(winnerPlayer?.faction ?? `seat ${String(winnerSeat)}`)
}
