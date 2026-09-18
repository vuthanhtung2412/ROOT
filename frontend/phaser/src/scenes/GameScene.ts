import Phaser from 'phaser'
import type { GameSession } from '../game/GameSession.ts'

export type GameSceneData = {
  session: GameSession
}

/** Placeholder until board commit; keeps Menu → Game flow runnable. */
export class GameScene extends Phaser.Scene {
  private session: GameSession | null = null

  constructor() {
    super({ key: 'GameScene' })
  }

  init(data: GameSceneData): void {
    this.session = data.session
  }

  create(): void {
    const { width, height } = this.scale
    const state = this.session?.getSnapshot().state

    this.add
      .text(width / 2, height / 2, 'Game board (coming next)', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#f0e6d3',
      })
      .setOrigin(0.5)

    if (state !== undefined && state !== null) {
      this.add
        .text(
          width / 2,
          height / 2 + 36,
          `turn ${String(state.turn)} · ${state.phase}/${state.step}`,
          {
            fontFamily: 'monospace',
            fontSize: '14px',
            color: '#9a9a9a',
          },
        )
        .setOrigin(0.5)
    }
  }
}
