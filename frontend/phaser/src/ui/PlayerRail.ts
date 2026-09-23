import type Phaser from 'phaser'
import type { GameState } from '#api/client.ts'
import { GAME_ASSET_KEYS } from '#assets/gameAssets.ts'
import { factionColorForSeat } from '#game/theme.ts'

export type PlayerRailSeatHandler = (seat: number) => void

const ROW_WIDTH = 178
const ROW_HEIGHT = 64
const ROW_GAP = 72
const CRAFTED_CARDS_BUTTON_LABEL = 'cards'

export class PlayerRail {
  private readonly root: Phaser.GameObjects.Container
  private readonly scene: Phaser.Scene
  private readonly onSeatClick: PlayerRailSeatHandler | null
  private readonly onCraftedCardsClick: PlayerRailSeatHandler | null
  private rowNodes: Phaser.GameObjects.GameObject[] = []

  constructor(
    scene: Phaser.Scene,
    onSeatClick: PlayerRailSeatHandler | null = null,
    onCraftedCardsClick: PlayerRailSeatHandler | null = null,
  ) {
    this.scene = scene
    this.onSeatClick = onSeatClick
    this.onCraftedCardsClick = onCraftedCardsClick
    this.root = scene.add.container(12, 56).setDepth(100)
  }

  sync(state: GameState, activeSeat: number): void {
    for (const node of this.rowNodes) {
      node.destroy()
    }
    this.rowNodes = []

    state.players.forEach((player, index) => {
      const y = index * ROW_GAP
      const isActive = player.seat === activeSeat
      const color = factionColorForSeat(player.seat, state.factions)

      const background = this.scene.add
        .rectangle(0, y, ROW_WIDTH, ROW_HEIGHT, 0x111111, isActive ? 0.92 : 0.7)
        .setOrigin(0, 0)
        .setStrokeStyle(2, isActive ? 0xffe08a : color, isActive ? 1 : 0.6)

      if (this.onSeatClick !== null) {
        background.setInteractive({ useHandCursor: true })
        background.on('pointerdown', () => {
          this.onSeatClick?.(player.seat)
        })
      }

      const iconKey =
        player.faction === 'eyrie'
          ? GAME_ASSET_KEYS.factionEyrie
          : GAME_ASSET_KEYS.factionMarquise

      const icon = this.scene.add
        .image(12, y + 12, iconKey)
        .setOrigin(0, 0)
        .setDisplaySize(40, 40)

      const label = this.scene.add.text(
        60,
        y + 10,
        `${player.faction}\n${String(player.vp)} VP`,
        {
          fontFamily: 'monospace',
          fontSize: '13px',
          color: '#f0e6d3',
          lineSpacing: 4,
        },
      )

      const rowNodes: Phaser.GameObjects.GameObject[] = [
        background,
        icon,
        label,
      ]

      if (this.onCraftedCardsClick !== null) {
        const craftedCardsButton = this.scene.add
          .text(ROW_WIDTH - 8, y + ROW_HEIGHT - 12, CRAFTED_CARDS_BUTTON_LABEL, {
            fontFamily: 'monospace',
            fontSize: '11px',
            color: '#1a1a1a',
            backgroundColor: '#f0e6d3',
            padding: { x: 6, y: 3 },
          })
          .setOrigin(1, 1)
          .setInteractive({ useHandCursor: true })
        craftedCardsButton.on('pointerdown', () => {
          this.onCraftedCardsClick?.(player.seat)
        })
        rowNodes.push(craftedCardsButton)
      }

      this.root.add(rowNodes)
      this.rowNodes.push(...rowNodes)
    })
  }

  destroy(): void {
    this.root.destroy(true)
  }
}
