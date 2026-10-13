import {
  craftBenefitAvailable,
  defOf,
  unusedCraftingSuits,
  type ActionSpec,
  type Card,
  type CardDef,
  type CostSuit,
  type FactionId,
  type Game,
  type GameState,
  type PlayerState,
  type Suit,
} from '@root/lib'
import { listPlayerLegalActions } from '#view/playerView.js'
import {
  HIDDEN_CARD_DEFINITION_ID,
  redactStateForViewer,
} from '#view/redactStateForViewer.js'

const WILD_COST: CostSuit = 'wild'
const SUITS: readonly Suit[] = ['fox', 'rabbit', 'mouse']
const CRAFTABLE_CARD_TYPES: readonly CardDef['type'][] = [
  'item',
  'persistent',
  'partisan',
]
const CRAFT_ACTION_TYPES: readonly string[] = [
  'craft',
  'vbCraft',
  'riverfolkCraft',
]
/** Factions that pay a craft cost with crafting pieces on the map. */
const PIECE_CRAFTING_FACTIONS: readonly FactionId[] = [
  'marquise',
  'eyrie',
  'alliance',
  'lizard',
]
const ITEM_GONE_REASON = 'this item is no longer in the supply'
const ALREADY_IN_PLAY_REASON = 'a copy of this card is already crafted'

export type CardCraftDetail = {
  cost: CostSuit[]
  /** Item taken from the supply when crafted. */
  gives?: string
  victoryPoints?: number
  /** True when a craft action for this card is legal right now. */
  craftableNow: boolean
  /** Cost suits no unused crafting piece of yours covers. */
  missing?: CostSuit[]
  /** Unused crafting pieces per clearing suit. */
  yourCraftingPieces?: Record<Suit, number>
  /** Why crafting would give nothing, whatever the pieces. */
  blockedBecause?: string
}

export type CardDetail = {
  cardId: string
  name: string
  suit: string
  type: string
  description: string
  craft?: CardCraftDetail
  /** Action types that may take this card right now. */
  legalUsesNow: string[]
}

export type CardDetailLookup = {
  cards: CardDetail[]
  /** Requested ids that are not a card the seat can see. */
  unknownCardIds: string[]
}

function countSuits(suits: readonly Suit[]): Record<Suit, number> {
  const count = (suit: Suit): number =>
    suits.filter((candidate: Suit): boolean => candidate === suit).length
  return { fox: count('fox'), rabbit: count('rabbit'), mouse: count('mouse') }
}

/** Cost entries left unpaid after every unused crafting piece is activated. */
export function missingCraftCost(
  cost: readonly CostSuit[],
  craftingSuits: readonly Suit[],
): CostSuit[] {
  const available = countSuits(craftingSuits)
  const missing: CostSuit[] = []
  for (const suit of SUITS) {
    const needed = cost.filter(
      (entry: CostSuit): boolean => entry === suit,
    ).length
    const paid = Math.min(needed, available[suit])
    available[suit] -= paid
    missing.push(...Array<CostSuit>(needed - paid).fill(suit))
  }
  const sparePieces = SUITS.reduce(
    (total: number, suit: Suit): number => total + available[suit],
    0,
  )
  const wildNeeded = cost.filter(
    (entry: CostSuit): boolean => entry === WILD_COST,
  ).length
  const wildMissing = Math.max(0, wildNeeded - sparePieces)
  return [...missing, ...Array<CostSuit>(wildMissing).fill(WILD_COST)]
}

function specNamesCard(spec: ActionSpec, cardId: string): boolean {
  const params = spec.params
  if (params === undefined) return false
  const optionCardIds: string[] = (params.options ?? []).flatMap(
    (option: object): string[] =>
      'cardId' in option && typeof option.cardId === 'string'
        ? [option.cardId]
        : [],
  )
  return [
    ...(params.cardIds ?? []),
    ...(params.birdCardIds ?? []),
    ...optionCardIds,
  ].includes(cardId)
}

function blockedReason(state: GameState, card: Card): string | undefined {
  if (craftBenefitAvailable(state, card)) return undefined
  return defOf(card).type === 'item' ? ITEM_GONE_REASON : ALREADY_IN_PLAY_REASON
}

type CardDetailContext = {
  state: GameState
  viewer: PlayerState
  legalActions: readonly ActionSpec[]
}

function describeCraft(
  context: CardDetailContext,
  card: Card,
  legalUsesNow: readonly string[],
): CardCraftDetail {
  const definition = defOf(card)
  const { state, viewer } = context
  const blockedBecause = blockedReason(state, card)
  const craft: CardCraftDetail = {
    cost: definition.cost,
    ...(definition.item === undefined ? {} : { gives: `item:${definition.item}` }),
    ...(definition.vp === undefined ? {} : { victoryPoints: definition.vp }),
    craftableNow: legalUsesNow.some((type: string): boolean =>
      CRAFT_ACTION_TYPES.includes(type),
    ),
    ...(blockedBecause === undefined ? {} : { blockedBecause }),
  }
  if (!PIECE_CRAFTING_FACTIONS.includes(viewer.faction)) return craft
  const craftingSuits = unusedCraftingSuits(state, viewer.seat)
  return {
    ...craft,
    missing: missingCraftCost(definition.cost, craftingSuits),
    yourCraftingPieces: countSuits(craftingSuits),
  }
}

function describeCard(context: CardDetailContext, card: Card): CardDetail {
  const definition = defOf(card)
  const legalUsesNow = [
    ...new Set<string>(
      context.legalActions
        .filter((spec: ActionSpec): boolean => specNamesCard(spec, card.id))
        .map((spec: ActionSpec): string => spec.type),
    ),
  ]
  return {
    cardId: card.id,
    name: definition.name,
    suit: definition.suit,
    type: definition.type,
    description: definition.description,
    ...(CRAFTABLE_CARD_TYPES.includes(definition.type)
      ? { craft: describeCraft(context, card, legalUsesNow) }
      : {}),
    legalUsesNow,
  }
}

/** Every face-up card the seat can see: hands, crafted cards, Decree, discard. */
function visibleCards(state: GameState): Card[] {
  const playerCards = state.players.flatMap((player: PlayerState): Card[] => [
    ...player.hand,
    ...player.playArea,
    ...(player.board.kind === 'eyrie'
      ? Object.values(player.board.decree).flat()
      : []),
  ])
  return [...playerCards, ...state.deck.discard].filter(
    (card: Card): boolean => card.defId !== HIDDEN_CARD_DEFINITION_ID,
  )
}

/**
 * Cost, text and current use of cards the seat can see. No ids: its whole
 * hand. Returns null when `playerId` holds no seat.
 */
export function lookUpCardDetails(
  game: Game,
  playerId: string,
  cardIds: readonly string[],
): CardDetailLookup | null {
  const state = redactStateForViewer(game.state, playerId)
  const viewer = state.players.find(
    (player: PlayerState): boolean => player.playerId === playerId,
  )
  if (viewer === undefined) return null
  const context: CardDetailContext = {
    state,
    viewer,
    legalActions: listPlayerLegalActions(game, playerId),
  }
  const visible = visibleCards(state)
  const wanted: Card[] =
    cardIds.length === 0
      ? viewer.hand
      : visible.filter((card: Card): boolean => cardIds.includes(card.id))
  return {
    cards: wanted.map((card: Card): CardDetail => describeCard(context, card)),
    unknownCardIds: cardIds.filter(
      (cardId: string): boolean =>
        !visible.some((card: Card): boolean => card.id === cardId),
    ),
  }
}
