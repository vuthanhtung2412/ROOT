import Phaser from 'phaser'
import type { ActionSpec, GameState } from '../api/client.ts'
import { createPhaserApi } from '../api/client.ts'
import {
  ActionComposer,
  type ActionComposerHooks,
  type ComposerOutcome,
} from '../game/ActionComposer.ts'
import { createEventComposerHooks } from '../game/eventActionComposer.ts'
import { createEyrieComposerHooks } from '../game/eyrieActionComposer.ts'
import {
  createMarquiseBoardComposerHooks,
  createMarquiseCardComposerHooks,
  createMarquiseMarchComposerHooks,
} from '../game/marquiseActionComposer.ts'
import {
  boardLayoutFromFallResponse,
  FALL_BOARD_LAYOUT,
  type BoardLayout,
} from '../game/boardLayout.ts'
import { buildBattleOverlayViewModel } from '../game/battleOverlayModel.ts'
import type { GameSession, GameSessionSnapshot } from '../game/GameSession.ts'
import { ActionTray } from '../ui/ActionTray.ts'
import { BattleOverlay } from '../ui/BattleOverlay.ts'
import { BoardView } from '../ui/BoardView.ts'
import { CardHand } from '../ui/CardHand.ts'
import { CardDetailOverlay } from '../ui/CardDetailOverlay.ts'
import { EyrieDecreePanel } from '../ui/EyrieDecreePanel.ts'
import { EventOverlay } from '../ui/EventOverlay.ts'
import { FactionDrawer } from '../ui/FactionDrawer.ts'
import { GameDrawer } from '../ui/GameDrawer.ts'
import { HandoffOverlay } from '../ui/HandoffOverlay.ts'
import { PlayerRail } from '../ui/PlayerRail.ts'
import { SelectionPrompt } from '../ui/SelectionPrompt.ts'
import {
  buildTurnBannerViewModel,
  TurnBanner,
} from '../ui/TurnBanner.ts'
import { WinnerOverlay } from '../ui/WinnerOverlay.ts'

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
  private selectionPrompt: SelectionPrompt | null = null
  private eyrieDecreePanel: EyrieDecreePanel | null = null
  private eventOverlay: EventOverlay | null = null
  private battleOverlay: BattleOverlay | null = null
  private factionDrawer: FactionDrawer | null = null
  private gameDrawer: GameDrawer | null = null
  private handoffOverlay: HandoffOverlay | null = null
  private winnerOverlay: WinnerOverlay | null = null
  private lastHandoffSeat: number | null = null
  private readonly composer = new ActionComposer()
  private marquiseMarch = createMarquiseMarchComposerHooks()
  private marquiseBoard = createMarquiseBoardComposerHooks()
  private eyrieComposer = createEyrieComposerHooks()
  private eventComposer = createEventComposerHooks()
  private unsubscribe: (() => void) | null = null
  private statusText: Phaser.GameObjects.Text | null = null
  private latestSnapshot: GameSessionSnapshot | null = null

  constructor() {
    super({ key: 'GameScene' })
  }

  init(data: GameSceneData): void {
    this.session = data.session
  }

  create(): void {
    const { width, height } = this.scale

    const marquiseCards = createMarquiseCardComposerHooks()
    this.marquiseMarch = createMarquiseMarchComposerHooks({
      warriorCountsForCurrentSeat: () => this.readCurrentSeatWarriorCounts(),
    })
    this.marquiseBoard = createMarquiseBoardComposerHooks()
    this.eyrieComposer = createEyrieComposerHooks()
    this.eventComposer = createEventComposerHooks()
    this.composer.setHooks(
      mergeHooks(
        marquiseCards.hooks,
        this.marquiseMarch.hooks,
        this.marquiseBoard.hooks,
        this.eyrieComposer.hooks,
        this.eventComposer.hooks,
      ),
    )

    this.turnBanner = new TurnBanner(this)
    this.playerRail = new PlayerRail(this)
    this.cardHand = new CardHand(
      this,
      (cardId) => {
        this.applyComposerOutcome(this.composer.chooseCard(cardId))
      },
      (held) => {
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
    this.eyrieDecreePanel = new EyrieDecreePanel(this)
    this.eventOverlay = new EventOverlay(this)
    this.battleOverlay = new BattleOverlay(this)
    this.factionDrawer = new FactionDrawer(this)
    this.gameDrawer = new GameDrawer(this, {
      onUndo: () => {
        void this.session?.undo()
      },
    })
    this.handoffOverlay = new HandoffOverlay(this, {
      onContinue: () => {
        this.handoffOverlay?.hide()
      },
    })
    this.winnerOverlay = new WinnerOverlay(this)
    this.selectionPrompt = new SelectionPrompt(this, {
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

    this.statusText = this.add
      .text(width * 0.38, height * 0.92, '', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#9a9a9a',
      })
      .setOrigin(0.5)

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
    this.cardDetailOverlay?.destroy()
    this.cardDetailOverlay = null
    this.actionTray?.destroy()
    this.actionTray = null
    this.eyrieDecreePanel?.destroy()
    this.eyrieDecreePanel = null
    this.eventOverlay?.destroy()
    this.eventOverlay = null
    this.battleOverlay?.destroy()
    this.battleOverlay = null
    this.factionDrawer?.destroy()
    this.factionDrawer = null
    this.gameDrawer?.destroy()
    this.gameDrawer = null
    this.handoffOverlay?.destroy()
    this.handoffOverlay = null
    this.winnerOverlay?.destroy()
    this.winnerOverlay = null
    this.selectionPrompt?.destroy()
    this.selectionPrompt = null
  }

  private handleSelectAction(spec: ActionSpec): void {
    this.applyComposerOutcome(this.composer.begin(spec))
  }

  private applyComposerOutcome(outcome: ComposerOutcome): void {
    if (outcome.kind === 'ready') {
      this.selectionPrompt?.sync(null)
      this.boardView?.setHighlightedClearings([])
      this.cardHand?.setEnabledCards(null)
      this.cardHand?.setSelection([])
      this.composer.reset()
      void this.session?.submitAction(outcome.action)
      return
    }

    if (outcome.kind === 'incomplete') {
      this.selectionPrompt?.sync(
        outcome.prompt,
        [
          ...this.marquiseMarch.getPromptOptions(),
          ...this.marquiseBoard.getPromptOptions(),
          ...this.eyrieComposer.getPromptOptions(),
          ...this.eventComposer.getPromptOptions(),
        ],
      )
      this.boardView?.setHighlightedClearings(outcome.prompt.highlightClearings)
      this.cardHand?.setEnabledCards(outcome.prompt.enabledCardIds)
      this.eventOverlay?.sync(
        this.eventComposer.getOverlayKind() === 'fieldHospital',
        outcome.prompt.message,
      )
      this.syncBattleOverlay(outcome.prompt.message)
      return
    }

    this.selectionPrompt?.sync(null)
    this.boardView?.setHighlightedClearings([])
    this.cardHand?.setEnabledCards(null)
    this.cardHand?.setSelection([])
    this.eventOverlay?.sync(false, '')
    this.syncBattleOverlay(null)
  }

  private syncBattleOverlay(prompt: string | null): void {
    const state = this.latestSnapshot?.state
    if (state === null || state === undefined) {
      this.battleOverlay?.sync(null)
      return
    }
    this.battleOverlay?.sync(buildBattleOverlayViewModel(state, prompt))
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
      return
    }
    const banner = buildTurnBannerViewModel(
      snapshot.state,
      snapshot.legalActions,
    )
    this.turnBanner?.sync(banner)
    this.playerRail?.sync(snapshot.state, banner.actorSeat)
    this.cardHand?.sync(snapshot.state, snapshot.legalActions)
    this.actionTray?.sync(snapshot.legalActions, banner.actorSeat)
    this.eyrieDecreePanel?.sync(snapshot.state)
    this.factionDrawer?.sync(snapshot.state)
    this.gameDrawer?.sync(snapshot.log, snapshot.historyLength > 0)
    this.battleOverlay?.sync(buildBattleOverlayViewModel(snapshot.state))
    this.maybeShowHandoff(banner.actorSeat, banner.actorFaction)
    this.syncWinner(snapshot.state)
    this.paintStatus(snapshot.error)
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

  private maybeShowHandoff(actorSeat: number, actorFaction: string): void {
    if (this.lastHandoffSeat === null) {
      this.lastHandoffSeat = actorSeat
      return
    }
    if (this.lastHandoffSeat === actorSeat) {
      return
    }
    this.lastHandoffSeat = actorSeat
    this.handoffOverlay?.show(actorFaction)
  }

  private syncBoardPieces(snapshot: GameSessionSnapshot): void {
    if (this.boardView === null || snapshot.state === null) {
      return
    }
    this.boardView.syncPieces(snapshot.state.clearings, snapshot.state.factions)
  }

  private async loadLayout(): Promise<BoardLayout> {
    try {
      const api = createPhaserApi({ baseUrl: '' })
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
    this.statusText.setText(extra ?? '')
  }
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
