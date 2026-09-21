import type Phaser from 'phaser'
import type { GameState } from '../api/client.ts'

function isEyrieBoard(value: unknown): value is {
  kind: 'eyrie'
  supply: { warriors: number }
  leader: string
  roostTrack: { placed: number }
} {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  return Reflect.get(value, 'kind') === 'eyrie'
}

export class EyrieBoard {
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
    const player = state.players.find((entry) => entry.faction === 'eyrie')
    if (player === undefined || !isEyrieBoard(player.board)) {
      this.gameObject.setText('Eyrie board unavailable')
      return
    }
    const board = player.board
    this.gameObject.setText(
      [
        'Eyrie',
        `leader ${board.leader ?? '—'}`,
        `face-up ${Array.isArray(Reflect.get(board, 'leadersFaceUp')) ? (Reflect.get(board, 'leadersFaceUp') as string[]).join(', ') : '—'}`,
        `warriors ${String(board.supply.warriors)}`,
        `roosts left on track ${String(board.roostTrack.placed)}`,
      ].join('\n'),
    )
  }

  destroy(): void {
    this.gameObject.destroy()
  }
}
