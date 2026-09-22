import type Phaser from 'phaser'
import {
  EYRIE_BOARD_LAYOUT,
  MARQUISE_BOARD_LAYOUT,
  findBoardLayoutRegion,
  placeBoardImage,
  scaleBoardLayoutRegion,
  trackCellRegion,
  type BoardImagePlacement,
  type FactionBoardPixelLayout,
  type ScaledBoardRect,
} from '../assets/factionBoardLayout.ts'
import {
  eyrieLeaderTextureKey,
  lookupEyrieLeader,
} from '../assets/eyrieLeaderCatalog.ts'
import { GAME_ASSET_KEYS, lookupCardCatalog } from '../assets/gameAssets.ts'
import { gameViewSize } from '../game/hiDpi.ts'
import {
  formatDecreeSuitCounts,
  type FactionBoardViewModel,
} from './factionBoardViewModel.ts'

const MODAL_DEPTH = 360

/** Board fills most of the viewport; overlays use helper layout px. */
const BOARD_MAX_WIDTH_RATIO = 0.96
const BOARD_MAX_HEIGHT_RATIO = 0.94
const BOARD_TOP_RATIO = 0.02

/**
 * Steam-inspired faction board: board art + layout-baked tokens/supply/leader.
 */
export class FactionBoardModal {
  private readonly scene: Phaser.Scene
  private readonly root: Phaser.GameObjects.Container
  private contentNodes: Phaser.GameObjects.GameObject[] = []
  private visible = false
  private currentSeat: number | null = null
  private showGeneration = 0

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
    this.showGeneration += 1
    const generation = this.showGeneration

    const { width, height } = gameViewSize()
    const veil = this.scene.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 0.72)
      .setInteractive()
    veil.on('pointerdown', () => {
      this.hide()
    })

    const layout =
      view.kind === 'marquise' ? MARQUISE_BOARD_LAYOUT : EYRIE_BOARD_LAYOUT
    const placement = placeBoardImage({
      viewWidth: width,
      viewHeight: height,
      naturalWidth: layout.naturalWidth,
      naturalHeight: layout.naturalHeight,
      maxWidthRatio: BOARD_MAX_WIDTH_RATIO,
      maxHeightRatio: BOARD_MAX_HEIGHT_RATIO,
      topRatio: BOARD_TOP_RATIO,
    })

    const children: Phaser.GameObjects.GameObject[] = [veil]
    children.push(...this.buildBoardArt(view, placement))
    children.push(...this.buildLayoutOverlays(view, layout, placement))

    const closeButton = this.scene.add
      .text(width - 12, 10, '✕', {
        fontFamily: 'Georgia, serif',
        fontSize: '16px',
        color: '#1a1a1a',
        backgroundColor: '#f0e6d3',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true })
    closeButton.on('pointerdown', () => {
      this.hide()
    })
    children.push(closeButton)

    this.root.add(children)
    this.contentNodes = children

    if (view.kind === 'eyrie' && view.leader !== null) {
      void this.ensureLeaderTexture(view.leader.id).then(() => {
        if (generation !== this.showGeneration || !this.visible) {
          return
        }
        const leaderNodes = this.buildLeaderSlot(view, layout, placement)
        if (leaderNodes.length === 0) {
          return
        }
        this.root.add(leaderNodes)
        this.contentNodes = [...this.contentNodes, ...leaderNodes]
      })
    }
  }

  hide(): void {
    this.visible = false
    this.currentSeat = null
    this.showGeneration += 1
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

  private buildBoardArt(
    view: FactionBoardViewModel,
    placement: BoardImagePlacement,
  ): Phaser.GameObjects.GameObject[] {
    const centerX = placement.left + placement.displayWidth / 2
    if (this.scene.textures.exists(view.boardTextureKey)) {
      const boardImage = this.scene.add
        .image(centerX, placement.top, view.boardTextureKey)
        .setOrigin(0.5, 0)
      boardImage.setDisplaySize(placement.displayWidth, placement.displayHeight)
      return [boardImage]
    }
    const fallback = this.scene.add
      .rectangle(
        centerX,
        placement.top + placement.displayHeight / 2,
        placement.displayWidth,
        placement.displayHeight,
        view.kind === 'marquise' ? 0xb85a1a : 0x1a2a4a,
        0.95,
      )
      .setStrokeStyle(2, 0xf0e6d3, 0.7)
    return [fallback]
  }

  private buildLayoutOverlays(
    view: FactionBoardViewModel,
    layout: FactionBoardPixelLayout,
    placement: BoardImagePlacement,
  ): Phaser.GameObjects.GameObject[] {
    const nodes: Phaser.GameObjects.GameObject[] = []
    nodes.push(...this.buildCraftedRegion(view, layout, placement))
    nodes.push(...this.buildSupplyOverlays(view, layout, placement))

    if (view.kind === 'marquise') {
      nodes.push(
        ...this.buildMarquiseTrackTokens(view, layout, placement),
      )
      return nodes
    }

    nodes.push(...this.buildEyrieRoostTokens(view, layout, placement))
    nodes.push(...this.buildEyrieDecreeColumns(view, layout, placement))
    return nodes
  }

  private buildEyrieDecreeColumns(
    view: Extract<FactionBoardViewModel, { kind: 'eyrie' }>,
    layout: FactionBoardPixelLayout,
    placement: BoardImagePlacement,
  ): Phaser.GameObjects.GameObject[] {
    const nodes: Phaser.GameObjects.GameObject[] = []
    for (const column of view.decreeColumns) {
      const region = findBoardLayoutRegion(layout, column.regionId)
      if (region === null) {
        continue
      }
      const box = scaleBoardLayoutRegion(region, placement)
      const active = view.activeDecreeColumn === column.columnId
      const label = formatDecreeSuitCounts(column.suits)
      const text = this.scene.add
        .text(box.x + 8, box.y + box.height / 2, label, {
          fontFamily: 'monospace',
          fontSize: `${Math.max(11, Math.round(box.height * 0.38))}px`,
          color: active ? '#1a1408' : '#f7f0e4',
          backgroundColor: active ? '#ffe08add' : '#0a0a0acc',
          padding: { x: 8, y: 4 },
          wordWrap: { width: Math.max(40, box.width - 16) },
        })
        .setOrigin(0, 0.5)
      nodes.push(text)
    }
    return nodes
  }

  private buildCraftedRegion(
    view: FactionBoardViewModel,
    layout: FactionBoardPixelLayout,
    placement: BoardImagePlacement,
  ): Phaser.GameObjects.GameObject[] {
    const region = findBoardLayoutRegion(layout, 'crafted-items')
    if (region === null) {
      return []
    }
    const box = scaleBoardLayoutRegion(region, placement)
    const label = this.formatCrafted(view.crafted.cardNames, view.crafted.itemTypes)
    const text = this.scene.add
      .text(box.x + 6, box.y + 4, label, {
        fontFamily: 'monospace',
        fontSize: `${Math.max(11, Math.round(box.height * 0.28))}px`,
        color: '#f7f0e4',
        backgroundColor: '#0a0a0acc',
        padding: { x: 6, y: 4 },
        wordWrap: { width: Math.max(40, box.width - 12) },
      })
      .setOrigin(0, 0)
    return [text]
  }

  private buildSupplyOverlays(
    view: FactionBoardViewModel,
    layout: FactionBoardPixelLayout,
    placement: BoardImagePlacement,
  ): Phaser.GameObjects.GameObject[] {
    const nodes: Phaser.GameObjects.GameObject[] = []
    const warriorsRegion = findBoardLayoutRegion(layout, 'supply-warriors')
    if (warriorsRegion !== null) {
      nodes.push(
        ...this.buildSupplyCell(
          scaleBoardLayoutRegion(warriorsRegion, placement),
          String(view.warriors),
          view.kind === 'marquise'
            ? GAME_ASSET_KEYS.factionMarquise
            : GAME_ASSET_KEYS.factionEyrie,
        ),
      )
    }
    if (view.kind === 'marquise') {
      const woodRegion = findBoardLayoutRegion(layout, 'supply-wood')
      if (woodRegion !== null) {
        nodes.push(
          ...this.buildSupplyCell(
            scaleBoardLayoutRegion(woodRegion, placement),
            String(view.wood),
            GAME_ASSET_KEYS.tokenMarquiseWood,
          ),
        )
      }
    }
    return nodes
  }

  private buildSupplyCell(
    box: ScaledBoardRect,
    countLabel: string,
    textureKey: string,
  ): Phaser.GameObjects.GameObject[] {
    const nodes: Phaser.GameObjects.GameObject[] = []
    if (this.scene.textures.exists(textureKey)) {
      nodes.push(this.fitTokenInRegion(box, textureKey))
    }
    const badge = this.scene.add
      .text(box.x + box.width - 4, box.y + 2, countLabel, {
        fontFamily: 'monospace',
        fontSize: `${Math.max(14, Math.round(box.height * 0.28))}px`,
        color: '#1a1408',
        backgroundColor: '#f0e6d3ee',
        padding: { x: 6, y: 2 },
      })
      .setOrigin(1, 0)
    nodes.push(badge)
    return nodes
  }

  private buildMarquiseTrackTokens(
    view: Extract<FactionBoardViewModel, { kind: 'marquise' }>,
    layout: FactionBoardPixelLayout,
    placement: BoardImagePlacement,
  ): Phaser.GameObjects.GameObject[] {
    const rows: Array<{
      trackId: string
      emptied: number
      textureKey: string
    }> = [
      {
        trackId: 'sawmill',
        emptied: view.emptiedColumnCount.sawmill,
        textureKey: GAME_ASSET_KEYS.tokenMarquiseSawmill,
      },
      {
        trackId: 'workshop',
        emptied: view.emptiedColumnCount.workshop,
        textureKey: GAME_ASSET_KEYS.tokenMarquiseWorkshop,
      },
      {
        trackId: 'recruiter',
        emptied: view.emptiedColumnCount.recruiter,
        textureKey: GAME_ASSET_KEYS.tokenMarquiseRecruiter,
      },
    ]
    const nodes: Phaser.GameObjects.GameObject[] = []
    for (const row of rows) {
      nodes.push(
        ...this.buildRemainingTrackTokens({
          layout,
          placement,
          trackId: row.trackId,
          emptiedCount: row.emptied,
          textureKey: row.textureKey,
        }),
      )
    }
    return nodes
  }

  private buildEyrieRoostTokens(
    view: Extract<FactionBoardViewModel, { kind: 'eyrie' }>,
    layout: FactionBoardPixelLayout,
    placement: BoardImagePlacement,
  ): Phaser.GameObjects.GameObject[] {
    return this.buildRemainingTrackTokens({
      layout,
      placement,
      trackId: 'roost',
      emptiedCount: view.roostsOnMap,
      textureKey: GAME_ASSET_KEYS.tokenEyrieRoost,
    })
  }

  /**
   * Left slots emptied (on map); remaining pieces sit on right-hand cells.
   */
  private buildRemainingTrackTokens(options: {
    layout: FactionBoardPixelLayout
    placement: BoardImagePlacement
    trackId: string
    emptiedCount: number
    textureKey: string
  }): Phaser.GameObjects.GameObject[] {
    const track = options.layout.tracks.find(
      (entry) => entry.id === options.trackId,
    )
    if (track === undefined) {
      return []
    }
    if (!this.scene.textures.exists(options.textureKey)) {
      return []
    }
    const nodes: Phaser.GameObjects.GameObject[] = []
    for (let cellIndex = 0; cellIndex < track.cells; cellIndex += 1) {
      if (cellIndex < options.emptiedCount) {
        continue
      }
      const region = trackCellRegion(
        options.layout,
        options.trackId,
        cellIndex,
      )
      if (region === null) {
        continue
      }
      nodes.push(
        this.fitTokenInRegion(
          scaleBoardLayoutRegion(region, options.placement),
          options.textureKey,
        ),
      )
    }
    return nodes
  }

  /** Sprite top-left = region top-left; stretch to region width×height. */
  private fitTokenInRegion(
    box: ScaledBoardRect,
    textureKey: string,
  ): Phaser.GameObjects.Image {
    return this.scene.add
      .image(box.x, box.y, textureKey)
      .setOrigin(0, 0)
      .setDisplaySize(box.width, box.height)
  }

  private buildLeaderSlot(
    view: Extract<FactionBoardViewModel, { kind: 'eyrie' }>,
    layout: FactionBoardPixelLayout,
    placement: BoardImagePlacement,
  ): Phaser.GameObjects.GameObject[] {
    if (view.leader === null) {
      return []
    }
    const region = findBoardLayoutRegion(layout, 'leader-slot')
    if (region === null) {
      return []
    }
    const key = eyrieLeaderTextureKey(view.leader.id)
    if (!this.scene.textures.exists(key)) {
      return []
    }
    const box = scaleBoardLayoutRegion(region, placement)
    return [this.fitImageContain(box, key)]
  }

  /** Top-left anchored; uniform scale to fit inside the region. */
  private fitImageContain(
    box: ScaledBoardRect,
    textureKey: string,
  ): Phaser.GameObjects.Image {
    const image = this.scene.add.image(box.x, box.y, textureKey).setOrigin(0, 0)
    const source = image.texture.getSourceImage()
    const scale = Math.min(
      box.width / source.width,
      box.height / source.height,
    )
    image.setDisplaySize(source.width * scale, source.height * scale)
    return image
  }

  private ensureLeaderTexture(leaderId: string): Promise<void> {
    const info = lookupEyrieLeader(leaderId)
    if (info === null) {
      return Promise.resolve()
    }
    const key = eyrieLeaderTextureKey(leaderId)
    if (this.scene.textures.exists(key)) {
      return Promise.resolve()
    }
    this.scene.load.image(key, info.imagePath)
    return new Promise((resolve) => {
      this.scene.load.once('complete', () => {
        resolve()
      })
      if (!this.scene.load.isLoading()) {
        this.scene.load.start()
      }
    })
  }

  private formatCrafted(cardNames: string[], itemTypes: string[]): string {
    const cards =
      cardNames.length === 0
        ? '(none)'
        : cardNames
            .map((defId) => lookupCardCatalog(defId)?.name ?? defId)
            .join(', ')
    const items =
      itemTypes.length === 0 ? '(none)' : itemTypes.join(', ')
    return `Cards ${cards}\nItems ${items}`
  }
}
