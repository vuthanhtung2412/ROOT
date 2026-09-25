import { getHudSnapshot, patchHud, subscribeHud } from '#game/hudStore.ts'
import type {
  CardPileModalContent,
  CraftedCardsModalContent,
} from '#ui/cardGalleryTypes.ts'

export function subscribeCraftedCards(listener: () => void): () => void {
  return subscribeHud(listener)
}

export function getCraftedCardsSnapshot(): CraftedCardsModalContent | null {
  return getHudSnapshot().craftedCards
}

export function isCraftedCardsOpen(): boolean {
  return getHudSnapshot().craftedCards !== null
}

export function craftedCardsOpenSeat(): number | null {
  const content = getHudSnapshot().craftedCards
  if (content === null) {
    return null
  }
  return content.seat
}

export function showCraftedCards(content: CraftedCardsModalContent): void {
  patchHud({ craftedCards: content })
}

export function hideCraftedCards(): void {
  if (getHudSnapshot().craftedCards === null) {
    return
  }
  patchHud({ craftedCards: null })
}

export function subscribeCardPile(listener: () => void): () => void {
  return subscribeHud(listener)
}

export function getCardPileSnapshot(): CardPileModalContent | null {
  return getHudSnapshot().cardPile
}

export function isCardPileOpen(): boolean {
  return getHudSnapshot().cardPile !== null
}

export function showCardPile(content: CardPileModalContent): void {
  patchHud({ cardPile: content })
}

export function hideCardPile(): void {
  if (getHudSnapshot().cardPile === null) {
    return
  }
  patchHud({ cardPile: null })
}
