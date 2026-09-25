import Phaser from 'phaser'
import { ensureAutumnMapLoaded } from '#assets/autumnMapLoader.ts'
import type { ActionSpec, GameState } from '#api/client.ts'
import { ActionComposer, type ComposerOutcome } from '#game/resolution/ActionComposer.ts'
import { AutoPromptController } from '#game/resolution/autoPromptController.ts'
import { BattleOverlayController } from '#game/battleOverlayController.ts'
import { applyComposerOutcomeToHud } from '#game/resolution/composerOutcomeApplier.ts'
import { shouldDisableActionTray } from '#game/actionTrayDisable.ts'
import { isActionUnderResolution } from '#game/resolution/actionUnderResolution.ts'
import { paintGameSceneHud } from '#game/gameSceneHudPaint.ts'
import { createEventComposerHooks } from '#game/resolution/eventActionComposer.ts'
import { hideCardPile, hideCraftedCards } from '#game/cardGalleryBridge.ts'
import { hideFactionBoard } from '#game/factionBoardBridge.ts'
import { GameSceneModals } from '#game/gameSceneModals.ts'
import { resetHud, setHudCallbacks } from '#game/hudStore.ts'
import { hideCardDetail, showCardDetail } from '#react/CardDetailOverlay.tsx'
import {
  syncLeaderPickOverlay,
} from '#react/HudChrome.tsx'
import {
  setCardHandEnabledCards,
  setCardHandSelection,
} from '#react/CardHand.tsx'
import { mergeComposerHooks } from '#game/resolution/mergeComposerHooks.ts'
import {
  buildBattleRemovalStepperChoices,
  buildPiecesByIdFromClearings,
  collapsePieceIdsRemovalSpecs,
  collectPieceIdsCombosFromSpecs,
  isPieceIdsRemovalSpec,
} from '#game/battleRemovalStepper.ts'
import { createEyrieComposerHooks } from '#game/resolution/eyrieActionComposer.ts'
import {
  createMarquiseBoardComposerHooks,
  createMarquiseCardComposerHooks,
} from '#game/resolution/marquiseActionComposer.ts'
import { createMarchWorkflowHooks } from '#game/resolution/marchWorkflowHooks.ts'
import { readBattleClearingId } from '#game/battleOverlayModel.ts'
import {
  applyMarchPreview,
  buildCurrentSeatWarriorCounts,
  loadGameSceneBoardLayout,
} from '#game/gameSceneBoardState.ts'
import type { GameSession, GameSessionSnapshot } from '#game/GameSession.ts'
import { applyHiDpiCamera, gameViewSize } from '#game/hiDpi.ts'
import type { ActionTraySyncOptions } from '#ui/ActionTray.ts'
import { syncActionTray } from '#react/ActionTray.tsx'
import { syncBattleOverlayView } from '#react/BattleOverlay.tsx'
import type { BattleOverlaySyncTarget } from '#game/battleOverlayController.ts'
import { BoardView } from '#ui/BoardView.ts'
import { buildTurnBannerViewModel } from '#ui/TurnBanner.ts'
import { syncTurnBannerComposer } from '#react/TurnBanner.tsx'
import { GAME_ASSET_KEYS } from '#assets/gameAssets.ts'
import { drawCoverWallpaper } from '#ui/sceneBackdrop.ts'

export type GameSceneData = {
  session: GameSession
}

export class GameScene extends Phaser.Scene {
  private session: GameSession | null = null
  private boardView: BoardView | null = null
  private readonly battleOverlayTarget: BattleOverlaySyncTarget = {
    sync: (viewModel) => {
      syncBattleOverlayView(viewModel)
    },
  }
  private readonly composer = new ActionComposer()
  private marquiseMarch = createMarchWorkflowHooks()
  private marquiseBoard = createMarquiseBoardComposerHooks()
  private marquiseCards = createMarquiseCardComposerHooks()
  private eyrieComposer = createEyrieComposerHooks()
  private eventComposer = createEventComposerHooks()
  private unsubscribe: (() => void) | null = null
  private statusText: Phaser.GameObjects.Text | null = null
  private latestSnapshot: GameSessionSnapshot | null = null
  private autoPrompts: AutoPromptController | null = null
  private battleOverlayController: BattleOverlayController | null = null
  private modals: GameSceneModals | null = null
  private endingGame = false

  constructor() {
    super({ key: 'GameScene' })
  }

  init(data: GameSceneData): void {
    this.session = data.session
    this.endingGame = false
  }

  create(): void {
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this)
    applyHiDpiCamera(this)
    const { width, height } = gameViewSize()
    drawCoverWallpaper(this, width, height, GAME_ASSET_KEYS.gameWallpaper)

    this.marquiseCards = createMarquiseCardComposerHooks()
    this.marquiseMarch = createMarchWorkflowHooks({
      warriorCountsForCurrentSeat: () => this.readCurrentSeatWarriorCounts(),
      boardForMarch: () => this.readMarchBoardSnapshot(),
    })
    this.marquiseMarch.setOnOutcome((outcome) => {
      this.applyComposerOutcome(outcome)
    })
    this.marquiseBoard = createMarquiseBoardComposerHooks()
    this.eyrieComposer = createEyrieComposerHooks()
    this.eventComposer = createEventComposerHooks()
    this.autoPrompts = new AutoPromptController({
      applyComposerOutcome: (outcome) => this.applyComposerOutcome(outcome),
      composer: this.composer,
      eventComposer: this.eventComposer,
      submitEndPhase: () => {
        void this.session?.submitAction({ type: 'endPhase' })
      },
      isBattleResultFlashActive: () =>
        this.battleOverlayController?.isResultFlashActive() === true,
      isBoardReady: () => this.boardView !== null,
    })
    this.battleOverlayController = new BattleOverlayController(
      {
        delayedCall: (delayMs, callback) =>
          this.time.delayedCall(delayMs, callback),
      },
      () => this.battleOverlayTarget,
      () => this.latestSnapshot?.state,
    )
    this.battleOverlayController.setOnResultFlashEnded(() => {
      const snapshot = this.latestSnapshot
      if (snapshot === null || snapshot.state === null) {
        return
      }
      const actorSeat = snapshot.state.currentSeat
      this.autoPrompts?.runAfterHudPaint(
        snapshot,
        actorSeat,
        this.localPlayerControlsSeat(actorSeat),
      )
    })
    this.modals = new GameSceneModals()
    this.composer.setHooks(
      mergeComposerHooks(
        this.marquiseCards.hooks,
        this.marquiseMarch.hooks,
        this.marquiseBoard.hooks,
        this.eyrieComposer.hooks,
        this.eventComposer.hooks,
      ),
    )

    setHudCallbacks({
      onEndGame: () => {
        void this.handleEndGame()
      },
      onOpenDiscardPile: () => {
        const state = this.latestSnapshot?.state
        if (state !== null && state !== undefined) {
          this.modals?.openDiscardPile(state)
          this.syncActionTrayFromLatestSnapshot()
        }
      },
      onReturnToMenu: () => {
        void this.handleEndGame()
      },
      onLeaderPicked: (leaderId) => {
        this.applyComposerOutcome(this.composer.chooseColumn(leaderId))
      },
      onSeatClick: (seat) => {
        const state = this.latestSnapshot?.state
        if (state !== null && state !== undefined) {
          this.modals?.openFactionBoard(state, seat)
          this.syncActionTrayFromLatestSnapshot()
        }
      },
      onCraftedCardsClick: (seat) => {
        const state = this.latestSnapshot?.state
        if (state !== null && state !== undefined) {
          this.modals?.openCraftedCards(state, seat)
          this.syncActionTrayFromLatestSnapshot()
        }
      },
      onSelectAction: (spec) => {
        this.handleSelectAction(spec)
      },
      onBannerConfirm: () => {
        this.applyComposerOutcome(this.composer.confirm())
      },
      onBannerCancel: () => {
        void this.cancelActionUnderResolution()
      },
      onBannerPickOption: (value) => {
        this.applyComposerOutcome(this.composer.chooseColumn(value))
      },
      onBattleOutsideClick: () => {
        this.battleOverlayController?.dismissResultFlash()
      },
      onCardSelected: (cardId) => {
        this.applyComposerOutcome(this.composer.chooseCard(cardId))
      },
      onCardHold: (held) => {
        showCardDetail({
          defId: held.defId,
          catalog: held.catalog,
        })
      },
    })

    this.statusText = this.add
      .text(width * 0.38, height * 0.92, '', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#f0e6d3',
        backgroundColor: '#0a0a0add',
        padding: { x: 10, y: 6 },
      })
      .setOrigin(0.5)
      .setDepth(120)

    void this.bootstrapBoard()

    if (this.session !== null) {
      this.unsubscribe = this.session.subscribe((snapshot) => {
        this.latestSnapshot = snapshot
        this.paintHud(snapshot)
        this.syncBoardPieces(snapshot)
      })
    }
  }

  shutdown(): void {
    hideFactionBoard()
    hideCraftedCards()
    hideCardPile()
    hideCardDetail()
    resetHud()
    if (this.unsubscribe !== null) {
      this.unsubscribe()
      this.unsubscribe = null
    }
    this.boardView?.destroy()
    this.boardView = null
    this.battleOverlayController?.destroy()
    this.battleOverlayController = null
    this.autoPrompts = null
    this.modals = null
    this.statusText?.destroy()
    this.statusText = null
  }

  private async handleEndGame(): Promise<void> {
    if (this.session === null || this.endingGame) {
      return
    }
    this.endingGame = true
    await this.session.restart()
    if (this.session.getSnapshot().error !== null) {
      this.endingGame = false
      return
    }
    this.scene.start('MenuScene', { session: this.session })
  }

  private handleSelectAction(spec: ActionSpec): void {
    if (isPieceIdsRemovalSpec(spec)) {
      const snapshot = this.latestSnapshot
      if (snapshot === null || snapshot.state === null) {
        return
      }
      const removalSpecs = snapshot.legalActions.filter((action) =>
        isPieceIdsRemovalSpec(action),
      )
      const combos = collectPieceIdsCombosFromSpecs(removalSpecs)
      const piecesById = buildPiecesByIdFromClearings(snapshot.state.clearings)
      const choices = buildBattleRemovalStepperChoices(combos, piecesById)
      this.applyComposerOutcome(this.eventComposer.beginBattleRemoval(choices))
      return
    }
    this.applyComposerOutcome(this.composer.begin(spec))
  }

  private applyComposerOutcome(outcome: ComposerOutcome): void {
    applyComposerOutcomeToHud(outcome, {
      getLatestSnapshot: () => this.latestSnapshot,
      syncComposerBanner: (input) => {
        syncTurnBannerComposer(input)
      },
      syncLeaderPick: (leaders) => {
        syncLeaderPickOverlay(leaders)
      },
      setHighlightedClearings: (clearingIds) => {
        this.boardView?.setHighlightedClearings(clearingIds)
      },
      syncBattleClearingHighlight: (state) => {
        this.syncBattleClearingHighlight(state)
      },
      setEnabledCards: (cardIds) => {
        setCardHandEnabledCards(cardIds)
      },
      setCardSelection: (cardIds) => {
        setCardHandSelection(cardIds)
      },
      syncBattleOverlay: (prompt) => {
        this.battleOverlayController?.sync(prompt)
      },
      syncBoardPieces: (snapshot) => {
        this.syncBoardPieces(snapshot)
      },
      resetComposer: () => {
        this.composer.reset()
      },
      submitAction: (action) => {
        void this.session?.submitAction(action)
      },
      getLeaderPickLeaders: () => {
        const leaderDraft = this.eventComposer.getDraft()
        return leaderDraft.type === 'pickLeader' ? leaderDraft.leaders : null
      },
      getOptionPresentation: () => this.eventComposer.getOptionPresentation(),
      getPromptOptions: () => [
        ...this.marquiseMarch.getPromptOptions(),
        ...this.marquiseBoard.getPromptOptions(),
        ...this.eyrieComposer.getPromptOptions(),
        ...this.eventComposer.getPromptOptions(),
      ],
      getDiscardSelection: () => {
        const discardDraft = this.marquiseCards.getDraft()
        return discardDraft.type === 'discardMany' ? discardDraft.selected : []
      },
      getOverlayKind: () => this.eventComposer.getOverlayKind(),
    })
    this.syncActionTrayFromLatestSnapshot()
  }

  private actionTraySyncOptions(
    localControlsActor: boolean,
    state: GameState,
  ): ActionTraySyncOptions | undefined {
    const disabled = shouldDisableActionTray({
      isActionUnderResolution: this.isActionUnderResolution(),
      isAnyModalOpen: this.modals?.isAnyOpen() === true,
      isLocalActor: localControlsActor,
      isGameFinished: state.status === 'finished',
    })
    if (!disabled) {
      return undefined
    }
    return { disabled: true }
  }

  private syncActionTrayFromLatestSnapshot(): void {
    const snapshot = this.latestSnapshot
    if (snapshot === null || snapshot.state === null) {
      return
    }
    const banner = buildTurnBannerViewModel(
      snapshot.state,
      snapshot.legalActions,
    )
    const localControlsActor = this.localPlayerControlsSeat(banner.actorSeat)
    syncActionTray({
      actions: localControlsActor
        ? collapsePieceIdsRemovalSpecs(snapshot.legalActions)
        : [],
      actorSeat: banner.actorSeat,
      pending: snapshot.state.pending[0],
      options: this.actionTraySyncOptions(localControlsActor, snapshot.state),
      state: snapshot.state,
    })
  }

  private isActionUnderResolution(): boolean {
    return (
      this.marquiseMarch.isActive() ||
      isActionUnderResolution([
        this.marquiseBoard.getDraft(),
        this.marquiseCards.getDraft(),
        this.eyrieComposer.getDraft(),
        this.eventComposer.getDraft(),
      ])
    )
  }

  /**
   * Abort frontend under-resolution. Silent idle cancel → refresh from server
   * (clears optimistic previews). Decline `ready` keeps submit path only.
   */
  private async cancelActionUnderResolution(): Promise<void> {
    const wasUnderResolution = this.isActionUnderResolution()
    const outcome = this.composer.cancel()
    this.applyComposerOutcome(outcome)
    if (!wasUnderResolution) {
      return
    }
    if (outcome.kind !== 'idle') {
      return
    }
    await this.session?.refresh()
  }

  private syncBattleClearingHighlight(state: GameState): void {
    if (this.isActionUnderResolution()) {
      return
    }
    const battleClearing = readBattleClearingId(state)
    this.boardView?.setHighlightedClearings(
      battleClearing !== null ? [battleClearing] : [],
    )
  }

  private readCurrentSeatWarriorCounts(): Map<number, number> {
    const state: GameState | null = this.latestSnapshot?.state ?? null
    return buildCurrentSeatWarriorCounts(state)
  }

  private readMarchBoardSnapshot(): {
    clearings: GameState['clearings']
    factions: readonly string[]
    seat: number
  } | null {
    const state = this.latestSnapshot?.state
    if (state === null || state === undefined) {
      return null
    }
    return {
      clearings: state.clearings,
      factions: state.factions,
      seat: state.currentSeat,
    }
  }

  private async bootstrapBoard(): Promise<void> {
    await ensureAutumnMapLoaded(this)
    const layout = await loadGameSceneBoardLayout()
    this.boardView = new BoardView({
      scene: this,
      layout,
      onClearingSelected: (clearingId) => {
        this.applyComposerOutcome(this.composer.chooseClearing(clearingId))
      },
    })
    if (this.latestSnapshot !== null) {
      this.syncBoardPieces(this.latestSnapshot)
      this.paintHud(this.latestSnapshot)
      // If setup prompt began before BoardView existed, re-apply highlights.
      const outcome = this.composer.getOutcome()
      if (outcome.kind === 'incomplete') {
        this.applyComposerOutcome(outcome)
      }
    }
  }

  private paintHud(snapshot: GameSessionSnapshot): void {
    paintGameSceneHud(snapshot, {
      getSession: () => this.session,
      getModals: () => this.modals,
      getAutoPrompts: () => this.autoPrompts,
      getStatusText: () => this.statusText,
      localPlayerControlsSeat: (actorSeat) =>
        this.localPlayerControlsSeat(actorSeat),
      actionTraySyncOptions: () => {
        const snapshot = this.latestSnapshot
        if (snapshot === null || snapshot.state === null) {
          return { disabled: true }
        }
        const banner = buildTurnBannerViewModel(
          snapshot.state,
          snapshot.legalActions,
        )
        return this.actionTraySyncOptions(
          this.localPlayerControlsSeat(banner.actorSeat),
          snapshot.state,
        )
      },
      syncBattleOverlay: () => {
        this.battleOverlayController?.sync()
      },
      syncBattleClearingHighlight: (state) => {
        this.syncBattleClearingHighlight(state)
      },
      goToMenu: () => {
        if (this.session !== null && !this.endingGame) {
          this.scene.start('MenuScene', { session: this.session })
        }
      },
    })
  }

  /** QA (no localPlayerId) may control any seat; remote only own seat. */
  private localPlayerControlsSeat(actorSeat: number): boolean {
    if (this.session === null) {
      return false
    }
    if (this.session.getLocalPlayerId() === null) {
      return true
    }
    return this.session.getLocalSeat() === actorSeat
  }

  private syncBoardPieces(snapshot: GameSessionSnapshot): void {
    if (this.boardView === null || snapshot.state === null) {
      return
    }
    const clearings = applyMarchPreview(
      snapshot.state.clearings,
      snapshot.state.currentSeat,
      this.marquiseMarch.getMarchPreviewMove(),
    )
    this.boardView.syncPieces(clearings, snapshot.state.factions)
  }
}
