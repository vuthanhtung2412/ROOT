import type Phaser from 'phaser'
import { gameViewSize } from '../game/hiDpi.ts'
import type { FactionBoardViewModel } from './factionBoardViewModel.ts'

const MODAL_DEPTH = 360

/**
 * Steam-inspired faction board lookup: board art + track/supply HUD + Close.
 */
export class FactionBoardModal {
  private readonly scene: Phaser.Scene
  private readonly root: Phaser.GameObjects.Container
  private contentNodes: Phaser.GameObjects.GameObject[] = []
  private visible = false
  private currentSeat: number | null = null

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.root = scene.add.container(0, 0).setDepth(MODAL_DEPTH).setVisible(false)
  }

  isOpen(): boolean {
    return this.visible
  }

  openSeat(): number | null {
    return this.currentSeat
  }

  show(view: FactionBoardViewModel): void {
    this.clearContent()
    this.currentSeat = view.seat
    this.visible = true
    this.root.setVisible(true)

    const { width, height } = gameViewSize()
    const veil = this.scene.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 0.72)
      .setInteractive()
    veil.on('pointerdown', () => {
      this.hide()
    })

    const boardMaxWidth = width * 0.72
    const boardMaxHeight = height * 0.62
    const boardTop = height * 0.06
    const children: Phaser.GameObjects.GameObject[] = [veil]

    if (this.scene.textures.exists(view.boardTextureKey)) {
      const boardImage = this.scene.add
        .image(width / 2, boardTop, view.boardTextureKey)
        .setOrigin(0.5, 0)
      const source = boardImage.texture.getSourceImage()
      const naturalWidth = source.width
      const naturalHeight = source.height
      const scale = Math.min(
        boardMaxWidth / naturalWidth,
        boardMaxHeight / naturalHeight,
      )
      boardImage.setDisplaySize(naturalWidth * scale, naturalHeight * scale)
      children.push(boardImage)
    } else {
      const fallback = this.scene.add
        .rectangle(
          width / 2,
          boardTop + boardMaxHeight / 2,
          boardMaxWidth,
          boardMaxHeight,
          view.kind === 'marquise' ? 0xb85a1a : 0x1a2a4a,
          0.95,
        )
        .setStrokeStyle(2, 0xf0e6d3, 0.7)
      children.push(fallback)
    }

    const headerY = boardTop - 4
    const header = this.scene.add
      .text(
        width / 2,
        headerY,
        `${view.factionName}  ·  ${String(view.victoryPoints)} VP`,
        {
          fontFamily: 'Georgia, serif',
          fontSize: '20px',
          color: '#f7f0e4',
          backgroundColor: '#0a0a0acc',
          padding: { x: 14, y: 6 },
        },
      )
      .setOrigin(0.5, 1)
    children.push(header)

    if (view.kind === 'eyrie' && view.leader !== null) {
      const banner = this.scene.add
        .text(
          width / 2,
          boardTop + 8,
          `${view.leader.name}: ${view.leader.ability}`,
          {
            fontFamily: 'Georgia, serif',
            fontSize: '13px',
            color: '#1a1408',
            backgroundColor: '#e8d9a8ee',
            padding: { x: 12, y: 6 },
            wordWrap: { width: boardMaxWidth * 0.85 },
            align: 'center',
          },
        )
        .setOrigin(0.5, 0)
      children.push(banner)
    }

    const hudTop = boardTop + boardMaxHeight + 10
    children.push(...this.buildHud(view, width, hudTop, boardMaxWidth))

    const closeButton = this.scene.add
      .text(width / 2, height - 28, '✕  Close', {
        fontFamily: 'Georgia, serif',
        fontSize: '18px',
        color: '#1a1a1a',
        backgroundColor: '#f0e6d3',
        padding: { x: 28, y: 10 },
      })
      .setOrigin(0.5, 1)
      .setInteractive({ useHandCursor: true })
    closeButton.on('pointerdown', () => {
      this.hide()
    })
    children.push(closeButton)

    this.root.add(children)
    this.contentNodes = children
  }

  hide(): void {
    this.visible = false
    this.currentSeat = null
    this.clearContent()
    this.root.setVisible(false)
  }

  destroy(): void {
    this.root.destroy(true)
  }

  private clearContent(): void {
    for (const node of this.contentNodes) {
      node.destroy()
    }
    this.contentNodes = []
    this.root.removeAll(false)
  }

  private buildHud(
    view: FactionBoardViewModel,
    viewWidth: number,
    hudTop: number,
    boardMaxWidth: number,
  ): Phaser.GameObjects.GameObject[] {
    const nodes: Phaser.GameObjects.GameObject[] = []
    const left = viewWidth / 2 - boardMaxWidth / 2

    if (view.kind === 'marquise') {
      nodes.push(
        this.makeLabel(
          left,
          hudTop,
          `Warriors ${String(view.warriors)}  ·  Wood ${String(view.wood)}  ·  Hand ${String(view.handSize)}`,
        ),
      )
      nodes.push(
        this.makeLabel(
          left,
          hudTop + 22,
          this.formatCrafted(view.crafted.cardNames, view.crafted.itemTypes),
        ),
      )
      nodes.push(
        ...this.buildMarquiseTracks(view, left, hudTop + 48, boardMaxWidth),
      )
      return nodes
    }

    nodes.push(
      this.makeLabel(
        left,
        hudTop,
        `Warriors ${String(view.warriors)}  ·  Hand ${String(view.handSize)}  ·  Roosts ${String(view.roostsOnMap)}`,
      ),
    )
    nodes.push(
      this.makeLabel(
        left,
        hudTop + 22,
        this.formatCrafted(view.crafted.cardNames, view.crafted.itemTypes),
      ),
    )
    nodes.push(...this.buildEyrieRoostTrack(view, left, hudTop + 48, boardMaxWidth))
    return nodes
  }

  private buildMarquiseTracks(
    view: Extract<FactionBoardViewModel, { kind: 'marquise' }>,
    left: number,
    top: number,
    boardMaxWidth: number,
  ): Phaser.GameObjects.GameObject[] {
    const nodes: Phaser.GameObjects.GameObject[] = []
    const rows: Array<{
      label: string
      emptied: number
      victoryPoints: number[]
    }> = [
      {
        label: 'Sawmills',
        emptied: view.emptiedColumnCount.sawmill,
        victoryPoints: view.trackColumns.map(
          (column) => column.sawmillVictoryPoints,
        ),
      },
      {
        label: 'Workshops',
        emptied: view.emptiedColumnCount.workshop,
        victoryPoints: view.trackColumns.map(
          (column) => column.workshopVictoryPoints,
        ),
      },
      {
        label: 'Recruiters',
        emptied: view.emptiedColumnCount.recruiter,
        victoryPoints: view.trackColumns.map(
          (column) => column.recruiterVictoryPoints,
        ),
      },
    ]

    rows.forEach((row, rowIndex) => {
      const y = top + rowIndex * 28
      nodes.push(this.makeLabel(left, y, row.label, '#c8bfb0'))
      nodes.push(
        ...this.buildTrackCells(
          left + 100,
          y,
          boardMaxWidth - 100,
          row.victoryPoints,
          row.emptied,
        ),
      )
    })
    return nodes
  }

  private buildEyrieRoostTrack(
    view: Extract<FactionBoardViewModel, { kind: 'eyrie' }>,
    left: number,
    top: number,
    boardMaxWidth: number,
  ): Phaser.GameObjects.GameObject[] {
    const nodes: Phaser.GameObjects.GameObject[] = [
      this.makeLabel(left, top, 'Roosts', '#c8bfb0'),
    ]
    const victoryPoints = view.roostTrack.map(
      (column) => column.eveningVictoryPoints,
    )
    nodes.push(
      ...this.buildTrackCells(
        left + 100,
        top,
        boardMaxWidth - 100,
        victoryPoints,
        view.roostsOnMap,
      ),
    )
    return nodes
  }

  private buildTrackCells(
    left: number,
    top: number,
    totalWidth: number,
    victoryPoints: number[],
    emptiedCount: number,
  ): Phaser.GameObjects.GameObject[] {
    const nodes: Phaser.GameObjects.GameObject[] = []
    const gap = 4
    const cellWidth =
      (totalWidth - gap * (victoryPoints.length - 1)) / victoryPoints.length
    const cellHeight = 22

    victoryPoints.forEach((points, index) => {
      const x = left + index * (cellWidth + gap)
      const emptied = index < emptiedCount
      const cell = this.scene.add
        .rectangle(
          x,
          top,
          cellWidth,
          cellHeight,
          emptied ? 0x2a2418 : 0x111111,
          emptied ? 0.95 : 0.75,
        )
        .setOrigin(0, 0)
        .setStrokeStyle(emptied ? 2 : 1, emptied ? 0xffffff : 0x666666, 1)
      const label = this.scene.add
        .text(x + cellWidth / 2, top + cellHeight / 2, String(points), {
          fontFamily: 'monospace',
          fontSize: '12px',
          color: emptied ? '#ffe08a' : '#888888',
        })
        .setOrigin(0.5)
      nodes.push(cell, label)
    })
    return nodes
  }

  private makeLabel(
    x: number,
    y: number,
    text: string,
    color = '#f0e6d3',
  ): Phaser.GameObjects.Text {
    return this.scene.add.text(x, y, text, {
      fontFamily: 'monospace',
      fontSize: '13px',
      color,
      backgroundColor: '#0a0a0acc',
      padding: { x: 8, y: 4 },
    })
  }

  private formatCrafted(cardNames: string[], itemTypes: string[]): string {
    const cards =
      cardNames.length === 0 ? '(none)' : cardNames.join(', ')
    const items =
      itemTypes.length === 0 ? '(none)' : itemTypes.join(', ')
    return `Crafted cards ${cards}  ·  Items ${items}`
  }
}
