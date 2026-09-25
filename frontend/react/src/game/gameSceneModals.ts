import type { GameState } from '#api/client.ts'
import {
  craftedCardsOpenSeat,
  getCardPileSnapshot,
  hideCardPile,
  hideCraftedCards,
  isCardPileOpen,
  isCraftedCardsOpen,
  showCardPile,
  showCraftedCards,
} from '#game/cardGalleryBridge.ts'
import type { CardGalleryFace } from '#ui/cardGalleryTypes.ts'

const SUPPORTERS_PILE_TITLE_PREFIX = 'Supporters ('

function isCardGalleryFace(value: unknown): value is CardGalleryFace {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const id = Reflect.get(value, 'id')
  const defId = Reflect.get(value, 'defId')
  return typeof id === 'string' && typeof defId === 'string'
}

function allianceSupportersFromBoard(board: unknown): CardGalleryFace[] | null {
  if (typeof board !== 'object' || board === null) {
    return null
  }
  if (Reflect.get(board, 'kind') !== 'alliance') {
    return null
  }
  const supporters = Reflect.get(board, 'supporters')
  if (!Array.isArray(supporters)) {
    return null
  }
  const faces: CardGalleryFace[] = []
  for (const entry of supporters) {
    if (!isCardGalleryFace(entry)) {
      return null
    }
    faces.push(entry)
  }
  return faces
}
import {
  factionBoardOpenSeat,
  hideFactionBoard,
  isFactionBoardOpen,
  showFactionBoard,
} from '#game/factionBoardBridge.ts'
import { buildFactionBoardViewModel } from '#ui/factionBoardViewModel.ts'

/** Open / refresh faction board, crafted cards, and discard pile modals. */
export class GameSceneModals {
  openFactionBoard(state: GameState, seat: number): void {
    if (isFactionBoardOpen() === true && factionBoardOpenSeat() === seat) {
      hideFactionBoard()
      return
    }
    const view = buildFactionBoardViewModel(state, seat)
    if (view === null) {
      return
    }
    showFactionBoard(view)
  }

  openCraftedCards(state: GameState, seat: number): void {
    if (isCraftedCardsOpen() === true && craftedCardsOpenSeat() === seat) {
      hideCraftedCards()
      return
    }
    const player = state.players.find((entry) => entry.seat === seat)
    if (player === undefined) {
      return
    }
    const cards = player.playArea ?? []
    showCraftedCards({
      seat: player.seat,
      faction: player.faction,
      cards,
    })
  }

  openDiscardPile(state: GameState): void {
    if (isCardPileOpen() === true) {
      hideCardPile()
      return
    }
    const cards = state.deck?.discard ?? []
    showCardPile({
      title: `Discard pile (${String(cards.length)})`,
      cards,
      emptyMessage: 'Discard pile empty',
    })
  }

  openSupporters(state: GameState, seat: number): void {
    const openPile = getCardPileSnapshot()
    if (
      openPile !== null &&
      openPile.title.startsWith(SUPPORTERS_PILE_TITLE_PREFIX)
    ) {
      hideCardPile()
      return
    }
    const player = state.players.find((entry) => entry.seat === seat)
    if (player === undefined) {
      return
    }
    const cards = allianceSupportersFromBoard(player.board)
    if (cards === null) {
      return
    }
    showCardPile({
      title: `${SUPPORTERS_PILE_TITLE_PREFIX}${String(cards.length)})`,
      cards,
      emptyMessage: 'No supporters',
    })
  }

  isAnyOpen(): boolean {
    return (
      isFactionBoardOpen() === true ||
      isCraftedCardsOpen() === true ||
      isCardPileOpen() === true
    )
  }

  refreshFactionBoard(state: GameState): void {
    if (isFactionBoardOpen() !== true) {
      return
    }
    const seat = factionBoardOpenSeat()
    if (seat === null) {
      return
    }
    const view = buildFactionBoardViewModel(state, seat)
    if (view === null) {
      hideFactionBoard()
      return
    }
    showFactionBoard(view)
  }

  refreshCraftedCards(state: GameState | null | undefined): void {
    if (isCraftedCardsOpen() !== true) {
      return
    }
    const seat = craftedCardsOpenSeat()
    if (seat === null) {
      return
    }
    if (state === null || state === undefined) {
      hideCraftedCards()
      return
    }
    const player = state.players.find((entry) => entry.seat === seat)
    if (player === undefined) {
      hideCraftedCards()
      return
    }
    const cards = player.playArea ?? []
    showCraftedCards({
      seat: player.seat,
      faction: player.faction,
      cards,
    })
  }
}
