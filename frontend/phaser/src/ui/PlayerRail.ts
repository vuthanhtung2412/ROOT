import type Phaser from 'phaser'
import type { GameState } from '#api/client.ts'
import { GAME_ASSET_KEYS } from '#assets/gameAssets.ts'
import { factionColorForSeat } from '#game/theme.ts'

export type PlayerRailSeatHandler = (seat: number) => void

export class PlayerRail {
  private readonly root: Phaser.GameObjects.Container
  private readonly scene: Phaser.Scene
  private readonly onSeatClick: PlayerRailSeatHandler | null
  private rowNodes: Phaser.GameObjects.GameObject[] = []

  constructor(scene: Phaser.Scene, onSeatClick: PlayerRailSeatHandler | null = null) {
    this.scene = scene
    this.onSeatClick = onSeatClick
    this.root = scene.add.container(12, 56).setDepth(100)
  }

  sync(state: GameState, activeSeat: number): void {
    for (const node of this.rowNodes) {
      node.destroy()
    }
    this.rowNodes = []

    state.players.forEach((player, index) => {
      const y = index * 72
      const isActive = player.seat === activeSeat
      const color = factionColorForSeat(player.seat, state.factions)

      const background = this.scene.add
        .rectangle(0, y, 150, 64, 0x111111, isActive ? 0.92 : 0.7)
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

      this.root.add([background, icon, label])
      this.rowNodes.push(background, icon, label)
    })
  }

  destroy(): void {
    this.root.destroy(true)
  }
}
