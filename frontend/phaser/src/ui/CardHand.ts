import type Phaser from 'phaser'
import type { GameState } from '../api/client.ts'
import { buildTurnBannerViewModel } from './TurnBanner.ts'
import { CardView, type CardSelectedHandler } from './CardView.ts'

export class CardHand {
  private readonly scene: Phaser.Scene
  private readonly root: Phaser.GameObjects.Container
  private cards: CardView[] = []
  private onCardSelected: CardSelectedHandler | null
  private selectedCardIds: ReadonlySet<string> = new Set()
  private enabledCardIds: ReadonlySet<string> | null = null

  constructor(scene: Phaser.Scene, onCardSelected?: CardSelectedHandler) {
    this.scene = scene
    this.onCardSelected = onCardSelected ?? null
    const { width, height } = scene.scale
    this.root = scene.add.container(width / 2, height - 70).setDepth(120)
  }

  setCardSelectedHandler(handler: CardSelectedHandler | null): void {
    this.onCardSelected = handler
  }

  setSelection(selectedCardIds: readonly string[]): void {
    this.selectedCardIds = new Set(selectedCardIds)
    this.repaintSelection()
  }

  setEnabledCards(cardIds: readonly string[] | null): void {
    this.enabledCardIds = cardIds === null ? null : new Set(cardIds)
    this.repaintSelection()
  }

  sync(state: GameState): void {
    for (const card of this.cards) {
      card.destroy()
    }
    this.cards = []

    const banner = buildTurnBannerViewModel(state)
    const actor = state.players.find((player) => player.seat === banner.actorSeat)
    const hand = actor?.hand ?? []

    const startX = -((hand.length - 1) * 40)
    hand.forEach((card, index) => {
      const selected = this.selectedCardIds.has(card.id)
      const dimmed =
        this.enabledCardIds !== null && !this.enabledCardIds.has(card.id)
      const view = new CardView(
        this.scene,
        { id: card.id, defId: card.defId, selected, dimmed },
        this.onCardSelected,
      )
      view.setPosition(startX + index * 80, 0)
      this.root.add(view.container)
      this.cards.push(view)
    })
  }

  destroy(): void {
    this.root.destroy(true)
  }

  private repaintSelection(): void {
    for (const card of this.cards) {
      const selected = this.selectedCardIds.has(card.cardId)
      const dimmed =
        this.enabledCardIds !== null && !this.enabledCardIds.has(card.cardId)
      card.sync({
        id: card.cardId,
        defId: '',
        selected,
        dimmed,
      })
    }
  }
}
