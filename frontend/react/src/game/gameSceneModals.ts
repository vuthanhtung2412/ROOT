import type { GameState } from '#api/client.ts'
import {
  completedQuestsOpenSeat,
  craftedCardsOpenSeat,
  getCardPileSnapshot,
  hideCardPile,
  hideCompletedQuests,
  hideCraftedCards,
  isCardPileOpen,
  isCompletedQuestsOpen,
  isCraftedCardsOpen,
  showCardPile,
  showCompletedQuests,
  showCraftedCards,
} from '#game/cardGalleryBridge.ts'
import {
  factionBoardOpenSeat,
  hideFactionBoard,
  isFactionBoardOpen,
  showFactionBoard,
} from '#game/factionBoardBridge.ts'
import type { CardGalleryFace } from '#ui/cardGalleryTypes.ts'
import {
  buildFactionBoardViewModel,
  completedQuestViewsFromBoard,
  hideSupportersFromOtherSeats,
} from '#ui/factionBoardViewModel.ts'

const SUPPORTERS_PILE_TITLE_PREFIX = 'Supporters ('
const VAGABOND_FACTION_ID = 'vagabond'
export const PUBLIC_HAND_FACTION_ID = 'riverfolk'
const PUBLIC_HAND_PILE_TITLE_PREFIX = 'Riverfolk hand ('
const LOST_SOULS_PILE_TITLE_PREFIX = 'Lost Souls ('

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

function lostSoulsFromDeck(deck: unknown): CardGalleryFace[] {
  if (typeof deck !== 'object' || deck === null) {
    return []
  }
  const lostSouls: unknown = Reflect.get(deck, 'lostSouls')
  return Array.isArray(lostSouls) ? lostSouls.filter(isCardGalleryFace) : []
}

/** Open / refresh faction board, crafted cards, and discard pile modals. */
export class GameSceneModals {
  /** Seat whose secrets this screen may show; null = nobody's. */
  private readonly getViewerSeat: () => number | null

  constructor(getViewerSeat: () => number | null) {
    this.getViewerSeat = getViewerSeat
  }

  openFactionBoard(state: GameState, seat: number): void {
    if (isFactionBoardOpen() === true && factionBoardOpenSeat() === seat) {
      hideFactionBoard()
      return
    }
    const view = buildFactionBoardViewModel(state, seat)
    if (view === null) {
      return
    }
    showFactionBoard(hideSupportersFromOtherSeats(view, this.getViewerSeat()))
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

  openCompletedQuests(state: GameState, seat: number): void {
    if (
      isCompletedQuestsOpen() === true &&
      completedQuestsOpenSeat() === seat
    ) {
      hideCompletedQuests()
      return
    }
    const player = state.players.find((entry) => entry.seat === seat)
    if (player === undefined) {
      return
    }
    if (player.faction !== VAGABOND_FACTION_ID) {
      return
    }
    showCompletedQuests({
      seat: player.seat,
      faction: player.faction,
      quests: completedQuestViewsFromBoard(player.board),
    })
  }

  openDiscardPile(state: GameState): void {
    if (isCardPileOpen() === true) {
      hideCardPile()
      return
    }
    const cards = state.deck?.discard ?? []
    showCardPile({
      title: `Discarded pile (${String(cards.length)})`,
      cards,
      emptyMessage: 'Discarded pile empty',
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
    // Rule: 8.2.3 — only the Alliance may inspect its supporters.
    if (seat !== this.getViewerSeat()) {
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

  /** Rule: 11.2.3 Public Hand — anyone may look at the Riverfolk hand. */
  openPublicHand(state: GameState, seat: number): void {
    const openPile = getCardPileSnapshot()
    if (
      openPile !== null &&
      openPile.title.startsWith(PUBLIC_HAND_PILE_TITLE_PREFIX)
    ) {
      hideCardPile()
      return
    }
    const player = state.players.find((entry) => entry.seat === seat)
    if (player === undefined || player.faction !== PUBLIC_HAND_FACTION_ID) {
      return
    }
    showCardPile({
      title: `${PUBLIC_HAND_PILE_TITLE_PREFIX}${String(player.hand.length)})`,
      cards: player.hand,
      emptyMessage: 'Riverfolk hand empty',
    })
  }

  /** Rule: 10.2.6 The Lost Souls Pile — a public pile, anyone may look. */
  openLostSouls(state: GameState): void {
    const openPile = getCardPileSnapshot()
    if (
      openPile !== null &&
      openPile.title.startsWith(LOST_SOULS_PILE_TITLE_PREFIX)
    ) {
      hideCardPile()
      return
    }
    const cards = lostSoulsFromDeck(state.deck)
    showCardPile({
      title: `${LOST_SOULS_PILE_TITLE_PREFIX}${String(cards.length)})`,
      cards,
      emptyMessage: 'Lost Souls empty',
    })
  }

  isAnyOpen(): boolean {
    return (
      isFactionBoardOpen() === true ||
      isCraftedCardsOpen() === true ||
      isCompletedQuestsOpen() === true ||
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
    showFactionBoard(hideSupportersFromOtherSeats(view, this.getViewerSeat()))
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

  refreshCompletedQuests(state: GameState | null | undefined): void {
    if (isCompletedQuestsOpen() !== true) {
      return
    }
    const seat = completedQuestsOpenSeat()
    if (seat === null) {
      return
    }
    if (state === null || state === undefined) {
      hideCompletedQuests()
      return
    }
    const player = state.players.find((entry) => entry.seat === seat)
    if (player === undefined || player.faction !== VAGABOND_FACTION_ID) {
      hideCompletedQuests()
      return
    }
    showCompletedQuests({
      seat: player.seat,
      faction: player.faction,
      quests: completedQuestViewsFromBoard(player.board),
    })
  }
}
