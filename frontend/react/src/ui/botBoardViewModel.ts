import type { BotFactionId } from '@root/lib/bot-factions'
import {
  BOT_DIFFICULTY_CARDS,
  BOT_TRAIT_CARDS,
  DEFAULT_BOT_DIFFICULTY,
  DEFAULT_VAGABOT_CHARACTER,
  VAGABOT_CHARACTER_CARDS,
  isVagabotCharacter,
  type BotCardText,
  type BotSettingsByFaction,
  type BotTrait,
  type VagabotCharacter,
} from '@root/lib/bot-settings'
import { QUEST_DEFS } from '@root/lib/quests'
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
/** Rootbotics 7.3.1 — the printed Vagabot character card of each character. */
const VAGABOT_CHARACTER_CARD_ASSET_KEYS: Readonly<Record<VagabotCharacter, string>> = {
  thief: GAME_ASSET_KEYS.characterCardVagabotThief,
  tinker: GAME_ASSET_KEYS.characterCardVagabotTinker,
  ranger: GAME_ASSET_KEYS.characterCardVagabotRanger,
}
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

export type AutomatedAllianceBoardViewModel = BotBoardBase & {
  kind: 'automatedAlliance'
  /** Sympathy tokens still on the track (they fill it from the right). */
  sympathyOnTrack: number
  /** Suits whose base is still in the Bases box. */
  basesOnBoard: string[]
}

/** Rootbotics 7.2.3 — one Vagabot item: face up or exhausted. */
export type VagabotItemView = {
  type: string
  exhausted: boolean
}

export type VagabotBoardViewModel = BotBoardBase & {
  kind: 'vagabot'
  character: BotCardText & { cardAssetKey: string }
  satchel: VagabotItemView[]
  battleTrack: VagabotItemView[]
  damaged: VagabotItemView[]
  /** Name and suit of the Vagabot's quest; null when the deck ran out. */
  quest: { name: string; suit: string } | null
}

export type BotBoardViewModel =
  | MechanicalMarquiseBoardViewModel
  | ElectricEyrieBoardViewModel
  | AutomatedAllianceBoardViewModel
  | VagabotBoardViewModel

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
  if (kind === 'automatedAlliance') {
    const sympathyTrack = Reflect.get(board, 'sympathyTrack')
    return {
      ...base,
      kind,
      settings: botSettingsView(kind, settingsByFaction),
      factionName: 'Automated Alliance',
      boardTextureKey: GAME_ASSET_KEYS.characterBoardAutomatedAlliance,
      sympathyOnTrack: isRecord(sympathyTrack) ? numberField(sympathyTrack, 'placed') : 0,
      basesOnBoard: stringList(Reflect.get(board, 'bases')),
    }
  }
  if (kind === 'vagabot') {
    return buildVagabotBoardViewModel({ base, board, settingsByFaction })
  }
  return null
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry: unknown): entry is string => typeof entry === 'string')
}

type VagabotItemRecord = VagabotItemView & { damaged: boolean; onBattleTrack: boolean }

function vagabotItems(value: unknown): VagabotItemRecord[] {
  if (!Array.isArray(value)) return []
  return value.filter(isRecord).map(
    (item: Record<string, unknown>): VagabotItemRecord => ({
      type: typeof item.type === 'string' ? item.type : UNKNOWN_SUIT,
      exhausted: item.exhausted === true,
      damaged: item.damaged === true,
      onBattleTrack: item.onBattleTrack === true,
    }),
  )
}

function itemView(item: VagabotItemRecord): VagabotItemView {
  return { type: item.type, exhausted: item.exhausted }
}

function questView(value: unknown): { name: string; suit: string } | null {
  if (!isRecord(value)) return null
  const defId = Reflect.get(value, 'defId')
  if (typeof defId !== 'string') return null
  const definition = QUEST_DEFS.find((entry): boolean => entry.defId === defId)
  return definition === undefined ? null : { name: definition.name, suit: definition.suit }
}

/** Rootbotics 7 — Satchel, Battle Track, Damaged box, character and quest. */
function buildVagabotBoardViewModel(input: {
  base: Omit<BotBoardBase, 'factionName' | 'boardTextureKey' | 'settings'>
  board: Record<string, unknown>
  settingsByFaction: BotSettingsByFaction | undefined
}): VagabotBoardViewModel {
  const { base, board } = input
  const items = vagabotItems(Reflect.get(board, 'items'))
  const characterField = Reflect.get(board, 'character')
  const character: VagabotCharacter =
    typeof characterField === 'string' && isVagabotCharacter(characterField)
      ? characterField
      : DEFAULT_VAGABOT_CHARACTER
  return {
    ...base,
    kind: 'vagabot',
    settings: botSettingsView('vagabot', input.settingsByFaction),
    factionName: 'Vagabot',
    boardTextureKey: GAME_ASSET_KEYS.characterBoardVagabot,
    character: {
      ...VAGABOT_CHARACTER_CARDS[character],
      cardAssetKey: VAGABOT_CHARACTER_CARD_ASSET_KEYS[character],
    },
    satchel: items
      .filter((item: VagabotItemRecord): boolean => !item.damaged && !item.onBattleTrack)
      .map(itemView),
    battleTrack: items.filter((item: VagabotItemRecord): boolean => item.onBattleTrack).map(itemView),
    damaged: items
      .filter((item: VagabotItemRecord): boolean => item.damaged && !item.onBattleTrack)
      .map(itemView),
    quest: questView(Reflect.get(board, 'quest')),
  }
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

const BOT_BOARD_KINDS: readonly string[] = [
  'mechanicalMarquise',
  'electricEyrie',
  'automatedAlliance',
  'vagabot',
]

export function isBotBoardViewModel(view: { kind: string }): view is BotBoardViewModel {
  return BOT_BOARD_KINDS.includes(view.kind)
}
