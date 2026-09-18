import { describe, expect, it } from 'vitest'
import { FALL } from '../map/fall.js'
import { defaultRuleHooks } from '../triggers/hooks.js'
import type { Piece } from '../pieces/types.js'
import { marquiseBoard, minimalState, player, withPieces } from '../test/fixtures.js'
import { ruler } from './ruler.js'

const hooks = defaultRuleHooks(FALL)

describe('ruler', () => {
  it('Rule: Board > Rule — player rules with more warriors + buildings', () => {
    const state = withPieces(minimalState(), 4, [
      { id: 'w0', kind: 'warrior', owner: 0 },
      { id: 'w1', kind: 'warrior', owner: 0 },
      { id: 'w2', kind: 'warrior', owner: 1 },
    ])
    expect(ruler(state, 4, hooks)).toBe(0)
  })

  it('Rule: Board > Rule — tokens and pawns do not count toward rule', () => {
    const state = withPieces(minimalState(), 4, [
      { id: 'k0', kind: 'token', owner: 0, type: 'keep' },
      { id: 'w1', kind: 'warrior', owner: 1 },
    ])
    expect(ruler(state, 4, hooks)).toBe(1)
  })

  it('Rule: Board > Rule — tie → no one rules', () => {
    const state = withPieces(
      minimalState({
        factions: ['marquise', 'marquise'],
        players: [player(0, 'marquise'), player(1, 'marquise')],
      }),
      4,
      [
        { id: 'w0', kind: 'warrior', owner: 0 },
        { id: 'w1', kind: 'warrior', owner: 1 },
      ],
    )
    expect(ruler(state, 4, hooks)).toBeNull()
  })

  it('Rule: 7.2.2 Lords of the Forest — Eyrie wins ties if ≥1 Eyrie piece present', () => {
    const state = withPieces(
      minimalState({
        factions: ['marquise', 'eyrie'],
        players: [
          player(0, 'marquise', { board: marquiseBoard() }),
          player(1, 'eyrie', {
            board: {
              kind: 'eyrie',
              supply: { warriors: 20 },
              leader: 'builder',
              decree: { recruit: [], move: [], battle: [], build: [] },
              roostTrack: { placed: 6 },
            },
          }),
        ],
      }),
      4,
      [
        { id: 'w0', kind: 'warrior', owner: 0 },
        { id: 'w1', kind: 'warrior', owner: 1 },
      ],
    )
    expect(ruler(state, 4, hooks)).toBe(1)
  })

  it('Rule: Board > Rule — hooks.ruleWeight can boost token rule strength', () => {
    const pieces: Piece[] = [
      { id: 's0', kind: 'token', owner: 0, type: 'sympathy' },
      { id: 'w1', kind: 'warrior', owner: 1 },
    ]
    const state = withPieces(minimalState(), 4, pieces)
    const boosted = {
      ...hooks,
      ruleWeight: (_s: unknown, piece: Piece) =>
        piece.kind === 'token' ? 2 : 1,
    }
    expect(ruler(state, 4, boosted)).toBe(0)
  })
})
