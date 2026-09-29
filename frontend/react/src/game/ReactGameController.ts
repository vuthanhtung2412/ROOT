import type { ActionSpec, GameState } from '#api/client.ts'
import { ActionComposer, type ComposerOutcome } from '#game/resolution/ActionComposer.ts'
import { AutoPromptController } from '#game/resolution/autoPromptController.ts'
import { BattleOverlayController } from '#game/battleOverlayController.ts'
import { applyComposerOutcomeToHud } from '#game/resolution/composerOutcomeApplier.ts'
import {
  hideSelectableCardPile,
  showCardPile,
} from '#game/cardGalleryBridge.ts'
import { shouldDisableActionTray } from '#game/actionTrayDisable.ts'
import { isActionUnderResolution } from '#game/resolution/actionUnderResolution.ts'
import { paintGameSceneHud } from '#game/gameSceneHudPaint.ts'
import { createEventComposerHooks } from '#game/resolution/eventActionComposer.ts'
import { GameSceneModals } from '#game/gameSceneModals.ts'
import { patchHud, resetHud, setHudCallbacks } from '#game/hudStore.ts'
import { showCardDetail } from '#react/CardDetailOverlay.tsx'
import { syncLeaderPickOverlay } from '#react/HudChrome.tsx'
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
import { createVagabondComposerHooks } from '#game/resolution/vagabondActionComposer.ts'
import { createDominanceComposerHooks } from '#game/resolution/dominanceActionComposer.ts'
import { createAllianceComposerHooks } from '#game/resolution/allianceActionComposer.ts'
import { readBattleClearingId } from '#game/battleOverlayModel.ts'
import {
  applyMarchPreview,
  buildCurrentSeatWarriorCounts,
  loadGameSceneBoardLayout,
} from '#game/gameSceneBoardState.ts'
import type { BoardLayout } from '#game/boardLayout.ts'
import type { GameSession, GameSessionSnapshot } from '#game/GameSession.ts'
import type { ActionTraySyncOptions } from '#ui/ActionTray.ts'
import { syncActionTray } from '#react/ActionTray.tsx'
import { syncBattleOverlayView } from '#react/BattleOverlay.tsx'
import type { BattleOverlaySyncTarget } from '#game/battleOverlayController.ts'
import { buildTurnBannerViewModel } from '#ui/TurnBanner.ts'
import { syncTurnBannerComposer } from '#react/TurnBanner.tsx'
import type { BoardClearingPieces } from '#react/PieceStack.tsx'
import {
  isVagabondBoardWithForest,
  type ForestPawnMarker,
} from '#game/forestLayout.ts'

export type ReactGameBoardSnapshot = {
  layout: BoardLayout | null
  clearings: readonly BoardClearingPieces[] | null
  factions: readonly string[] | null
  forestPawns: readonly ForestPawnMarker[]
  highlightedClearingIds: readonly number[]
  highlightedForestIndexes: readonly number[]
}

type BoardListener = () => void

/**
 * GameScene logic without Phaser — owns session composers + board snapshot for React.
 */
export class ReactGameController {
  private session: GameSession | null = null
  private layout: BoardLayout | null = null
  private boardClearings: readonly BoardClearingPieces[] | null = null
  private boardFactions: readonly string[] | null = null
  private forestPawns: readonly ForestPawnMarker[] = []
  private highlightedClearingIds: readonly number[] = []
  private highlightedForestIndexes: readonly number[] = []
  private boardReady = false
  private boardSnapshot: ReactGameBoardSnapshot = {
    layout: null,
    clearings: null,
    factions: null,
    forestPawns: [],
    highlightedClearingIds: [],
    highlightedForestIndexes: [],
  }
  private readonly boardListeners = new Set<BoardListener>()

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
  private vagabondComposer = createVagabondComposerHooks()
  private dominanceComposer = createDominanceComposerHooks()
  private allianceComposer = createAllianceComposerHooks()
  private eventComposer = createEventComposerHooks()
  private unsubscribe: (() => void) | null = null
  private latestSnapshot: GameSessionSnapshot | null = null
  private autoPrompts: AutoPromptController | null = null
  private battleOverlayController: BattleOverlayController | null = null
  private modals: GameSceneModals | null = null
  private endingGame = false
  private onReturnToMenu: (() => void) | null = null

  subscribeBoard(listener: BoardListener): () => void {
    this.boardListeners.add(listener)
    return () => {
      this.boardListeners.delete(listener)
    }
  }

  getBoardSnapshot(): ReactGameBoardSnapshot {
    return this.boardSnapshot
  }

  private notifyBoard(): void {
    this.boardSnapshot = {
      layout: this.layout,
      clearings: this.boardClearings,
      factions: this.boardFactions,
      forestPawns: this.forestPawns,
      highlightedClearingIds: this.highlightedClearingIds,
      highlightedForestIndexes: this.highlightedForestIndexes,
    }
    for (const listener of this.boardListeners) {
      listener()
    }
  }

  async start(
    session: GameSession,
    onReturnToMenu: () => void,
  ): Promise<void> {
    this.stop()
    this.session = session
    this.onReturnToMenu = onReturnToMenu
    this.endingGame = false
    patchHud({ shell: 'game', bootLoading: null, menu: null })

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
    this.vagabondComposer = createVagabondComposerHooks()
    this.dominanceComposer = createDominanceComposerHooks()
    this.allianceComposer = createAllianceComposerHooks()
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
      isBoardReady: () => this.boardReady,
    })
    this.battleOverlayController = new BattleOverlayController(
      {
        delayedCall: (delayMs, callback) => {
          const handle = window.setTimeout(callback, delayMs)
          return {
            remove: () => {
              window.clearTimeout(handle)
            },
          }
        },
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
        this.allianceComposer.hooks,
        this.vagabondComposer.hooks,
        this.dominanceComposer.hooks,
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
      onCompletedQuestsClick: (seat) => {
        const state = this.latestSnapshot?.state
        if (state !== null && state !== undefined) {
          this.modals?.openCompletedQuests(state, seat)
          this.syncActionTrayFromLatestSnapshot()
        }
      },
      onSupportersClick: (seat) => {
        const state = this.latestSnapshot?.state
        if (state !== null && state !== undefined) {
          this.modals?.openSupporters(state, seat)
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

    this.layout = await loadGameSceneBoardLayout()
    this.boardReady = true
    this.notifyBoard()

    this.unsubscribe = session.subscribe((snapshot) => {
      this.latestSnapshot = snapshot
      this.paintHud(snapshot)
      this.syncBoardPieces(snapshot)
    })
    this.latestSnapshot = session.getSnapshot()
    this.paintHud(this.latestSnapshot)
    this.syncBoardPieces(this.latestSnapshot)
    const outcome = this.composer.getOutcome()
    if (outcome.kind === 'incomplete') {
      this.applyComposerOutcome(outcome)
    }
  }

  stop(): void {
    resetHud()
    if (this.unsubscribe !== null) {
      this.unsubscribe()
      this.unsubscribe = null
    }
    this.battleOverlayController?.destroy()
    this.battleOverlayController = null
    this.autoPrompts = null
    this.modals = null
    this.boardReady = false
    this.layout = null
    this.boardClearings = null
    this.boardFactions = null
    this.forestPawns = []
    this.highlightedClearingIds = []
    this.highlightedForestIndexes = []
    this.session = null
    this.notifyBoard()
  }

  selectClearing(clearingId: number): void {
    this.applyComposerOutcome(this.composer.chooseClearing(clearingId))
  }

  selectForest(forestIndex: number): void {
    this.applyComposerOutcome(this.composer.chooseForest(forestIndex))
  }

  private setHighlightedClearings(clearingIds: readonly number[]): void {
    this.highlightedClearingIds = clearingIds
    this.notifyBoard()
  }

  private setHighlightedForests(forestIndexes: readonly number[]): void {
    this.highlightedForestIndexes = forestIndexes
    this.notifyBoard()
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
    const returnToMenu = this.onReturnToMenu
    this.stop()
    if (returnToMenu !== null) {
      returnToMenu()
    }
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
        this.setHighlightedClearings(clearingIds)
      },
      setHighlightedForests: (forestIndexes) => {
        this.setHighlightedForests(forestIndexes)
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
        ...this.allianceComposer.getPromptOptions(),
        ...this.vagabondComposer.getPromptOptions(),
        ...this.dominanceComposer.getPromptOptions(),
        ...this.eventComposer.getPromptOptions(),
      ],
      getDiscardSelection: () => {
        const discardDraft = this.marquiseCards.getDraft()
        return discardDraft.type === 'discardMany' ? discardDraft.selected : []
      },
      getSupporterPilePick: () => this.allianceComposer.getSupporterPilePick(),
      syncSupporterPilePick: (pick) => {
        if (pick === null) {
          hideSelectableCardPile()
          return
        }
        showCardPile({
          title: pick.title,
          cards: pick.cards,
          emptyMessage: 'No matching supporters',
          selectable: true,
          selectedCardIds: pick.selectedCardIds,
        })
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
      isAnyModalOpen: false,
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
        this.allianceComposer.getDraft(),
        this.vagabondComposer.getDraft(),
        this.dominanceComposer.getDraft(),
        this.eventComposer.getDraft(),
      ])
    )
  }

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
    this.setHighlightedClearings(
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

  private paintHud(snapshot: GameSessionSnapshot): void {
    paintGameSceneHud(snapshot, {
      getSession: () => this.session,
      getModals: () => this.modals,
      getAutoPrompts: () => this.autoPrompts,
      localPlayerControlsSeat: (actorSeat) =>
        this.localPlayerControlsSeat(actorSeat),
      actionTraySyncOptions: () => {
        const current = this.latestSnapshot
        if (current === null || current.state === null) {
          return { disabled: true }
        }
        const banner = buildTurnBannerViewModel(
          current.state,
          current.legalActions,
        )
        return this.actionTraySyncOptions(
          this.localPlayerControlsSeat(banner.actorSeat),
          current.state,
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
          const returnToMenu = this.onReturnToMenu
          this.stop()
          if (returnToMenu !== null) {
            returnToMenu()
          }
        }
      },
    })
  }

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
    if (!this.boardReady || snapshot.state === null) {
      return
    }
    const clearings = applyMarchPreview(
      snapshot.state.clearings,
      snapshot.state.currentSeat,
      this.marquiseMarch.getMarchPreviewMove(),
    )
    this.boardClearings = clearings
    this.boardFactions = snapshot.state.factions
    this.forestPawns = forestPawnsFromState(snapshot.state)
    this.notifyBoard()
  }
}

function forestPawnsFromState(state: {
  players: Array<{ seat: number; faction: string; board?: unknown }>
  factions: string[]
}): ForestPawnMarker[] {
  const markers: ForestPawnMarker[] = []
  for (const player of state.players) {
    if (!isVagabondBoardWithForest(player.board)) continue
    markers.push({
      forestIndex: player.board.forest,
      seat: player.seat,
      factionId: player.faction,
    })
  }
  return markers
}
