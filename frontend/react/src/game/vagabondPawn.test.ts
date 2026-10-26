import { describe, expect, it } from 'vitest'
import {
  GAME_ASSET_KEYS,
  pieceTokenTextureKey,
  vagabondPawnTextureKey,
} from '#assets/gameAssets.ts'
import {
  forestPawnsFromPlayers,
  stampPawnCharacters,
} from '#game/vagabondPawn.ts'
import type { BoardClearingPieces } from '#react/PieceStack.tsx'

const VAGABOND_SEAT = 1

function makeVagabondPlayer(
  character: string | undefined,
  forest: number | null,
): { seat: number; faction: string; board: unknown } {
  return {
    seat: VAGABOND_SEAT,
    faction: 'vagabond',
    board: {
      kind: 'vagabond',
      forest,
      ...(character === undefined ? {} : { character }),
    },
  }
}

const MARQUISE_PLAYER = {
  seat: 0,
  faction: 'marquise',
  board: { kind: 'marquise' },
}

describe('vagabondPawnTextureKey', () => {
  it('picks the meeple of the character, Thief by default', () => {
    expect(vagabondPawnTextureKey('thief')).toBe(
      GAME_ASSET_KEYS.tokenVagabondPawn,
    )
    expect(vagabondPawnTextureKey('tinker')).toBe(
      GAME_ASSET_KEYS.tokenVagabondPawnTinker,
    )
    expect(vagabondPawnTextureKey('ranger')).toBe(
      GAME_ASSET_KEYS.tokenVagabondPawnRanger,
    )
    expect(vagabondPawnTextureKey(null)).toBe(GAME_ASSET_KEYS.tokenVagabondPawn)
  })
})

describe('stampPawnCharacters', () => {
  it('draws the pawn on a clearing with its character meeple', () => {
    const clearings: BoardClearingPieces[] = [
      {
        pieces: [
          { id: 'pawn-1', kind: 'pawn', owner: VAGABOND_SEAT },
          { id: 'w-0', kind: 'warrior', owner: 0 },
        ],
      },
    ]

    const stamped = stampPawnCharacters(clearings, [
      MARQUISE_PLAYER,
      makeVagabondPlayer('ranger', null),
    ])

    const pawn = stamped[0]?.pieces[0]
    expect(pawn).toEqual({
      id: 'pawn-1',
      kind: 'pawn',
      owner: VAGABOND_SEAT,
      type: 'ranger',
    })
    expect(pieceTokenTextureKey('pawn', pawn?.type)).toBe(
      GAME_ASSET_KEYS.tokenVagabondPawnRanger,
    )
    expect(stamped[0]?.pieces[1]).toEqual({
      id: 'w-0',
      kind: 'warrior',
      owner: 0,
    })
  })

  it('leaves the pawn untyped (Thief art) on a board without a character', () => {
    const clearings: BoardClearingPieces[] = [
      { pieces: [{ id: 'pawn-1', kind: 'pawn', owner: VAGABOND_SEAT }] },
    ]

    const stamped = stampPawnCharacters(clearings, [
      makeVagabondPlayer(undefined, null),
    ])

    expect(stamped[0]?.pieces[0]?.type).toBeUndefined()
  })
})

describe('forestPawnsFromPlayers', () => {
  it('marks the forest pawn with its character', () => {
    expect(
      forestPawnsFromPlayers([
        MARQUISE_PLAYER,
        makeVagabondPlayer('tinker', 4),
      ]),
    ).toEqual([
      {
        forestIndex: 4,
        seat: VAGABOND_SEAT,
        factionId: 'vagabond',
        character: 'tinker',
      },
    ])
  })

  it('marks the Vagabot pawn in a forest too (Rootbotics 7)', () => {
    const vagabot = {
      seat: VAGABOND_SEAT,
      faction: 'vagabot',
      board: { kind: 'vagabot', forest: 2, character: 'ranger' },
    }
    expect(forestPawnsFromPlayers([MARQUISE_PLAYER, vagabot])).toEqual([
      { forestIndex: 2, seat: VAGABOND_SEAT, factionId: 'vagabot', character: 'ranger' },
    ])
  })

  it('skips a Vagabond standing on a clearing', () => {
    expect(forestPawnsFromPlayers([makeVagabondPlayer('thief', null)])).toEqual(
      [],
    )
  })
})
