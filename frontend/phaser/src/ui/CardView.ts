import type Phaser from 'phaser'
import cardSuits from '../assets/cardSuits.json'

export type CardViewModel = {
  id: string
  defId: string
  selected: boolean
  dimmed: boolean
}

export type CardSelectedHandler = (cardId: string) => void

const SUIT_COLORS: Record<string, number> = {
  fox: 0xc45c26,
  mouse: 0xb8a078,
  rabbit: 0xd4c46a,
  bird: 0x3a5f8a,
}

function suitForDefId(defId: string): string {
  const suits = cardSuits as Record<string, string>
  return suits[defId] ?? 'bird'
}

export class CardView {
  readonly container: Phaser.GameObjects.Container
  readonly cardId: string
  private readonly background: Phaser.GameObjects.Rectangle
  private readonly label: Phaser.GameObjects.Text

  constructor(
    scene: Phaser.Scene,
    viewModel: CardViewModel,
    onSelected: CardSelectedHandler | null,
  ) {
    this.cardId = viewModel.id
    const suit = suitForDefId(viewModel.defId)
    const color = SUIT_COLORS[suit] ?? 0x666666

    this.background = scene.add
      .rectangle(0, 0, 72, 100, color, 1)
      .setStrokeStyle(2, viewModel.selected ? 0xffe08a : 0xf0e6d3, 1)

    this.label = scene.add
      .text(0, 0, viewModel.defId.replace('ROOT-', ''), {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: 64 },
      })
      .setOrigin(0.5)

    this.container = scene.add.container(0, 0, [this.background, this.label])
    this.container.setSize(72, 100)
    this.container.setAlpha(viewModel.dimmed ? 0.45 : 1)

    if (onSelected !== null) {
      this.background.setInteractive({ useHandCursor: true })
      this.background.on('pointerdown', () => {
        onSelected(viewModel.id)
      })
    }
  }

  setPosition(x: number, y: number): void {
    this.container.setPosition(x, y)
  }

  sync(viewModel: CardViewModel): void {
    this.background.setStrokeStyle(
      2,
      viewModel.selected ? 0xffe08a : 0xf0e6d3,
      1,
    )
    this.container.setAlpha(viewModel.dimmed ? 0.45 : 1)
  }

  destroy(): void {
    this.container.destroy(true)
  }
}
