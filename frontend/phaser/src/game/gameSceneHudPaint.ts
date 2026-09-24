import type Phaser from 'phaser'
import type { ActionSpec, GameState } from '#api/client.ts'
import type { CardTextureWarmup } from '#assets/cardTextureWarmup.ts'
import type { AutoPromptController } from '#game/resolution/autoPromptController.ts'
import type { GameSceneModals } from '#game/gameSceneModals.ts'
import type { GameSession, GameSessionSnapshot } from '#game/GameSession.ts'
import { collapsePieceIdsRemovalSpecs } from '#game/battleRemovalStepper.ts'
import type { ActionTray, ActionTraySyncOptions } from '#ui/ActionTray.ts'
import type { CardHand } from '#ui/CardHand.ts'
import type { GameDrawer } from '#ui/GameDrawer.ts'
import type { PlayerRail } from '#ui/PlayerRail.ts'
import {
  buildTurnBannerViewModel,
  type TurnBanner,
} from '#ui/TurnBanner.ts'
import type { WinnerOverlay } from '#ui/WinnerOverlay.ts'

export type GameSceneHudPaintDeps = {
  getSession: () => GameSession | null
  getTurnBanner: () => TurnBanner | null
  getPlayerRail: () => PlayerRail | null
  getCardHand: () => CardHand | null
  getActionTray: () => ActionTray | null
  getGameDrawer: () => GameDrawer | null
  getWinnerOverlay: () => WinnerOverlay | null
  getCardTextureWarmup: () => CardTextureWarmup | null
  getModals: () => GameSceneModals | null
  getAutoPrompts: () => AutoPromptController | null
  getStatusText: () => Phaser.GameObjects.Text | null
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
  deps.getTurnBanner()?.syncTurn(banner)
  deps.getPlayerRail()?.sync(snapshot.state, banner.actorSeat)
  warmCardTexturesForHand(
    snapshot.state,
    snapshot.legalActions,
    deps.getSession()?.getLocalSeat() ?? null,
    deps.getCardTextureWarmup(),
  )
  deps.getCardHand()?.sync(
    snapshot.state,
    snapshot.legalActions,
    deps.getSession()?.getLocalSeat() ?? null,
  )
  deps.getActionTray()?.sync({
    actions: localControlsActor
      ? collapsePieceIdsRemovalSpecs(snapshot.legalActions)
      : [],
    actorSeat: banner.actorSeat,
    pending: snapshot.state.pending[0],
    options: deps.actionTraySyncOptions(),
    state: snapshot.state,
  })
  deps.getModals()?.refreshFactionBoard(snapshot.state)
  deps.getGameDrawer()?.sync(snapshot.state.deck?.discard.length ?? 0)
  deps.syncBattleOverlay()
  deps.syncBattleClearingHighlight(snapshot.state)
  syncWinner(snapshot.state, deps.getWinnerOverlay())
  deps.getAutoPrompts()?.runAfterHudPaint(
    snapshot,
    banner.actorSeat,
    localControlsActor,
  )
  paintStatus(
    deps.getStatusText(),
    localControlsActor
      ? snapshot.error
      : (snapshot.error ?? 'Waiting for other player…'),
  )
}

function warmCardTexturesForHand(
  state: GameState,
  legalActions: readonly ActionSpec[],
  localSeat: number | null,
  warmup: CardTextureWarmup | null,
): void {
  const seat =
    localSeat ?? buildTurnBannerViewModel(state, legalActions).actorSeat
  const player = state.players.find((entry) => entry.seat === seat)
  const defIds = (player?.hand ?? []).map((card) => card.defId)
  warmup?.ensure(defIds)
}

function syncWinner(
  state: GameState,
  winnerOverlay: WinnerOverlay | null,
): void {
  if (state.status !== 'finished' || state.winner === undefined) {
    winnerOverlay?.sync(null)
    return
  }
  const winnerSeat = state.winner
  const winnerPlayer = state.players.find(
    (player) => player.seat === winnerSeat,
  )
  winnerOverlay?.sync(
    winnerPlayer?.faction ?? `seat ${String(winnerSeat)}`,
  )
}

function paintStatus(
  statusText: Phaser.GameObjects.Text | null,
  extra: string | null | undefined,
): void {
  if (statusText === null) {
    return
  }
  const message = extra ?? ''
  statusText.setText(message)
  statusText.setVisible(message.length > 0)
}
