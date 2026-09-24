import type Phaser from 'phaser'
import {
  findBoardLayoutRegion,
  scaleBoardLayoutRegion,
  trackCellRegion,
  type BoardImagePlacement,
  type FactionBoardPixelLayout,
  type ScaledBoardRect,
} from '#assets/factionBoardLayout.ts'
import {
  eyrieLeaderTextureKey,
  lookupEyrieLeader,
} from '#assets/eyrieLeaderCatalog.ts'
import { GAME_ASSET_KEYS, itemTextureKey } from '#assets/gameAssets.ts'
import {
  formatDecreeSuitCounts,
  type CraftedItemView,
  type FactionBoardViewModel,
} from '#ui/factionBoardViewModel.ts'

type EyrieFactionBoardViewModel = Extract<
  FactionBoardViewModel,
  { kind: 'eyrie' }
>
type MarquiseFactionBoardViewModel = Extract<
  FactionBoardViewModel,
  { kind: 'marquise' }
>

interface RemainingTrackTokenOptions {
  layout: FactionBoardPixelLayout
  placement: BoardImagePlacement
  trackId: string
  emptiedCount: number
  textureKey: string
}

interface MarquiseTrackRow {
  trackId: string
  emptied: number
  textureKey: string
}

export class FactionBoardContentBuilder {
  private readonly scene: Phaser.Scene

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  buildBoardArt(
    view: FactionBoardViewModel,
    placement: BoardImagePlacement,
  ): Phaser.GameObjects.GameObject[] {
    const centerX: number = placement.left + placement.displayWidth / 2
    if (this.scene.textures.exists(view.boardTextureKey)) {
      const boardImage: Phaser.GameObjects.Image = this.scene.add
        .image(centerX, placement.top, view.boardTextureKey)
        .setOrigin(0.5, 0)
      boardImage.setDisplaySize(placement.displayWidth, placement.displayHeight)
      return [boardImage]
    }
    const fallback: Phaser.GameObjects.Rectangle = this.scene.add
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

  buildLayoutOverlays(
    view: FactionBoardViewModel,
    layout: FactionBoardPixelLayout,
    placement: BoardImagePlacement,
  ): Phaser.GameObjects.GameObject[] {
    const nodes: Phaser.GameObjects.GameObject[] = []
    nodes.push(...this.buildCraftedRegion(view, layout, placement))
    nodes.push(...this.buildSupplyOverlays(view, layout, placement))

    if (view.kind === 'marquise') {
      nodes.push(...this.buildMarquiseTrackTokens(view, layout, placement))
      return nodes
    }

    nodes.push(...this.buildEyrieRoostTokens(view, layout, placement))
    nodes.push(...this.buildEyrieDecreeColumns(view, layout, placement))
    return nodes
  }

  buildLeaderSlot(
    view: EyrieFactionBoardViewModel,
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
    const textureKey: string = eyrieLeaderTextureKey(view.leader.id)
    if (!this.scene.textures.exists(textureKey)) {
      return []
    }
    const box: ScaledBoardRect = scaleBoardLayoutRegion(region, placement)
    return [this.fitImageContain(box, textureKey)]
  }

  ensureLeaderTexture(leaderId: string): Promise<void> {
    const leaderInformation = lookupEyrieLeader(leaderId)
    if (leaderInformation === null) {
      return Promise.resolve()
    }
    const textureKey: string = eyrieLeaderTextureKey(leaderId)
    if (this.scene.textures.exists(textureKey)) {
      return Promise.resolve()
    }
    this.scene.load.image(textureKey, leaderInformation.imagePath)
    return new Promise((resolve: () => void): void => {
      this.scene.load.once('complete', (): void => {
        resolve()
      })
      if (!this.scene.load.isLoading()) {
        this.scene.load.start()
      }
    })
  }

  private buildEyrieDecreeColumns(
    view: EyrieFactionBoardViewModel,
    layout: FactionBoardPixelLayout,
    placement: BoardImagePlacement,
  ): Phaser.GameObjects.GameObject[] {
    const nodes: Phaser.GameObjects.GameObject[] = []
    for (const column of view.decreeColumns) {
      const region = findBoardLayoutRegion(layout, column.regionId)
      if (region === null) {
        continue
      }
      const box: ScaledBoardRect = scaleBoardLayoutRegion(region, placement)
      const active: boolean = view.activeDecreeColumn === column.columnId
      const label: string = formatDecreeSuitCounts(column.suits)
      const text: Phaser.GameObjects.Text = this.scene.add
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
    const box: ScaledBoardRect = scaleBoardLayoutRegion(region, placement)
    if (view.crafted.items.length === 0) {
      const emptyLabel: Phaser.GameObjects.Text = this.scene.add
        .text(box.x + 6, box.y + 4, 'Items (none)', {
          fontFamily: 'monospace',
          fontSize: `${Math.max(11, Math.round(box.height * 0.28))}px`,
          color: '#f7f0e4',
          backgroundColor: '#0a0a0acc',
          padding: { x: 6, y: 4 },
        })
        .setOrigin(0, 0)
      return [emptyLabel]
    }

    const nodes: Phaser.GameObjects.GameObject[] = []
    const iconSize: number = Math.max(
      18,
      Math.min(36, Math.round(box.height * 0.72)),
    )
    const gap: number = Math.max(4, Math.round(iconSize * 0.15))
    let cursorX: number = box.x + 6
    const iconY: number = box.y + box.height / 2

    for (const item of view.crafted.items) {
      const icon: Phaser.GameObjects.GameObject | null =
        this.buildCraftedItemIcon(item, cursorX, iconY, iconSize)
      if (icon === null) {
        continue
      }
      nodes.push(icon)
      cursorX += iconSize + gap
      if (cursorX + iconSize > box.x + box.width - 4) {
        break
      }
    }
    return nodes
  }

  private buildCraftedItemIcon(
    item: CraftedItemView,
    left: number,
    centerY: number,
    iconSize: number,
  ): Phaser.GameObjects.GameObject | null {
    const textureKey: string | null = itemTextureKey(item.type)
    const container: Phaser.GameObjects.Container = this.scene.add.container(
      left + iconSize / 2,
      centerY,
    )
    if (textureKey !== null && this.scene.textures.exists(textureKey)) {
      const image: Phaser.GameObjects.Image = this.scene.add
        .image(0, 0, textureKey)
        .setDisplaySize(iconSize, iconSize)
        .setOrigin(0.5)
      if (item.exhausted) {
        image.setAlpha(0.4)
      }
      container.add(image)
    } else {
      const fallback: Phaser.GameObjects.Text = this.scene.add
        .text(-iconSize / 2, 0, item.type, {
          fontFamily: 'monospace',
          fontSize: `${Math.max(10, Math.round(iconSize * 0.4))}px`,
          color: item.exhausted ? '#9a9080' : '#f7f0e4',
          backgroundColor: '#0a0a0acc',
          padding: { x: 4, y: 2 },
        })
        .setOrigin(0, 0.5)
      container.add(fallback)
    }
    if (item.count > 1) {
      const badge: Phaser.GameObjects.Text = this.scene.add
        .text(iconSize * 0.34, -iconSize * 0.34, String(item.count), {
          fontFamily: 'monospace',
          fontSize: `${Math.max(9, Math.round(iconSize * 0.32))}px`,
          color: '#1a1a1a',
          backgroundColor: '#f0e6d3',
          padding: { x: 3, y: 1 },
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
      container.add(badge)
    }
    return container
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
    const badge: Phaser.GameObjects.Text = this.scene.add
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
    view: MarquiseFactionBoardViewModel,
    layout: FactionBoardPixelLayout,
    placement: BoardImagePlacement,
  ): Phaser.GameObjects.GameObject[] {
    const rows: MarquiseTrackRow[] = [
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
    view: EyrieFactionBoardViewModel,
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

  private buildRemainingTrackTokens(
    options: RemainingTrackTokenOptions,
  ): Phaser.GameObjects.GameObject[] {
    const track = options.layout.tracks.find(
      (entry): boolean => entry.id === options.trackId,
    )
    if (
      track === undefined ||
      !this.scene.textures.exists(options.textureKey)
    ) {
      return []
    }
    const nodes: Phaser.GameObjects.GameObject[] = []
    for (let cellIndex: number = 0; cellIndex < track.cells; cellIndex += 1) {
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

  private fitTokenInRegion(
    box: ScaledBoardRect,
    textureKey: string,
  ): Phaser.GameObjects.Image {
    return this.scene.add
      .image(box.x, box.y, textureKey)
      .setOrigin(0, 0)
      .setDisplaySize(box.width, box.height)
  }

  private fitImageContain(
    box: ScaledBoardRect,
    textureKey: string,
  ): Phaser.GameObjects.Image {
    const image: Phaser.GameObjects.Image = this.scene.add
      .image(box.x, box.y, textureKey)
      .setOrigin(0, 0)
    const source:
      | HTMLCanvasElement
      | HTMLImageElement
      | Phaser.GameObjects.RenderTexture = image.texture.getSourceImage()
    const scale: number = Math.min(
      box.width / source.width,
      box.height / source.height,
    )
    image.setDisplaySize(source.width * scale, source.height * scale)
    return image
  }
}
