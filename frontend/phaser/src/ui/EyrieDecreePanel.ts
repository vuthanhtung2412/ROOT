import type Phaser from 'phaser'
import type { GameState } from '../api/client.ts'
import { lookupCardCatalog } from '../assets/gameAssets.ts'
import { gameViewSize } from '../game/hiDpi.ts'

const DECREE_COLUMNS = ['recruit', 'move', 'battle', 'build'] as const

type DecreeColumn = (typeof DECREE_COLUMNS)[number]

type EyrieBoardView = {
  kind: 'eyrie'
  leader?: string
  decree?: Record<string, Array<{ id: string; defId: string }>>
  roostTrack?: { placed: number }
}

function isEyrieBoard(value: unknown): value is EyrieBoardView {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  return Reflect.get(value, 'kind') === 'eyrie'
}

function suitForDecreeCard(defId: string): string {
  if (defId === 'VIZIER') {
    return 'bird'
  }
  return lookupCardCatalog(defId)?.suit ?? '?'
}

function formatDecreeSuits(cards: ReadonlyArray<{ defId: string }>): string {
  if (cards.length === 0) {
    return '—'
  }
  return cards.map((card) => suitForDecreeCard(card.defId)).join(', ')
}

function readDecreeCursor(turnScratch: unknown): {
  column: string
  remaining: string[]
} | null {
  if (typeof turnScratch !== 'object' || turnScratch === null) {
    return null
  }
  const decree = Reflect.get(turnScratch, 'decree')
  if (typeof decree !== 'object' || decree === null) {
    return null
  }
  const column = Reflect.get(decree, 'column')
  const remaining = Reflect.get(decree, 'remaining')
  if (typeof column !== 'string' || !Array.isArray(remaining)) {
    return null
  }
  if (!remaining.every((entry) => typeof entry === 'string')) {
    return null
  }
  return { column, remaining }
}

/** Right-side Eyrie decree columns + Builder badge. */
export class EyrieDecreePanel {
  private readonly scene: Phaser.Scene
  private readonly root: Phaser.GameObjects.Container
  private nodes: Phaser.GameObjects.GameObject[] = []

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    const { width } = gameViewSize()
    this.root = scene.add.container(width - 210, 280).setDepth(105)
  }

  sync(state: GameState): void {
    for (const node of this.nodes) {
      node.destroy()
    }
    this.nodes = []

    const eyriePlayer = state.players.find((player) => player.faction === 'eyrie')
    if (eyriePlayer === undefined || !isEyrieBoard(eyriePlayer.board)) {
      return
    }

    const board = eyriePlayer.board
    const cursor = readDecreeCursor(state.turnScratch)
    const leader = board.leader ?? 'unset'

    const title = this.scene.add.text(0, 0, `Decree · ${leader}`, {
      fontFamily: 'Georgia, serif',
      fontSize: '14px',
      color: '#f0e6d3',
    })
    this.root.add(title)
    this.nodes.push(title)

    DECREE_COLUMNS.forEach((column, index) => {
      const x = (index % 2) * 100
      const y = 28 + Math.floor(index / 2) * 70
      const cards = board.decree?.[column] ?? []
      const isCursor = cursor?.column === column
      const box = this.scene.add
        .rectangle(x, y, 92, 60, 0x111111, 0.85)
        .setOrigin(0, 0)
        .setStrokeStyle(2, isCursor ? 0xffe08a : 0x3a5f8a, 1)
      const label = this.scene.add.text(
        x + 6,
        y + 6,
        `${column}\n${formatDecreeSuits(cards)}`,
        {
          fontFamily: 'monospace',
          fontSize: '11px',
          color: '#f0e6d3',
          wordWrap: { width: 80 },
        },
      )
      this.root.add([box, label])
      this.nodes.push(box, label)
    })

    if (cursor !== null) {
      const remaining = this.scene.add.text(
        0,
        180,
        `cursor: ${cursor.column} · ${String(cursor.remaining.length)} left`,
        {
          fontFamily: 'monospace',
          fontSize: '11px',
          color: '#9a9a9a',
        },
      )
      this.root.add(remaining)
      this.nodes.push(remaining)
    }
  }

  destroy(): void {
    this.root.destroy(true)
  }
}

export type { DecreeColumn }
