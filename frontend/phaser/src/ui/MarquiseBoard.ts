import type Phaser from 'phaser'
import type { GameState } from '../api/client.ts'

function isMarquiseBoard(value: unknown): value is {
  kind: 'marquise'
  supply: { warriors: number; wood: number }
  tracks: {
    sawmill: { placed: number }
    workshop: { placed: number }
    recruiter: { placed: number }
  }
} {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  return Reflect.get(value, 'kind') === 'marquise'
}

export class MarquiseBoard {
  readonly gameObject: Phaser.GameObjects.Text

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.gameObject = scene.add.text(x, y, '', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#f0e6d3',
      lineSpacing: 4,
    })
  }

  sync(state: GameState): void {
    const player = state.players.find((entry) => entry.faction === 'marquise')
    if (player === undefined || !isMarquiseBoard(player.board)) {
      this.gameObject.setText('Marquise board unavailable')
      return
    }
    const board = player.board
    this.gameObject.setText(
      [
        'Marquise',
        `warriors ${String(board.supply.warriors)} · wood ${String(board.supply.wood)}`,
        `sawmill track ${String(board.tracks.sawmill.placed)}`,
        `workshop track ${String(board.tracks.workshop.placed)}`,
        `recruiter track ${String(board.tracks.recruiter.placed)}`,
      ].join('\n'),
    )
  }

  destroy(): void {
    this.gameObject.destroy()
  }
}
