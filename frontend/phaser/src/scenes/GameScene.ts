import Phaser from 'phaser'
import { ensureAutumnMapLoaded } from '#assets/autumnMapLoader.ts'
import { CardTextureWarmup } from '#assets/cardTextureWarmup.ts'
import type { ActionSpec, GameState } from '#api/client.ts'
import { createPhaserApi } from '#api/client.ts'
import { resolveDefaultApiBaseUrl } from '#api/defaultApiBaseUrl.ts'
import {
  ActionComposer,
  type ActionComposerHooks,
  type ComposerOutcome,
} from '#game/ActionComposer.ts'
import { soleEndPhaseAction } from '#game/forcedAction.ts'
import { createEventComposerHooks, fieldHospitalCardIdsFromSpecs, isFieldHospitalPending, battleAmbushRole, isBattleRemovalPending } from '#game/eventActionComposer.ts'
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
import {
  buildBattleOverlayViewModel,
  buildZeroHitBattleOverlayViewModel,
  readBattleClearingId,
  updateBattleTracker,
  zeroHitFlashDurationMs,
  type BattleTrackerState,
  type ZeroHitBattleOutcome,
} from '#game/battleOverlayModel.ts'
import type { GameSession, GameSessionSnapshot } from '#game/GameSession.ts'
import { applyHiDpiCamera, gameViewSize } from '#game/hiDpi.ts'
import { applyMarchMovesToClearings } from '#game/marchClearingsPreview.ts'
import { ActionTray } from '#ui/ActionTray.ts'
import { BattleOverlay } from '#ui/BattleOverlay.ts'
import { BoardView } from '#ui/BoardView.ts'
import { CardHand } from '#ui/CardHand.ts'
import { CardDetailOverlay } from '#ui/CardDetailOverlay.ts'
import { CardPileModal } from '#ui/CardPileModal.ts'
import { CraftedCardsModal } from '#ui/CraftedCardsModal.ts'
import { EventOverlay } from '#ui/EventOverlay.ts'
import { FactionBoardModal } from '#ui/FactionBoardModal.ts'
import { buildFactionBoardViewModel } from '#ui/factionBoardViewModel.ts'
import { GameDrawer } from '#ui/GameDrawer.ts'
import { LeaderPickOverlay } from '#ui/LeaderPickOverlay.ts'
import { PlayerRail } from '#ui/PlayerRail.ts'
import {
  buildTurnBannerViewModel,
  TurnBanner,
} from '#ui/TurnBanner.ts'
import { WinnerOverlay } from '#ui/WinnerOverlay.ts'

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
  private eventOverlay: EventOverlay | null = null
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
  /** Avoid re-opening the same pending prompt every HUD paint. */
  private autoPendingPromptKey: string | null = null
  private autoSetupPromptKey: string | null = null
  private autoEndPhaseKey: string | null = null
  private cardTextureWarmup: CardTextureWarmup | null = null
  private battleTracker: BattleTrackerState | null = null
  private zeroHitFlashOutcome: ZeroHitBattleOutcome | null = null
  private zeroHitFlashTimer: Phaser.Time.TimerEvent | null = null

  constructor() {
    super({ key: 'GameScene' })
  }

  init(data: GameSceneData): void {
    this.session = data.session
  }

  create(): void {
    applyHiDpiCamera(this)
    const { width, height } = gameViewSize()

    this.marquiseCards = createMarquiseCardComposerHooks()
    this.marquiseMarch = createMarquiseMarchComposerHooks({
      warriorCountsForCurrentSeat: () => this.readCurrentSeatWarriorCounts(),
    })
    this.marquiseBoard = createMarquiseBoardComposerHooks()
    this.eyrieComposer = createEyrieComposerHooks()
    this.eventComposer = createEventComposerHooks()
    this.composer.setHooks(
      mergeHooks(
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
        this.openFactionBoardForSeat(seat)
      },
      (seat) => {
        this.openCraftedCardsForSeat(seat)
      },
    )
    this.cardTextureWarmup = new CardTextureWarmup(this)
    this.cardTextureWarmup.setOnReady(() => {
      this.repaintCardHandFromLatestSnapshot()
      this.refreshCraftedCardsModal()
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
    this.eventOverlay = new EventOverlay(this)
    this.battleOverlay = new BattleOverlay(this)
    this.factionBoardModal = new FactionBoardModal(this)
    this.craftedCardsModal = new CraftedCardsModal(this)
    this.cardPileModal = new CardPileModal(this)
    this.gameDrawer = new GameDrawer(this, {
      onEndGame: () => {
        void this.handleEndGame()
      },
      onOpenDiscardPile: () => {
        this.openDiscardPile()
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
    this.eventOverlay?.destroy()
    this.eventOverlay = null
    this.battleOverlay?.destroy()
    this.battleOverlay = null
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

  private openFactionBoardForSeat(seat: number): void {
    const state = this.latestSnapshot?.state
    if (state === null || state === undefined) {
      return
    }
    const openSeat = this.factionBoardModal?.openSeat()
    if (this.factionBoardModal?.isOpen() === true && openSeat === seat) {
      this.factionBoardModal.hide()
      return
    }
    const view = buildFactionBoardViewModel(state, seat)
    if (view === null) {
      return
    }
    this.factionBoardModal?.show(view)
  }

  private openCraftedCardsForSeat(seat: number): void {
    const state = this.latestSnapshot?.state
    if (state === null || state === undefined) {
      return
    }
    const openSeat = this.craftedCardsModal?.openSeat()
    if (this.craftedCardsModal?.isOpen() === true && openSeat === seat) {
      this.craftedCardsModal.hide()
      return
    }
    const player = state.players.find((entry) => entry.seat === seat)
    if (player === undefined) {
      return
    }
    const cards = player.playArea ?? []
    this.cardTextureWarmup?.ensure(cards.map((card) => card.defId))
    this.craftedCardsModal?.show({
      seat: player.seat,
      faction: player.faction,
      cards,
    })
  }

  private openDiscardPile(): void {
    const state = this.latestSnapshot?.state
    if (state === null || state === undefined) {
      return
    }
    if (this.cardPileModal?.isOpen() === true) {
      this.cardPileModal.hide()
      return
    }
    const cards = state.deck?.discard ?? []
    this.cardTextureWarmup?.ensure(cards.map((card) => card.defId))
    this.cardPileModal?.show({
      title: `Discard pile (${String(cards.length)})`,
      cards,
      emptyMessage: 'Discard pile empty',
    })
  }

  private refreshFactionBoardModal(state: GameState): void {
    if (this.factionBoardModal?.isOpen() !== true) {
      return
    }
    const seat = this.factionBoardModal.openSeat()
    if (seat === null) {
      return
    }
    const view = buildFactionBoardViewModel(state, seat)
    if (view === null) {
      this.factionBoardModal.hide()
      return
    }
    this.factionBoardModal.show(view)
  }

  private refreshCraftedCardsModal(): void {
    if (this.craftedCardsModal?.isOpen() !== true) {
      return
    }
    const seat = this.craftedCardsModal.openSeat()
    if (seat === null) {
      return
    }
    const state = this.latestSnapshot?.state
    if (state === null || state === undefined) {
      this.craftedCardsModal.hide()
      return
    }
    const player = state.players.find((entry) => entry.seat === seat)
    if (player === undefined) {
      this.craftedCardsModal.hide()
      return
    }
    const cards = player.playArea ?? []
    this.cardTextureWarmup?.ensure(cards.map((card) => card.defId))
    this.craftedCardsModal.show({
      seat: player.seat,
      faction: player.faction,
      cards,
    })
  }

  private async handleEndGame(): Promise<void> {
    if (this.session === null) {
      return
    }
    await this.session.restart()
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
    if (outcome.kind === 'ready') {
      this.turnBanner?.syncComposer(null)
      this.leaderPickOverlay?.sync(null)
      if (this.latestSnapshot?.state !== null && this.latestSnapshot?.state !== undefined) {
        this.syncBattleClearingHighlight(this.latestSnapshot.state)
      } else {
        this.boardView?.setHighlightedClearings([])
      }
      this.cardHand?.setEnabledCards(null)
      this.cardHand?.setSelection([])
      this.composer.reset()
      if (this.latestSnapshot !== null) {
        this.syncBoardPieces(this.latestSnapshot)
      }
      void this.session?.submitAction(outcome.action)
      return
    }

    if (outcome.kind === 'incomplete') {
      const leaderDraft = this.eventComposer.getDraft()
      const pickingLeader =
        leaderDraft.type === 'pickLeader' ? leaderDraft.leaders : null
      this.leaderPickOverlay?.sync(pickingLeader)
      const optionPresentation = this.eventComposer.getOptionPresentation()
      this.turnBanner?.syncComposer({
        message: outcome.prompt.message,
        canConfirm: outcome.prompt.canConfirm,
        canCancel: outcome.prompt.canCancel,
        options:
          pickingLeader !== null
            ? []
            : [
                ...this.marquiseMarch.getPromptOptions(),
                ...this.marquiseBoard.getPromptOptions(),
                ...this.eyrieComposer.getPromptOptions(),
                ...this.eventComposer.getPromptOptions(),
              ],
        ...(optionPresentation !== undefined
          ? { optionPresentation }
          : {}),
      })
      this.boardView?.setHighlightedClearings(
        mergeBattleClearingHighlight(
          outcome.prompt.highlightClearings,
          this.latestSnapshot?.state ?? null,
        ),
      )
      this.cardHand?.setEnabledCards(outcome.prompt.enabledCardIds)
      const discardDraft = this.marquiseCards.getDraft()
      this.cardHand?.setSelection(
        discardDraft.type === 'discardMany' ? discardDraft.selected : [],
      )
      this.eventOverlay?.sync(
        this.eventComposer.getOverlayKind() === 'fieldHospital',
        outcome.prompt.message,
      )
      this.syncBattleOverlay(outcome.prompt.message)
      if (this.latestSnapshot !== null) {
        this.syncBoardPieces(this.latestSnapshot)
      }
      return
    }

    this.turnBanner?.syncComposer(null)
    this.leaderPickOverlay?.sync(null)
    this.cardHand?.setEnabledCards(null)
    this.cardHand?.setSelection([])
    this.eventOverlay?.sync(false, '')
    this.syncBattleOverlay(null)
    if (this.latestSnapshot?.state !== null && this.latestSnapshot?.state !== undefined) {
      this.syncBattleClearingHighlight(this.latestSnapshot.state)
    } else {
      this.boardView?.setHighlightedClearings([])
    }
    if (this.latestSnapshot !== null) {
      this.syncBoardPieces(this.latestSnapshot)
    }
  }

  private syncBattleOverlay(prompt: string | null = null): void {
    const state = this.latestSnapshot?.state
    if (state === null || state === undefined) {
      this.battleOverlay?.sync(null)
      return
    }
    const trackerUpdate = updateBattleTracker(this.battleTracker, state)
    this.battleTracker = trackerUpdate.tracker
    if (trackerUpdate.zeroHitOutcome !== null) {
      this.beginZeroHitFlash(trackerUpdate.zeroHitOutcome)
    }
    if (this.zeroHitFlashOutcome !== null) {
      this.battleOverlay?.sync(
        buildZeroHitBattleOverlayViewModel(state, this.zeroHitFlashOutcome),
      )
      return
    }
    this.battleOverlay?.sync(buildBattleOverlayViewModel(state, prompt))
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

  private beginZeroHitFlash(outcome: ZeroHitBattleOutcome): void {
    this.zeroHitFlashOutcome = outcome
    this.zeroHitFlashTimer?.remove(false)
    this.zeroHitFlashTimer = this.time.delayedCall(
      zeroHitFlashDurationMs(),
      () => {
        this.zeroHitFlashOutcome = null
        this.zeroHitFlashTimer = null
        this.syncBattleOverlay()
      },
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
    if (snapshot.state === null) {
      if (this.session !== null) {
        this.scene.start('MenuScene', { session: this.session })
      }
      return
    }
    const banner = buildTurnBannerViewModel(
      snapshot.state,
      snapshot.legalActions,
    )
    const localControlsActor = this.localPlayerControlsSeat(banner.actorSeat)
    this.turnBanner?.syncTurn(banner)
    this.playerRail?.sync(snapshot.state, banner.actorSeat)
    this.warmCardTexturesForHand(
      snapshot.state,
      snapshot.legalActions,
      this.session?.getLocalSeat() ?? null,
    )
    this.cardHand?.sync(
      snapshot.state,
      snapshot.legalActions,
      this.session?.getLocalSeat() ?? null,
    )
    this.actionTray?.sync(
      localControlsActor
        ? collapsePieceIdsRemovalSpecs(snapshot.legalActions)
        : [],
      banner.actorSeat,
      snapshot.state.pending[0],
    )
    this.refreshFactionBoardModal(snapshot.state)
    this.gameDrawer?.sync(snapshot.state.deck?.discard.length ?? 0)
    this.battleOverlay?.sync(buildBattleOverlayViewModel(snapshot.state))
    this.syncBattleClearingHighlight(snapshot.state)
    this.syncWinner(snapshot.state)
    this.maybeAutoBeginSetupPrompt(
      snapshot,
      banner.actorSeat,
      localControlsActor,
    )
    this.maybeAutoBeginFieldHospitalPrompt(
      snapshot,
      banner.actorSeat,
      localControlsActor,
    )
    this.maybeAutoBeginAmbushPrompt(
      snapshot,
      banner.actorSeat,
      localControlsActor,
    )
    this.maybeAutoBeginBattleRemoval(
      snapshot,
      banner.actorSeat,
      localControlsActor,
    )
    this.maybeAutoEndPhase(snapshot, banner.actorSeat, localControlsActor)
    this.paintStatus(
      localControlsActor
        ? snapshot.error
        : (snapshot.error ?? 'Waiting for other player…'),
    )
  }

  private warmCardTexturesForHand(
    state: GameState,
    legalActions: readonly ActionSpec[],
    localSeat: number | null,
  ): void {
    const seat =
      localSeat ??
      buildTurnBannerViewModel(state, legalActions).actorSeat
    const player = state.players.find((entry) => entry.seat === seat)
    const defIds = (player?.hand ?? []).map((card) => card.defId)
    this.cardTextureWarmup?.ensure(defIds)
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

  /**
   * Field Hospitals: open pay/decline composer without tray click.
   */
  private maybeAutoBeginFieldHospitalPrompt(
    snapshot: GameSessionSnapshot,
    actorSeat: number,
    localControlsActor: boolean,
  ): void {
    if (!localControlsActor || snapshot.state === null) {
      this.autoPendingPromptKey = null
      return
    }
    const pending = snapshot.state.pending[0]
    if (!isFieldHospitalPending(pending)) {
      this.autoPendingPromptKey = null
      return
    }
    const forActor = snapshot.legalActions.filter(
      (spec) => spec.type === 'resolveEvent' && spec.actor === actorSeat,
    )
    if (forActor.length === 0) {
      this.autoPendingPromptKey = null
      return
    }
    const key = JSON.stringify({ pending, actions: forActor })
    if (key === this.autoPendingPromptKey) {
      return
    }
    this.autoPendingPromptKey = key
    const cardIds = fieldHospitalCardIdsFromSpecs(forActor)
    this.applyComposerOutcome(this.eventComposer.beginFieldHospital(cardIds))
  }

  /**
   * Ambush / foil: open play-or-skip prompt without tray click.
   */
  private maybeAutoBeginAmbushPrompt(
    snapshot: GameSessionSnapshot,
    actorSeat: number,
    localControlsActor: boolean,
  ): void {
    if (!localControlsActor || snapshot.state === null) {
      return
    }
    const pending = snapshot.state.pending[0]
    const role = battleAmbushRole(pending)
    if (role === null) {
      return
    }
    const forActor = snapshot.legalActions.filter(
      (spec) => spec.type === 'resolveEvent' && spec.actor === actorSeat,
    )
    if (forActor.length === 0) {
      return
    }
    const key = JSON.stringify({ pending, actions: forActor, kind: 'ambush' })
    if (key === this.autoPendingPromptKey) {
      return
    }
    this.autoPendingPromptKey = key
    const cardIds = fieldHospitalCardIdsFromSpecs(forActor)
    this.applyComposerOutcome(this.eventComposer.beginAmbush(cardIds, role))
  }

  /** Auto-open (or auto-submit single) battle hit removal. */
  private maybeAutoBeginBattleRemoval(
    snapshot: GameSessionSnapshot,
    actorSeat: number,
    localControlsActor: boolean,
  ): void {
    if (!localControlsActor || snapshot.state === null) {
      return
    }
    const pending = snapshot.state.pending[0]
    if (!isBattleRemovalPending(pending)) {
      return
    }
    const removalSpecs = snapshot.legalActions.filter(
      (action) =>
        isPieceIdsRemovalSpec(action) && action.actor === actorSeat,
    )
    if (removalSpecs.length === 0) {
      return
    }
    const key = JSON.stringify({
      pending,
      actions: removalSpecs,
      kind: 'removal',
    })
    if (key === this.autoPendingPromptKey) {
      return
    }
    this.autoPendingPromptKey = key
    const combos = collectPieceIdsCombosFromSpecs(removalSpecs)
    const piecesById = buildPiecesByIdFromClearings(snapshot.state.clearings)
    const choices = buildBattleRemovalStepperChoices(combos, piecesById)
    this.applyComposerOutcome(this.eventComposer.beginBattleRemoval(choices))
  }

  /** Auto-submit when endPhase is the only legal action for the actor. */
  private maybeAutoEndPhase(
    snapshot: GameSessionSnapshot,
    actorSeat: number,
    localControlsActor: boolean,
  ): void {
    if (!localControlsActor || snapshot.state === null) {
      this.autoEndPhaseKey = null
      return
    }
    if (snapshot.state.pending.length > 0) {
      this.autoEndPhaseKey = null
      return
    }
    const sole = soleEndPhaseAction(snapshot.legalActions, actorSeat)
    if (sole === null) {
      this.autoEndPhaseKey = null
      return
    }
    const key = JSON.stringify({
      turn: snapshot.state.turn,
      phase: snapshot.state.phase,
      step: snapshot.state.step,
      seat: actorSeat,
    })
    if (key === this.autoEndPhaseKey) {
      return
    }
    this.autoEndPhaseKey = key
    void this.session?.submitAction({ type: 'endPhase' })
  }

  /**
   * Setup picks (keep → buildings → leader): open composer so board highlights
   * without clicking the Actions tray each time.
   */
  private maybeAutoBeginSetupPrompt(
    snapshot: GameSessionSnapshot,
    actorSeat: number,
    localControlsActor: boolean,
  ): void {
    if (!localControlsActor || snapshot.state?.status !== 'setup') {
      this.autoSetupPromptKey = null
      return
    }
    const setupSpec = snapshot.legalActions.find(
      (spec) => spec.type === 'resolveEvent' && spec.actor === actorSeat,
    )
    if (setupSpec === undefined) {
      this.autoSetupPromptKey = null
      return
    }
    const pending = snapshot.state.pending[0]
    const key = JSON.stringify({ pending, params: setupSpec.params })
    if (key === this.autoSetupPromptKey) {
      return
    }
    this.autoSetupPromptKey = key
    this.applyComposerOutcome(this.composer.begin(setupSpec))
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

  private syncWinner(state: GameState): void {
    if (state.status !== 'finished' || state.winner === undefined) {
      this.winnerOverlay?.sync(null)
      return
    }
    const winnerSeat = state.winner
    const winnerPlayer = state.players.find(
      (player) => player.seat === winnerSeat,
    )
    this.winnerOverlay?.sync(
      winnerPlayer?.faction ?? `seat ${String(winnerSeat)}`,
    )
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

  private paintStatus(extra: string | null | undefined): void {
    if (this.statusText === null) {
      return
    }
    const message = extra ?? ''
    this.statusText.setText(message)
    this.statusText.setVisible(message.length > 0)
  }
}

function mergeBattleClearingHighlight(
  clearingIds: readonly number[],
  state: GameState | null,
): number[] {
  if (state === null) {
    return [...clearingIds]
  }
  const battleClearing = readBattleClearingId(state)
  if (battleClearing === null) {
    return [...clearingIds]
  }
  const merged = new Set(clearingIds)
  merged.add(battleClearing)
  return [...merged]
}

function mergeHooks(...hookSets: ActionComposerHooks[]): ActionComposerHooks {
  return {
    begin: (spec) => {
      for (const hooks of hookSets) {
        const outcome = hooks.begin?.(spec) ?? null
        if (outcome !== null) {
          return outcome
        }
      }
      return null
    },
    chooseCard: (cardId) => {
      for (const hooks of hookSets) {
        const outcome = hooks.chooseCard?.(cardId) ?? null
        if (outcome !== null) {
          return outcome
        }
      }
      return null
    },
    chooseClearing: (clearingId) => {
      for (const hooks of hookSets) {
        const outcome = hooks.chooseClearing?.(clearingId) ?? null
        if (outcome !== null) {
          return outcome
        }
      }
      return null
    },
    chooseDefender: (defenderSeat) => {
      for (const hooks of hookSets) {
        const outcome = hooks.chooseDefender?.(defenderSeat) ?? null
        if (outcome !== null) {
          return outcome
        }
      }
      return null
    },
    chooseColumn: (column) => {
      for (const hooks of hookSets) {
        const outcome = hooks.chooseColumn?.(column) ?? null
        if (outcome !== null) {
          return outcome
        }
      }
      return null
    },
    choosePiece: (pieceId) => {
      for (const hooks of hookSets) {
        const outcome = hooks.choosePiece?.(pieceId) ?? null
        if (outcome !== null) {
          return outcome
        }
      }
      return null
    },
    confirm: () => {
      for (const hooks of hookSets) {
        const outcome = hooks.confirm?.() ?? null
        if (outcome !== null) {
          return outcome
        }
      }
      return null
    },
    cancel: () => {
      for (const hooks of hookSets) {
        const outcome = hooks.cancel?.() ?? null
        if (outcome !== null) {
          return outcome
        }
      }
      return null
    },
  }
}
