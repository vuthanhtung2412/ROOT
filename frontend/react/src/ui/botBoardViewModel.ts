import type { BotFactionId } from '@root/lib/bot-factions'
import {
  BOT_DIFFICULTY_CARDS,
  BOT_TRAIT_CARDS,
  DEFAULT_BOT_DIFFICULTY,
  type BotCardText,
  type BotSettingsByFaction,
  type BotTrait,
} from '@root/lib/bot-settings'
import {
  cardImagePublicPath,
  GAME_ASSET_KEYS,
  imagePathForAssetKey,
  lookupCardCatalog,
} from '#assets/gameAssets.ts'

/**
 * Rootbotics bot boards (Mechanical Marquise 2.0, Electric Eyrie): the
 * printed board with its pieces, plus the order card and the Decree.
 */

const VIZIER_DEFINITION_ID = 'VIZIER'
const VIZIER_CARD_NAME = 'Loyal Vizier'
const BIRD_SUIT = 'bird'
const UNKNOWN_SUIT = '?'
/** Rule: Rootbotics 5.4.3 / errata board — Decree columns left to right. */
const DECREE_COLUMN_SUITS: readonly string[] = ['fox', 'mouse', 'rabbit', 'bird']
const BUILDING_TRACKS: readonly string[] = ['sawmill', 'workshop', 'recruiter']

export type BotCardView = {
  cardId: string
  name: string
  suit: string
  /** Card face; null when the card has no art. */
  imagePath: string | null
  isLoyalVizier: boolean
}

/** Rootbotics 3.3 — the difficulty card and face-up trait cards by the board. */
export type BotSettingsView = {
  difficulty: BotCardText
  traits: BotCardText[]
}

type BotBoardBase = {
  seat: number
  factionName: string
  victoryPoints: number
  warriors: number
  orderCard: BotCardView | null
  craftedItems: string[]
  /** Scan of the printed bot board. */
  boardTextureKey: string
  settings: BotSettingsView
}

/** Difficulty and trait cards of a bot, with their text (absent = default, none). */
export function botSettingsView(
  faction: BotFactionId,
  settingsByFaction: BotSettingsByFaction | undefined,
): BotSettingsView {
  const settings = settingsByFaction?.[faction]
  return {
    difficulty: BOT_DIFFICULTY_CARDS[faction][settings?.difficulty ?? DEFAULT_BOT_DIFFICULTY],
    traits: (settings?.traits ?? []).map((trait: BotTrait): BotCardText => BOT_TRAIT_CARDS[trait]),
  }
}

export type MechanicalMarquiseBoardViewModel = BotBoardBase & {
  kind: 'mechanicalMarquise'
  tracks: Array<{ building: string; onTrack: number }>
}

/** Rule: Rootbotics 5.5.1 — the Decree column the bot resolves next, and how. */
export type ActiveDecreeColumn = {
  suit: string
  action: string
}

export type ElectricEyrieBoardViewModel = BotBoardBase & {
  kind: 'electricEyrie'
  decree: Array<{ suit: string; cards: BotCardView[] }>
  roostsOnTrack: number
  activeDecreeColumn: ActiveDecreeColumn | null
}

export type BotBoardViewModel =
  | MechanicalMarquiseBoardViewModel
  | ElectricEyrieBoardViewModel

type BotPlayer = {
  seat: number
  faction: string
  vp: number
  craftedItems?: Array<string | { type: string; exhausted?: boolean }>
  board?: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function numberField(record: Record<string, unknown>, field: string): number {
  const value = Reflect.get(record, field)
  return typeof value === 'number' ? value : 0
}

function cardView(value: unknown): BotCardView | null {
  if (!isRecord(value)) return null
  const cardId = Reflect.get(value, 'id')
  const defId = Reflect.get(value, 'defId')
  if (typeof cardId !== 'string' || typeof defId !== 'string') return null
  if (defId === VIZIER_DEFINITION_ID) {
    return {
      cardId,
      name: VIZIER_CARD_NAME,
      suit: BIRD_SUIT,
      imagePath: imagePathForAssetKey(GAME_ASSET_KEYS.cardLoyalVizier),
      isLoyalVizier: true,
    }
  }
  const entry = lookupCardCatalog(defId)
  return {
    cardId,
    name: entry?.name ?? defId,
    suit: entry?.suit ?? UNKNOWN_SUIT,
    imagePath: cardImagePublicPath(defId),
    isLoyalVizier: false,
  }
}

function cardViews(value: unknown): BotCardView[] {
  if (!Array.isArray(value)) return []
  return value
    .map(cardView)
    .filter((card: BotCardView | null): card is BotCardView => card !== null)
}

function craftedItemNames(player: BotPlayer): string[] {
  return (player.craftedItems ?? []).map(
    (item: string | { type: string; exhausted?: boolean }): string =>
      typeof item === 'string' ? item : item.type,
  )
}

function supplyWarriors(board: Record<string, unknown>): number {
  const supply = Reflect.get(board, 'supply')
  return isRecord(supply) ? numberField(supply, 'warriors') : 0
}

function trackCount(tracks: unknown, building: string): number {
  if (!isRecord(tracks)) return 0
  const track = Reflect.get(tracks, building)
  return isRecord(track) ? numberField(track, 'placed') : 0
}

/** Bot board panel of a seat; null for a faction that is not a bot. */
export function buildBotBoardViewModel(
  player: BotPlayer,
  settingsByFaction?: BotSettingsByFaction,
): BotBoardViewModel | null {
  const board = player.board
  if (!isRecord(board)) return null
  const base = {
    seat: player.seat,
    victoryPoints: player.vp,
    warriors: supplyWarriors(board),
    orderCard: cardView(Reflect.get(board, 'orderCard')),
    craftedItems: craftedItemNames(player),
  }
  const kind = Reflect.get(board, 'kind')
  if (kind === 'mechanicalMarquise') {
    const tracks = Reflect.get(board, 'tracks')
    return {
      ...base,
      kind,
      settings: botSettingsView(kind, settingsByFaction),
      factionName: 'Mechanical Marquise 2.0',
      boardTextureKey: GAME_ASSET_KEYS.characterBoardMechanicalMarquise,
      tracks: BUILDING_TRACKS.map((building: string) => ({
        building,
        onTrack: trackCount(tracks, building),
      })),
    }
  }
  if (kind === 'electricEyrie') {
    const decree = Reflect.get(board, 'decree')
    const roostTrack = Reflect.get(board, 'roostTrack')
    return {
      ...base,
      kind,
      settings: botSettingsView(kind, settingsByFaction),
      factionName: 'Electric Eyrie',
      boardTextureKey: GAME_ASSET_KEYS.characterBoardElectricEyrie,
      decree: DECREE_COLUMN_SUITS.map((suit: string) => ({
        suit,
        cards: isRecord(decree) ? cardViews(Reflect.get(decree, suit)) : [],
      })),
      roostsOnTrack: isRecord(roostTrack) ? numberField(roostTrack, 'placed') : 0,
      activeDecreeColumn: null,
    }
  }
  return null
}

/** Decree tasks of the Electric Eyrie plan, by the action shown on the board. */
const DECREE_TASK_ACTIONS: Readonly<Record<string, string>> = {
  decreeRecruit: 'Recruit',
  decreeMove: 'Move',
  decreeBattle: 'Battle',
}

/** The Decree column of the bot's next task (turn scratch `botPlan`); null outside the Decree. */
export function readActiveBotDecreeColumn(turnScratch: unknown): ActiveDecreeColumn | null {
  if (!isRecord(turnScratch)) return null
  const plan = Reflect.get(turnScratch, 'botPlan')
  if (!isRecord(plan)) return null
  const tasks = Reflect.get(plan, 'tasks')
  const nextTask: unknown = Array.isArray(tasks) ? tasks[0] : null
  if (!isRecord(nextTask)) return null
  const kind = Reflect.get(nextTask, 'kind')
  const column = Reflect.get(nextTask, 'column')
  const action: string | undefined = typeof kind === 'string' ? DECREE_TASK_ACTIONS[kind] : undefined
  if (action === undefined || typeof column !== 'string') return null
  return { suit: column, action }
}

export function isBotBoardViewModel(view: { kind: string }): view is BotBoardViewModel {
  return view.kind === 'mechanicalMarquise' || view.kind === 'electricEyrie'
}
