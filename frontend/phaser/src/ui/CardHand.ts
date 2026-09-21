import type Phaser from 'phaser'
import type { ActionSpec, GameState } from '../api/client.ts'
import { buildTurnBannerViewModel } from './TurnBanner.ts'
import {
  CardView,
  type CardHoldHandler,
  type CardSelectedHandler,
} from './CardView.ts'

export class CardHand {
  private readonly scene: Phaser.Scene
  private readonly root: Phaser.GameObjects.Container
  private cards: CardView[] = []
  private onCardSelected: CardSelectedHandler | null
  private onCardHold: CardHoldHandler | null
  private selectedCardIds: ReadonlySet<string> = new Set()
  private enabledCardIds: ReadonlySet<string> | null = null

  constructor(
    scene: Phaser.Scene,
    onCardSelected?: CardSelectedHandler,
    onCardHold?: CardHoldHandler,
  ) {
    this.scene = scene
    this.onCardSelected = onCardSelected ?? null
    this.onCardHold = onCardHold ?? null
    const { width, height } = scene.scale
    this.root = scene.add.container(width / 2, height - 70).setDepth(120)
  }

  setCardSelectedHandler(handler: CardSelectedHandler | null): void {
    this.onCardSelected = handler
  }

  setCardHoldHandler(handler: CardHoldHandler | null): void {
    this.onCardHold = handler
  }

  setSelection(selectedCardIds: readonly string[]): void {
    this.selectedCardIds = new Set(selectedCardIds)
    this.repaintSelection()
  }

  setEnabledCards(cardIds: readonly string[] | null): void {
    this.enabledCardIds = cardIds === null ? null : new Set(cardIds)
    this.repaintSelection()
  }

  sync(
    state: GameState,
    legalActions: readonly ActionSpec[] = [],
    localSeat: number | null = null,
  ): void {
    for (const card of this.cards) {
      card.destroy()
    }
    this.cards = []

    const seat =
      localSeat ??
      buildTurnBannerViewModel(state, legalActions).actorSeat
    const player = state.players.find((entry) => entry.seat === seat)
    const hand = player?.hand ?? []

    const startX = -((hand.length - 1) * 44)
    hand.forEach((card, index) => {
      const selected = this.selectedCardIds.has(card.id)
      const dimmed =
        this.enabledCardIds !== null && !this.enabledCardIds.has(card.id)
      const view = new CardView(
        this.scene,
        { id: card.id, defId: card.defId, selected, dimmed },
        this.onCardSelected,
        this.onCardHold,
      )
      view.setPosition(startX + index * 88, 0)
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
        defId: card.defId,
        selected,
        dimmed,
      })
    }
  }
}
