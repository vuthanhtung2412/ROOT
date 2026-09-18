import Phaser from 'phaser'
import type { ActionSpec } from '../api/client.ts'
import { createPhaserApi } from '../api/client.ts'
import {
  ActionComposer,
  type ActionComposerHooks,
  type ComposerOutcome,
} from '../game/ActionComposer.ts'
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
import type { GameSession, GameSessionSnapshot } from '../game/GameSession.ts'
import { ActionTray } from '../ui/ActionTray.ts'
import { BoardView } from '../ui/BoardView.ts'
import { CardHand } from '../ui/CardHand.ts'
import { PlayerRail } from '../ui/PlayerRail.ts'
import { SelectionPrompt } from '../ui/SelectionPrompt.ts'
import {
  buildTurnBannerViewModel,
  TurnBanner,
} from '../ui/TurnBanner.ts'

export type GameSceneData = {
  session: GameSession
}

export class GameScene extends Phaser.Scene {
  private session: GameSession | null = null
  private boardView: BoardView | null = null
  private turnBanner: TurnBanner | null = null
  private playerRail: PlayerRail | null = null
  private cardHand: CardHand | null = null
  private actionTray: ActionTray | null = null
  private selectionPrompt: SelectionPrompt | null = null
  private readonly composer = new ActionComposer()
  private marquiseBoard = createMarquiseBoardComposerHooks()
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
    const marquiseMarch = createMarquiseMarchComposerHooks()
    this.marquiseBoard = createMarquiseBoardComposerHooks()
    this.composer.setHooks(
      mergeHooks(
        marquiseCards.hooks,
        marquiseMarch.hooks,
        this.marquiseBoard.hooks,
      ),
    )

    this.turnBanner = new TurnBanner(this)
    this.playerRail = new PlayerRail(this)
    this.cardHand = new CardHand(this, (cardId) => {
      this.applyComposerOutcome(this.composer.chooseCard(cardId))
    })
    this.actionTray = new ActionTray(this, {
      onSelectAction: (spec) => {
        this.handleSelectAction(spec)
      },
    })
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
    this.actionTray?.destroy()
    this.actionTray = null
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
        this.marquiseBoard.getPromptOptions(),
      )
      this.boardView?.setHighlightedClearings(outcome.prompt.highlightClearings)
      this.cardHand?.setEnabledCards(outcome.prompt.enabledCardIds)
      return
    }

    this.selectionPrompt?.sync(null)
    this.boardView?.setHighlightedClearings([])
    this.cardHand?.setEnabledCards(null)
    this.cardHand?.setSelection([])
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
    const banner = buildTurnBannerViewModel(snapshot.state)
    this.turnBanner?.sync(banner)
    this.playerRail?.sync(snapshot.state, banner.actorSeat)
    this.cardHand?.sync(snapshot.state)
    this.actionTray?.sync(snapshot.legalActions, banner.actorSeat)
    this.paintStatus(snapshot.error)
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
