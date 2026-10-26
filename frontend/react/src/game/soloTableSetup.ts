/**
 * Solo run lobby: the player's faction, the bots seated against it, and the
 * seat the shared faction track picks for. A bot replaces its faction
 * (Rootbotics 3.2): the two never sit at the same table.
 */
import { artFactionOf, type BotFactionId } from '@root/lib/bot-factions'
import type { MenuFactionChoice } from '#game/hudStore.ts'
import {
  MENU_BOT_FACTION_IDS,
  MENU_FACTION_IDS,
  type MenuFactionId,
} from '#game/menuPartySetup.ts'

export type SoloPlayerFactionId = (typeof MENU_FACTION_IDS)[number]

/** Seat the track picks for: the player, a seated bot, or the ＋ tile. */
export type SoloSlot =
  | { kind: 'player' }
  | { kind: 'bot'; botIndex: number }
  | { kind: 'newBot' }

export type SoloTable = {
  playerFaction: SoloPlayerFactionId
  bots: readonly BotFactionId[]
  selectedSlot: SoloSlot
}

/** A party needs one human and fits four seats. */
const MAX_TABLE_SEAT_COUNT = 4
const MIN_BOT_COUNT = 1
const DEFAULT_PLAYER_FACTION: SoloPlayerFactionId = 'alliance'
/** The first solo run: the Alliance against the cat and bird bots. */
const DEFAULT_SOLO_BOTS: readonly BotFactionId[] = ['mechanicalMarquise', 'electricEyrie']
const PLAYER_SLOT: SoloSlot = { kind: 'player' }

function isSoloPlayerFactionId(faction: string): faction is SoloPlayerFactionId {
  return MENU_FACTION_IDS.some((factionId: string): boolean => factionId === faction)
}

function isMenuBotFactionId(faction: string): faction is BotFactionId {
  return MENU_BOT_FACTION_IDS.some((factionId: string): boolean => factionId === faction)
}

/** Same pieces: a bot and the faction it replaces. */
function isSameFactionPieces(first: string, second: string): boolean {
  return artFactionOf(first) === artFactionOf(second)
}

export function defaultSoloTable(): SoloTable {
  return {
    playerFaction: DEFAULT_PLAYER_FACTION,
    bots: [...DEFAULT_SOLO_BOTS],
    selectedSlot: PLAYER_SLOT,
  }
}

/** Bot index the selected slot replaces; null on the player or ＋. */
function selectedBotIndex(table: SoloTable): number | null {
  return table.selectedSlot.kind === 'bot' ? table.selectedSlot.botIndex : null
}

function isPlayerFactionFree(table: SoloTable, faction: SoloPlayerFactionId): boolean {
  return !table.bots.some((bot: BotFactionId): boolean => isSameFactionPieces(bot, faction))
}

/** Free for the selected bot slot: not the player's pieces, not on another bot seat. */
function isBotFactionFree(table: SoloTable, faction: BotFactionId): boolean {
  if (isSameFactionPieces(faction, table.playerFaction)) return false
  const replacedIndex: number | null = selectedBotIndex(table)
  return !table.bots.some(
    (bot: BotFactionId, botIndex: number): boolean => bot === faction && botIndex !== replacedIndex,
  )
}

function isPickedOnSelectedSlot(table: SoloTable, faction: MenuFactionId): boolean {
  if (table.selectedSlot.kind === 'player') return faction === table.playerFaction
  const replacedIndex: number | null = selectedBotIndex(table)
  return replacedIndex !== null && table.bots[replacedIndex] === faction
}

function isPickableOnSelectedSlot(table: SoloTable, faction: MenuFactionId): boolean {
  if (table.selectedSlot.kind === 'player') {
    return isSoloPlayerFactionId(faction) && isPlayerFactionFree(table, faction)
  }
  return isMenuBotFactionId(faction) && isBotFactionFree(table, faction)
}

/** Factions of the selected side: the woodland ones for the player, the bots otherwise. */
function selectedSideFactions(table: SoloTable): readonly MenuFactionId[] {
  return table.selectedSlot.kind === 'player' ? MENU_FACTION_IDS : MENU_BOT_FACTION_IDS
}

/** The track for the selected slot: its side only, its faction picked, the ones it cannot take blocked. */
export function soloTrackChoices(table: SoloTable): MenuFactionChoice[] {
  return selectedSideFactions(table).map((faction: MenuFactionId): MenuFactionChoice => {
    if (isPickedOnSelectedSlot(table, faction)) return { faction, takenBy: 'you' }
    return { faction, takenBy: isPickableOnSelectedSlot(table, faction) ? null : 'other' }
  })
}

export function withSoloSlotSelected(table: SoloTable, slot: SoloSlot): SoloTable {
  return { ...table, selectedSlot: slot }
}

/** Track pick for the selected slot; a blocked faction leaves the table as is. */
export function withSoloFactionPicked(table: SoloTable, faction: string): SoloTable {
  const slot: SoloSlot = table.selectedSlot
  if (slot.kind === 'player') {
    if (!isSoloPlayerFactionId(faction) || !isPlayerFactionFree(table, faction)) return table
    return { ...table, playerFaction: faction }
  }
  if (!isMenuBotFactionId(faction) || !isBotFactionFree(table, faction)) return table
  if (slot.kind === 'newBot') {
    return {
      ...table,
      bots: [...table.bots, faction],
      selectedSlot: { kind: 'bot', botIndex: table.bots.length },
    }
  }
  return {
    ...table,
    bots: table.bots.map(
      (bot: BotFactionId, botIndex: number): BotFactionId =>
        botIndex === slot.botIndex ? faction : bot,
    ),
  }
}

export function canRemoveSoloBot(table: SoloTable): boolean {
  return table.bots.length > MIN_BOT_COUNT
}

/** Takes a bot off the table; the last bot stays. The track goes back to the player. */
export function withSoloBotRemoved(table: SoloTable, botIndex: number): SoloTable {
  if (!canRemoveSoloBot(table)) return table
  return {
    ...table,
    bots: table.bots.filter((_bot: BotFactionId, index: number): boolean => index !== botIndex),
    selectedSlot: PLAYER_SLOT,
  }
}

/** ＋ shows while a seat is left and some bot could still sit in it. */
export function canAddSoloBot(table: SoloTable): boolean {
  const seatedCount: number = table.bots.length + 1
  if (seatedCount >= MAX_TABLE_SEAT_COUNT) return false
  return MENU_BOT_FACTION_IDS.some(
    (bot: BotFactionId): boolean =>
      !table.bots.includes(bot) && !isSameFactionPieces(bot, table.playerFaction),
  )
}

/** Seats of the party: the player first, then the bots. */
export function soloPartyFactions(table: SoloTable): MenuFactionId[] {
  return [table.playerFaction, ...table.bots]
}
