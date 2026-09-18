import Phaser from 'phaser'
import { createPhaserApi } from '../api/client.ts'
import {
  boardLayoutFromFallResponse,
  FALL_BOARD_LAYOUT,
  type BoardLayout,
} from '../game/boardLayout.ts'
import type { GameSession, GameSessionSnapshot } from '../game/GameSession.ts'
import { BoardView } from '../ui/BoardView.ts'

export type GameSceneData = {
  session: GameSession
}

export class GameScene extends Phaser.Scene {
  private session: GameSession | null = null
  private boardView: BoardView | null = null
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
        this.paintStatus(snapshot.state?.phase, snapshot.state?.step, snapshot.error)
        this.syncBoardPieces(snapshot)
      })
    }
  }

  shutdown(): void {
    if (this.unsubscribe !== null) {
      this.unsubscribe()
      this.unsubscribe = null
    }
    if (this.boardView !== null) {
      this.boardView.destroy()
      this.boardView = null
    }
  }

  private async bootstrapBoard(): Promise<void> {
    const layout = await this.loadLayout()
    this.boardView = new BoardView({
      scene: this,
      layout,
      onClearingSelected: (clearingId) => {
        this.paintStatus(
          this.latestSnapshot?.state?.phase,
          this.latestSnapshot?.state?.step,
          `clearing ${String(clearingId)}`,
        )
      },
    })
    if (this.latestSnapshot !== null) {
      this.syncBoardPieces(this.latestSnapshot)
    }
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

  private paintStatus(
    phase: string | undefined,
    step: string | undefined,
    extra: string | null | undefined,
  ): void {
    if (this.statusText === null) {
      return
    }
    const parts: string[] = []
    if (phase !== undefined && step !== undefined) {
      parts.push(`${phase}/${step}`)
    }
    if (extra !== null && extra !== undefined && extra !== '') {
      parts.push(extra)
    }
    this.statusText.setText(parts.join(' · '))
  }
}
