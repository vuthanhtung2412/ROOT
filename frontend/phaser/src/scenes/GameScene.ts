import Phaser from 'phaser'
import { ensureAutumnMapLoaded } from '#assets/autumnMapLoader.ts'
import { CardTextureWarmup } from '#assets/cardTextureWarmup.ts'
import type { ActionSpec, GameState } from '#api/client.ts'
import { createPhaserApi } from '#api/client.ts'
import { resolveDefaultApiBaseUrl } from '#api/defaultApiBaseUrl.ts'
import { ActionComposer, type ComposerOutcome } from '#game/ActionComposer.ts'
import { AutoPromptController } from '#game/autoPromptController.ts'
import { BattleOverlayController } from '#game/battleOverlayController.ts'
import { applyComposerOutcomeToHud } from '#game/composerOutcomeApplier.ts'
import { paintGameSceneHud } from '#game/gameSceneHudPaint.ts'
import { createEventComposerHooks } from '#game/eventActionComposer.ts'
import { GameSceneModals } from '#game/gameSceneModals.ts'
import { mergeComposerHooks } from '#game/mergeComposerHooks.ts'
import {
  buildBattleRemovalStepperChoices,
  buildPiecesByIdFromClearings,
  collapsePieceIdsRemovalSpecs,
  collectPieceIdsCombosFromSpecs,
  isPieceIdsRemovalSpec,
} from '#game/battleRemovalStepper.ts'
import { createEyrieComposerHooks } from '#game/eyrieActionComposer.ts'
import {
  createMarquiseBoardComposerHooks,
  createMarquiseCardComposerHooks,
  createMarquiseMarchComposerHooks,
} from '#game/marquiseActionComposer.ts'
import {
  boardLayoutFromFallResponse,
  FALL_BOARD_LAYOUT,
  type BoardLayout,
} from '#game/boardLayout.ts'
import { readBattleClearingId } from '#game/battleOverlayModel.ts'
import type { GameSession, GameSessionSnapshot } from '#game/GameSession.ts'
import { applyHiDpiCamera, gameViewSize } from '#game/hiDpi.ts'
import { applyMarchMovesToClearings } from '#game/marchClearingsPreview.ts'
import { ActionTray, type ActionTraySyncOptions } from '#ui/ActionTray.ts'
import { BattleOverlay } from '#ui/BattleOverlay.ts'
import { BoardView } from '#ui/BoardView.ts'
import { CardHand } from '#ui/CardHand.ts'
import { CardDetailOverlay } from '#ui/CardDetailOverlay.ts'
import { CardPileModal } from '#ui/CardPileModal.ts'
import { CraftedCardsModal } from '#ui/CraftedCardsModal.ts'
import { FactionBoardModal } from '#ui/FactionBoardModal.ts'
import { GameDrawer } from '#ui/GameDrawer.ts'
import { LeaderPickOverlay } from '#ui/LeaderPickOverlay.ts'
import { PlayerRail } from '#ui/PlayerRail.ts'
import {
  buildTurnBannerViewModel,
  TurnBanner,
} from '#ui/TurnBanner.ts'
import { WinnerOverlay } from '#ui/WinnerOverlay.ts'
import { GAME_ASSET_KEYS } from '#assets/gameAssets.ts'
import {
  WOODLAND_BOTTOM,
  drawCoverWallpaper,
} from '#ui/sceneBackdrop.ts'

export type GameSceneData = {
  session: GameSession
}

export class GameScene extends Phaser.Scene {
  private session: GameSession | null = null
  private boardView: BoardView | null = null
  private turnBanner: TurnBanner | null = null
  private playerRail: PlayerRail | null = null
  private cardHand: CardHand | null = null
  private cardDetailOverlay: CardDetailOverlay | null = null
  private actionTray: ActionTray | null = null
  private battleOverlay: BattleOverlay | null = null
  private factionBoardModal: FactionBoardModal | null = null
  private craftedCardsModal: CraftedCardsModal | null = null
  private cardPileModal: CardPileModal | null = null
  private gameDrawer: GameDrawer | null = null
  private winnerOverlay: WinnerOverlay | null = null
  private leaderPickOverlay: LeaderPickOverlay | null = null
  private readonly composer = new ActionComposer()
  private marquiseMarch = createMarquiseMarchComposerHooks()
  private marquiseBoard = createMarquiseBoardComposerHooks()
  private marquiseCards = createMarquiseCardComposerHooks()
  private eyrieComposer = createEyrieComposerHooks()
  private eventComposer = createEventComposerHooks()
  private unsubscribe: (() => void) | null = null
  private statusText: Phaser.GameObjects.Text | null = null
  private latestSnapshot: GameSessionSnapshot | null = null
  private cardTextureWarmup: CardTextureWarmup | null = null
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
    this.cameras.main.setBackgroundColor(WOODLAND_BOTTOM)
    drawCoverWallpaper(this, width, height, GAME_ASSET_KEYS.gameWallpaper)

    this.marquiseCards = createMarquiseCardComposerHooks()
    this.marquiseMarch = createMarquiseMarchComposerHooks({
      warriorCountsForCurrentSeat: () => this.readCurrentSeatWarriorCounts(),
      boardForMarch: () => this.readMarchBoardSnapshot(),
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
    })
    this.battleOverlayController = new BattleOverlayController(
      {
        delayedCall: (delayMs, callback) =>
          this.time.delayedCall(delayMs, callback),
      },
      () => this.battleOverlay,
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
    this.modals = new GameSceneModals({
      getFactionBoardModal: () => this.factionBoardModal,
      getCraftedCardsModal: () => this.craftedCardsModal,
      getCardPileModal: () => this.cardPileModal,
      getCardTextureWarmup: () => this.cardTextureWarmup,
    })
    this.composer.setHooks(
      mergeComposerHooks(
        this.marquiseCards.hooks,
        this.marquiseMarch.hooks,
        this.marquiseBoard.hooks,
        this.eyrieComposer.hooks,
        this.eventComposer.hooks,
      ),
    )

    this.turnBanner = new TurnBanner(this, {
      onConfirm: () => {
        this.applyComposerOutcome(this.composer.confirm())
      },
      onCancel: () => {
        this.applyComposerOutcome(this.composer.cancel())
      },
      onPickOption: (value) => {
        this.applyComposerOutcome(this.composer.chooseColumn(value))
      },
    })
    this.playerRail = new PlayerRail(
      this,
      (seat) => {
        const state = this.latestSnapshot?.state
        if (state !== null && state !== undefined) {
          this.modals?.openFactionBoard(state, seat)
        }
      },
      (seat) => {
        const state = this.latestSnapshot?.state
        if (state !== null && state !== undefined) {
          this.modals?.openCraftedCards(state, seat)
        }
      },
    )
    this.cardTextureWarmup = new CardTextureWarmup(this)
    this.cardTextureWarmup.setOnReady(() => {
      this.repaintCardHandFromLatestSnapshot()
      this.modals?.refreshCraftedCards(this.latestSnapshot?.state)
    })
    this.cardHand = new CardHand(
      this,
      (cardId) => {
        this.applyComposerOutcome(this.composer.chooseCard(cardId))
      },
      (held) => {
        this.cardTextureWarmup?.ensure([held.defId])
        this.cardDetailOverlay?.show({
          defId: held.defId,
          catalog: held.catalog,
        })
      },
    )
    this.cardDetailOverlay = new CardDetailOverlay(this)
    this.actionTray = new ActionTray(this, {
      onSelectAction: (spec) => {
        this.handleSelectAction(spec)
      },
    })
    this.battleOverlay = new BattleOverlay(this)
    this.factionBoardModal = new FactionBoardModal(this)
    this.craftedCardsModal = new CraftedCardsModal(this)
    this.cardPileModal = new CardPileModal(this)
    this.gameDrawer = new GameDrawer(this, {
      onEndGame: () => {
        void this.handleEndGame()
      },
      onOpenDiscardPile: () => {
        const state = this.latestSnapshot?.state
        if (state !== null && state !== undefined) {
          this.modals?.openDiscardPile(state)
        }
      },
    })
    this.winnerOverlay = new WinnerOverlay(this, {
      onReturnToMenu: () => {
        void this.handleEndGame()
      },
    })
    this.leaderPickOverlay = new LeaderPickOverlay(this)
    this.leaderPickOverlay.setOnPicked((leaderId) => {
      this.applyComposerOutcome(this.composer.chooseColumn(leaderId))
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
    if (this.unsubscribe !== null) {
      this.unsubscribe()
      this.unsubscribe = null
    }
    this.boardView?.destroy()
    this.boardView = null
    this.turnBanner?.destroy()
    this.turnBanner = null
    this.playerRail?.destroy()
    this.playerRail = null
    this.cardHand?.destroy()
    this.cardHand = null
    this.cardTextureWarmup = null
    this.cardDetailOverlay?.destroy()
    this.cardDetailOverlay = null
    this.actionTray?.destroy()
    this.actionTray = null
    this.battleOverlay?.destroy()
    this.battleOverlay = null
    this.battleOverlayController?.destroy()
    this.battleOverlayController = null
    this.autoPrompts = null
    this.modals = null
    this.factionBoardModal?.destroy()
    this.factionBoardModal = null
    this.craftedCardsModal?.destroy()
    this.craftedCardsModal = null
    this.cardPileModal?.destroy()
    this.cardPileModal = null
    this.gameDrawer?.destroy()
    this.gameDrawer = null
    this.winnerOverlay?.destroy()
    this.winnerOverlay = null
    this.leaderPickOverlay?.destroy()
    this.leaderPickOverlay = null
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
        this.turnBanner?.syncComposer(input)
      },
      syncLeaderPick: (leaders) => {
        this.leaderPickOverlay?.sync(leaders)
      },
      setHighlightedClearings: (clearingIds) => {
        this.boardView?.setHighlightedClearings(clearingIds)
      },
      syncBattleClearingHighlight: (state) => {
        this.syncBattleClearingHighlight(state)
      },
      setEnabledCards: (cardIds) => {
        this.cardHand?.setEnabledCards(cardIds)
      },
      setCardSelection: (cardIds) => {
        this.cardHand?.setSelection(cardIds)
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

  private marchActionTrayOptions(): ActionTraySyncOptions | undefined {
    if (this.marquiseMarch.getDraft().type !== 'march') {
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
    this.actionTray?.sync(
      localControlsActor
        ? collapsePieceIdsRemovalSpecs(snapshot.legalActions)
        : [],
      banner.actorSeat,
      snapshot.state.pending[0],
      this.marchActionTrayOptions(),
      snapshot.state,
    )
  }

  private isComposerStaging(): boolean {
    return (
      this.marquiseMarch.getDraft().type !== 'idle' ||
      this.marquiseBoard.getDraft().type !== 'idle' ||
      this.marquiseCards.getDraft().type !== 'idle' ||
      this.eyrieComposer.getDraft().type !== 'idle' ||
      this.eventComposer.getDraft().type !== 'idle'
    )
  }

  private syncBattleClearingHighlight(state: GameState): void {
    if (this.isComposerStaging()) {
      return
    }
    const battleClearing = readBattleClearingId(state)
    this.boardView?.setHighlightedClearings(
      battleClearing !== null ? [battleClearing] : [],
    )
  }

  private readCurrentSeatWarriorCounts(): Map<number, number> {
    const counts = new Map<number, number>()
    const state = this.latestSnapshot?.state
    if (state === null || state === undefined) {
      return counts
    }
    const seat = state.currentSeat
    state.clearings.forEach((clearing, clearingId) => {
      let warriors = 0
      for (const piece of clearing.pieces) {
        if (piece.kind === 'warrior' && piece.owner === seat) {
          warriors += 1
        }
      }
      if (warriors > 0) {
        counts.set(clearingId, warriors)
      }
    })
    return counts
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
    const layout = await this.loadLayout()
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
    }
  }

  private paintHud(snapshot: GameSessionSnapshot): void {
    paintGameSceneHud(snapshot, {
      getSession: () => this.session,
      getTurnBanner: () => this.turnBanner,
      getPlayerRail: () => this.playerRail,
      getCardHand: () => this.cardHand,
      getActionTray: () => this.actionTray,
      getGameDrawer: () => this.gameDrawer,
      getWinnerOverlay: () => this.winnerOverlay,
      getCardTextureWarmup: () => this.cardTextureWarmup,
      getModals: () => this.modals,
      getAutoPrompts: () => this.autoPrompts,
      getStatusText: () => this.statusText,
      localPlayerControlsSeat: (actorSeat) =>
        this.localPlayerControlsSeat(actorSeat),
      marchActionTrayOptions: () => this.marchActionTrayOptions(),
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

  private repaintCardHandFromLatestSnapshot(): void {
    const snapshot = this.latestSnapshot
    if (snapshot === null || snapshot.state === null) {
      return
    }
    this.cardHand?.sync(
      snapshot.state,
      snapshot.legalActions,
      this.session?.getLocalSeat() ?? null,
    )
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
    const clearings = this.clearingsWithMarchPreview(
      snapshot.state.clearings,
      snapshot.state.currentSeat,
    )
    this.boardView.syncPieces(clearings, snapshot.state.factions)
  }

  private clearingsWithMarchPreview(
    clearings: GameState['clearings'],
    warriorOwnerSeat: number,
  ): GameState['clearings'] {
    const draft = this.marquiseMarch.getDraft()
    if (draft.type !== 'march' || draft.firstMove === null) {
      return clearings
    }
    return applyMarchMovesToClearings(clearings, warriorOwnerSeat, [
      draft.firstMove,
    ])
  }

  private async loadLayout(): Promise<BoardLayout> {
    try {
      const api = createPhaserApi({ baseUrl: resolveDefaultApiBaseUrl() })
      const response = await api.fallLayout()
      return boardLayoutFromFallResponse(response)
    } catch {
      return FALL_BOARD_LAYOUT
    }
  }
}
