import type Phaser from 'phaser'

function formatLogEntry(entry: unknown): string {
  if (typeof entry !== 'object' || entry === null) {
    return String(entry)
  }
  const type = Reflect.get(entry, 't')
  if (typeof type === 'string') {
    return type
  }
  const typed = Reflect.get(entry, 'type')
  if (typeof typed === 'string') {
    return typed
  }
  return JSON.stringify(entry).slice(0, 60)
}

export class GameLog {
  readonly gameObject: Phaser.GameObjects.Text

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.gameObject = scene.add.text(x, y, '', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#c8c8c8',
      lineSpacing: 2,
      wordWrap: { width: 200 },
    })
  }

  sync(log: readonly unknown[]): void {
    const lines = log.slice(-12).map(formatLogEntry)
    this.gameObject.setText(['Log', ...lines].join('\n'))
  }

  destroy(): void {
    this.gameObject.destroy()
  }
}
