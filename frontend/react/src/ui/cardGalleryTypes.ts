export type CardGalleryFace = {
  id: string
  defId: string
}

export type CraftedCardsModalContent = {
  seat: number
  faction: string
  cards: readonly CardGalleryFace[]
}

export type CardPileModalContent = {
  title: string
  cards: readonly CardGalleryFace[]
  emptyMessage?: string
}
