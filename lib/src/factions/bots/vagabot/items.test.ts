import { beforeEach, describe, expect, it } from 'vitest'
import { battleResolver, openBattle } from '#events/battle.js'
import { vagabotBoardOf } from '#factions/bots/botBoards.js'
import {
  attackerExtraHits,
  damageItems,
  exhaustItems,
  exhaustibleItemCount,
  maximumRolledHits,
  refreshItems,
  repairOneItem,
  syncBattleTrack,
} from '#factions/bots/vagabot/items.js'
import type { Piece, Seat } from '#pieces/types.js'
import { warriors } from '#queries/pieces.js'
import { resetPlaceIds } from '#rules/place.js'
import { removePieces } from '#rules/remove.js'
import { createVagabotBoard, type VagabotBoard, type VagabotItem } from '#state/botBoards.js'
import type { GameState } from '#state/types.js'
import { minimalState, player, testContext, withPieces } from '#test/fixtures.js'

const VAGABOT: Seat = 0
const MARQUISE: Seat = 1
const BATTLE_CLEARING = 4

function items(count: number, overrides: Partial<VagabotItem> = {}): VagabotItem[] {
  return Array.from({ length: count }, (): VagabotItem => ({
    type: 'boot',
    exhausted: false,
    damaged: false,
    onBattleTrack: false,
    ...overrides,
  }))
}

function boardWith(...groups: VagabotItem[][]): VagabotBoard {
  const board: VagabotBoard = { ...createVagabotBoard(), items: groups.flat() }
  syncBattleTrack(board)
  return board
}

function pawn(): Piece {
  return { id: `pawn-${VAGABOT}`, kind: 'pawn', owner: VAGABOT }
}

function cats(count: number): Piece[] {
  return Array.from({ length: count }, (_: unknown, index: number): Piece => ({
    id: `cat-${index}`,
    kind: 'warrior',
    owner: MARQUISE,
  }))
}

function vagabotState(board: VagabotBoard, pieces: Piece[]): GameState {
  return withPieces(
    minimalState({
      currentSeat: VAGABOT,
      factions: ['vagabot', 'marquise'],
      players: [player(VAGABOT, 'vagabot', { board }), player(MARQUISE, 'marquise')],
    }),
    BATTLE_CLEARING,
    pieces,
  )
}

beforeEach(() => {
  resetPlaceIds()
})

describe('Rootbotics 7.2.4 Battle Track', () => {
  it('maximum rolled hits start at one, +1 with six and nine undamaged items', () => {
    expect(maximumRolledHits(boardWith(items(5)))).toBe(1)
    expect(maximumRolledHits(boardWith(items(6)))).toBe(2)
    expect(maximumRolledHits(boardWith(items(9), items(3, { damaged: true })))).toBe(3)
    expect(attackerExtraHits(boardWith(items(11)))).toBe(0)
    expect(attackerExtraHits(boardWith(items(12)))).toBe(1)
  })

  it('track items cannot be exhausted; the track takes exhausted items first', () => {
    expect(exhaustibleItemCount(boardWith(items(6)))).toBe(5)
    expect(exhaustibleItemCount(boardWith(items(5), items(1, { exhausted: true })))).toBe(5)
    const board = boardWith(items(6))
    expect(exhaustItems(board, 6)).toBe(false)
    expect(exhaustItems(board, 5)).toBe(true)
    expect(exhaustibleItemCount(board)).toBe(0)
  })
})

describe('Rootbotics 7.2.5 Taking Hits', () => {
  it('damages exhausted items before face-up ones', () => {
    const board = boardWith(items(2), items(1, { exhausted: true }))
    expect(damageItems(board, 2)).toBe(2)
    expect(board.items).toEqual([
      { type: 'boot', exhausted: false, damaged: true, onBattleTrack: false },
      { type: 'boot', exhausted: false, damaged: false, onBattleTrack: false },
      { type: 'boot', exhausted: true, damaged: true, onBattleTrack: false },
    ])
  })

  it('repairs face-up damaged items first and keeps their side; refresh skips damaged', () => {
    const board = boardWith(items(1, { exhausted: true, damaged: true, onBattleTrack: false }), items(1, { damaged: true }))
    repairOneItem(board)
    expect(board.items[1]).toEqual({ type: 'boot', exhausted: false, damaged: false, onBattleTrack: false })
    repairOneItem(board)
    expect(board.items[0]).toEqual({ type: 'boot', exhausted: true, damaged: false, onBattleTrack: false })
    board.items.push(...items(1, { exhausted: true, damaged: true, onBattleTrack: false }))
    expect(refreshItems(board, 5)).toBe(1)
  })
})

describe('Vagabot in battle (Rootbotics 7.2)', () => {
  it('as defender its hits damage items and the pawn stays', () => {
    const state = vagabotState(boardWith(items(3)), [pawn(), ...cats(2)])
    state.currentSeat = MARQUISE
    openBattle(
      state,
      { clearing: BATTLE_CLEARING, attacker: MARQUISE, defender: VAGABOT },
      testContext({ state, dice: [2, 0] }),
    )
    expect(state.pending).toEqual([])
    const board = vagabotBoardOf(state, VAGABOT)
    expect(board.items.filter((item: VagabotItem): boolean => item.damaged)).toHaveLength(2)
    expect(state.clearings[BATTLE_CLEARING]!.pieces).toContainEqual(pawn())
  })

  it('as attacker it scores one point per warrior removed, hits capped by its maximum', () => {
    const state = vagabotState(boardWith(items(6)), [pawn(), ...cats(3)])
    const context = testContext({ state, dice: [3, 0] })
    openBattle(
      state,
      { clearing: BATTLE_CLEARING, attacker: VAGABOT, defender: MARQUISE },
      context,
    )
    const event = state.pending[0]
    if (event?.type !== 'battle') throw new Error('no battle')
    // Six items: maximum rolled hits 2 (a roll of 3 is capped).
    expect(event.hits.attacker).toBe(2)
    battleResolver.apply(
      state,
      { event, action: { type: 'resolveEvent', pieceIds: ['cat-0', 'cat-1'] }, actor: MARQUISE },
      context,
    )
    expect(warriors(state, BATTLE_CLEARING, MARQUISE)).toBe(1)
    expect(state.players[VAGABOT]!.vp).toBe(2)
  })

  it('7.2.1.I a full removal damages three items instead of removing the pawn', () => {
    const state = vagabotState(boardWith(items(4)), [pawn(), ...cats(1)])
    removePieces(
      state,
      { clearing: BATTLE_CLEARING, pieceIds: [pawn().id], scorer: MARQUISE },
      testContext({ state }),
    )
    const board = vagabotBoardOf(state, VAGABOT)
    expect(board.items.filter((item: VagabotItem): boolean => item.damaged)).toHaveLength(3)
    expect(state.clearings[BATTLE_CLEARING]!.pieces).toContainEqual(pawn())
  })
})
