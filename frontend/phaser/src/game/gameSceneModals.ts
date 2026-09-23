import type { GameState } from '#api/client.ts'
import type { CardTextureWarmup } from '#assets/cardTextureWarmup.ts'
import type { CardPileModal } from '#ui/CardPileModal.ts'
import type { CraftedCardsModal } from '#ui/CraftedCardsModal.ts'
import type { FactionBoardModal } from '#ui/FactionBoardModal.ts'
import { buildFactionBoardViewModel } from '#ui/factionBoardViewModel.ts'

export type GameSceneModalDeps = {
  getFactionBoardModal: () => FactionBoardModal | null
  getCraftedCardsModal: () => CraftedCardsModal | null
  getCardPileModal: () => CardPileModal | null
  getCardTextureWarmup: () => CardTextureWarmup | null
}

/** Open / refresh faction board, crafted cards, and discard pile modals. */
export class GameSceneModals {
  constructor(private readonly deps: GameSceneModalDeps) {}

  openFactionBoard(state: GameState, seat: number): void {
    const modal = this.deps.getFactionBoardModal()
    if (modal === null) {
      return
    }
    const openSeat = modal.openSeat()
    if (modal.isOpen() === true && openSeat === seat) {
      modal.hide()
      return
    }
    const view = buildFactionBoardViewModel(state, seat)
    if (view === null) {
      return
    }
    modal.show(view)
  }

  openCraftedCards(state: GameState, seat: number): void {
    const modal = this.deps.getCraftedCardsModal()
    if (modal === null) {
      return
    }
    const openSeat = modal.openSeat()
    if (modal.isOpen() === true && openSeat === seat) {
      modal.hide()
      return
    }
    const player = state.players.find((entry) => entry.seat === seat)
    if (player === undefined) {
      return
    }
    const cards = player.playArea ?? []
    this.deps.getCardTextureWarmup()?.ensure(cards.map((card) => card.defId))
    modal.show({
      seat: player.seat,
      faction: player.faction,
      cards,
    })
  }

  openDiscardPile(state: GameState): void {
    const modal = this.deps.getCardPileModal()
    if (modal === null) {
      return
    }
    if (modal.isOpen() === true) {
      modal.hide()
      return
    }
    const cards = state.deck?.discard ?? []
    this.deps.getCardTextureWarmup()?.ensure(cards.map((card) => card.defId))
    modal.show({
      title: `Discard pile (${String(cards.length)})`,
      cards,
      emptyMessage: 'Discard pile empty',
    })
  }

  refreshFactionBoard(state: GameState): void {
    const modal = this.deps.getFactionBoardModal()
    if (modal?.isOpen() !== true) {
      return
    }
    const seat = modal.openSeat()
    if (seat === null) {
      return
    }
    const view = buildFactionBoardViewModel(state, seat)
    if (view === null) {
      modal.hide()
      return
    }
    modal.show(view)
  }

  refreshCraftedCards(state: GameState | null | undefined): void {
    const modal = this.deps.getCraftedCardsModal()
    if (modal?.isOpen() !== true) {
      return
    }
    const seat = modal.openSeat()
    if (seat === null) {
      return
    }
    if (state === null || state === undefined) {
      modal.hide()
      return
    }
    const player = state.players.find((entry) => entry.seat === seat)
    if (player === undefined) {
      modal.hide()
      return
    }
    const cards = player.playArea ?? []
    this.deps.getCardTextureWarmup()?.ensure(cards.map((card) => card.defId))
    modal.show({
      seat: player.seat,
      faction: player.faction,
      cards,
    })
  }
}
