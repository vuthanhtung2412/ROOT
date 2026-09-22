import {
  EYRIE_ABILITIES,
  EYRIE_ROOST_TRACK,
  EYRIE_ROOST_TRACK_SLOT_COUNT,
  EYRIE_TURMOIL_CHEAT,
  EYRIE_TURN_CHEAT,
  lookupEyrieBoardLeader,
  type EyrieAbilityInfo,
  type EyrieLeaderInfo,
  type EyrieRoostTrackColumn,
} from '../assets/eyrieBoardCatalog.ts'
import { GAME_ASSET_KEYS } from '../assets/gameAssets.ts'
import {
  MARQUISE_ABILITIES,
  MARQUISE_BUILDING_TRACK,
  MARQUISE_TRACK_SLOT_COUNT,
  MARQUISE_TURN_CHEAT,
  type MarquiseAbilityInfo,
  type MarquiseTrackColumn,
} from '../assets/marquiseBoardCatalog.ts'
import type { GameState } from '../api/client.ts'

export type CraftedLookup = {
  cardNames: string[]
  itemTypes: string[]
}

export type MarquiseBoardViewModel = {
  kind: 'marquise'
  seat: number
  factionName: string
  victoryPoints: number
  warriors: number
  wood: number
  handSize: number
  crafted: CraftedLookup
  abilities: readonly MarquiseAbilityInfo[]
  turnCheat: readonly string[]
  trackColumns: readonly MarquiseTrackColumn[]
  /** Columns emptied left→right (building on map). */
  emptiedColumnCount: {
    sawmill: number
    workshop: number
    recruiter: number
  }
  boardTextureKey: string
}

export type EyrieBoardViewModel = {
  kind: 'eyrie'
  seat: number
  factionName: string
  victoryPoints: number
  warriors: number
  handSize: number
  crafted: CraftedLookup
  abilities: readonly EyrieAbilityInfo[]
  turnCheat: readonly string[]
  turmoilCheat: readonly string[]
  roostTrack: readonly EyrieRoostTrackColumn[]
  /** Roosts on map = emptied track slots from left. */
  roostsOnMap: number
  leader: EyrieLeaderInfo | null
  boardTextureKey: string
}

export type FactionBoardViewModel = MarquiseBoardViewModel | EyrieBoardViewModel

type MarquiseBoardData = {
  kind: 'marquise'
  supply: { warriors: number; wood: number }
  tracks: {
    sawmill: { placed: number }
    workshop: { placed: number }
    recruiter: { placed: number }
  }
}

type EyrieBoardData = {
  kind: 'eyrie'
  supply: { warriors: number }
  leader: string | null
  roostTrack: { placed: number }
}

type PlayerForBoard = {
  seat: number
  faction: string
  vp: number
  hand: Array<{ id: string; defId: string }>
  playArea?: Array<{ id: string; defId: string }>
  craftedItems?: string[]
  board?: unknown
}

function isMarquiseBoardData(value: unknown): value is MarquiseBoardData {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  return Reflect.get(value, 'kind') === 'marquise'
}

function isEyrieBoardData(value: unknown): value is EyrieBoardData {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  return Reflect.get(value, 'kind') === 'eyrie'
}

function emptiedBuildingColumns(placedOnTrack: number): number {
  const emptied = MARQUISE_TRACK_SLOT_COUNT - placedOnTrack
  if (emptied < 0) {
    return 0
  }
  if (emptied > MARQUISE_TRACK_SLOT_COUNT) {
    return MARQUISE_TRACK_SLOT_COUNT
  }
  return emptied
}

function roostsOnMapFromTrack(placedOnTrack: number): number {
  const roostsOnMap = EYRIE_ROOST_TRACK_SLOT_COUNT - placedOnTrack
  if (roostsOnMap < 0) {
    return 0
  }
  if (roostsOnMap > EYRIE_ROOST_TRACK_SLOT_COUNT) {
    return EYRIE_ROOST_TRACK_SLOT_COUNT
  }
  return roostsOnMap
}

function craftedLookup(player: PlayerForBoard): CraftedLookup {
  const playArea = player.playArea ?? []
  const craftedItems = player.craftedItems ?? []
  return {
    cardNames: playArea.map((card) => card.defId),
    itemTypes: [...craftedItems],
  }
}

export const CHARACTER_BOARD_TEXTURE_KEYS = {
  marquise: GAME_ASSET_KEYS.characterBoardMarquise,
  eyrie: GAME_ASSET_KEYS.characterBoardEyrie,
} as const

export function buildFactionBoardViewModel(
  state: GameState,
  seat: number,
): FactionBoardViewModel | null {
  const player = state.players.find((entry) => entry.seat === seat)
  if (player === undefined) {
    return null
  }
  return buildFactionBoardViewModelFromPlayer(player)
}

export function buildFactionBoardViewModelFromPlayer(
  player: PlayerForBoard,
): FactionBoardViewModel | null {
  if (player.faction === 'marquise' && isMarquiseBoardData(player.board)) {
    const board = player.board
    return {
      kind: 'marquise',
      seat: player.seat,
      factionName: 'Marquise de Cat',
      victoryPoints: player.vp,
      warriors: board.supply.warriors,
      wood: board.supply.wood,
      handSize: player.hand.length,
      crafted: craftedLookup(player),
      abilities: MARQUISE_ABILITIES,
      turnCheat: MARQUISE_TURN_CHEAT,
      trackColumns: MARQUISE_BUILDING_TRACK,
      emptiedColumnCount: {
        sawmill: emptiedBuildingColumns(board.tracks.sawmill.placed),
        workshop: emptiedBuildingColumns(board.tracks.workshop.placed),
        recruiter: emptiedBuildingColumns(board.tracks.recruiter.placed),
      },
      boardTextureKey: CHARACTER_BOARD_TEXTURE_KEYS.marquise,
    }
  }

  if (player.faction === 'eyrie' && isEyrieBoardData(player.board)) {
    const board = player.board
    const leader =
      board.leader === null ? null : lookupEyrieBoardLeader(board.leader)
    return {
      kind: 'eyrie',
      seat: player.seat,
      factionName: 'Eyrie Dynasties',
      victoryPoints: player.vp,
      warriors: board.supply.warriors,
      handSize: player.hand.length,
      crafted: craftedLookup(player),
      abilities: EYRIE_ABILITIES,
      turnCheat: EYRIE_TURN_CHEAT,
      turmoilCheat: EYRIE_TURMOIL_CHEAT,
      roostTrack: EYRIE_ROOST_TRACK,
      roostsOnMap: roostsOnMapFromTrack(board.roostTrack.placed),
      leader,
      boardTextureKey: CHARACTER_BOARD_TEXTURE_KEYS.eyrie,
    }
  }

  return null
}
