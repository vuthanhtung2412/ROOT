import type { VagabondQuestView } from '#ui/factionBoardViewModel.ts'

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
  /** When true, cards are tappable; selection uses selectedCardIds. */
  selectable?: boolean
  selectedCardIds?: readonly string[]
}

export type CompletedQuestsModalContent = {
  seat: number
  faction: string
  quests: readonly VagabondQuestView[]
}
