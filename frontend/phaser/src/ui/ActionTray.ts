import type Phaser from 'phaser'
import type { ActionSpec } from '../api/client.ts'
import { readChoiceParams } from '../game/ActionComposer.ts'
import { gameViewSize } from '../game/hiDpi.ts'

export type ActionTrayHandlers = {
  onSelectAction: (spec: ActionSpec) => void
}

/** Lists legal ActionSpecs for the current prompt actor. */
export class ActionTray {
  private readonly scene: Phaser.Scene
  private readonly root: Phaser.GameObjects.Container
  private readonly title: Phaser.GameObjects.Text
  private buttonNodes: Phaser.GameObjects.GameObject[] = []
  private handlers: ActionTrayHandlers

  constructor(scene: Phaser.Scene, handlers: ActionTrayHandlers) {
    this.scene = scene
    this.handlers = handlers
    const { width } = gameViewSize()
    this.title = scene.add.text(0, 0, 'Actions', {
      fontFamily: 'Georgia, serif',
      fontSize: '16px',
      color: '#f0e6d3',
    })
    this.root = scene.add
      .container(width - 210, 56, [this.title])
      .setDepth(110)
  }

  setHandlers(handlers: ActionTrayHandlers): void {
    this.handlers = handlers
  }

  sync(actions: readonly ActionSpec[], actorSeat: number): void {
    for (const node of this.buttonNodes) {
      node.destroy()
    }
    this.buttonNodes = []

    const forActor = actions.filter((spec) => spec.actor === actorSeat)
    this.title.setText(`Actions (${String(forActor.length)})`)

    forActor.forEach((spec, index) => {
      const button = this.scene.add
        .text(0, 28 + index * 34, formatActionLabel(spec), {
          fontFamily: 'monospace',
          fontSize: '14px',
          color: '#1a1a1a',
          backgroundColor: '#f0e6d3',
          padding: { x: 10, y: 6 },
        })
        .setInteractive({ useHandCursor: true })

      button.on('pointerdown', () => {
        this.handlers.onSelectAction(spec)
      })

      this.root.add(button)
      this.buttonNodes.push(button)
    })
  }

  destroy(): void {
    this.root.destroy(true)
  }
}

function formatActionLabel(spec: ActionSpec): string {
  const params = readChoiceParams(spec)
  if (spec.type === 'decree') {
    const column = params.column?.[0]
    return column !== undefined ? `decree:${column}` : 'decree'
  }
  if (spec.type === 'resolveEvent') {
    if (params.clearing !== undefined) {
      return 'choose keep'
    }
    if (params.leaders !== undefined) {
      return 'choose leader'
    }
    if (params.decline !== undefined) {
      return 'skip ambush'
    }
    if (params.cardIds !== undefined) {
      return 'play ambush'
    }
    if (params.pieceIds !== undefined) {
      return `remove ×${String(params.pieceIds.length)}`
    }
    if (params.useEffect !== undefined) {
      const only = params.useEffect[0]
      if (params.useEffect.length === 1 && only === true) {
        return 'use effect'
      }
      if (params.useEffect.length === 1 && only === false) {
        return 'skip effect'
      }
      return 'battle effect'
    }
    if (params.order !== undefined) {
      return 'effects order'
    }
    return 'resolveEvent'
  }
  return spec.type
}
