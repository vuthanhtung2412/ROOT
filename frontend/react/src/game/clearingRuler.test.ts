import { describe, expect, it } from 'vitest'
import { clearingRuler, ruleStrengthForSeat } from '#game/clearingRuler.ts'

describe('clearingRuler', () => {
  it('counts warriors and buildings only', () => {
    expect(
      ruleStrengthForSeat(
        {
          pieces: [
            { kind: 'warrior', owner: 0 },
            { kind: 'building', owner: 0 },
            { kind: 'token', owner: 0 },
            { kind: 'pawn', owner: 0 },
          ],
        },
        0,
      ),
    ).toBe(2)
  })

  it('returns sole strongest seat', () => {
    expect(
      clearingRuler(
        {
          pieces: [
            { kind: 'warrior', owner: 0 },
            { kind: 'warrior', owner: 0 },
            { kind: 'warrior', owner: 1 },
          ],
        },
        ['marquise', 'eyrie'],
      ),
    ).toBe(0)
  })

  it('Eyrie wins ties (Lords of the Forest)', () => {
    expect(
      clearingRuler(
        {
          pieces: [
            { kind: 'warrior', owner: 0 },
            { kind: 'warrior', owner: 1 },
          ],
        },
        ['marquise', 'eyrie'],
      ),
    ).toBe(1)
  })

  it('contested non-Eyrie tie is null', () => {
    expect(
      clearingRuler(
        {
          pieces: [
            { kind: 'warrior', owner: 0 },
            { kind: 'warrior', owner: 1 },
          ],
        },
        ['marquise', 'alliance'],
      ),
    ).toBeNull()
  })

  it('empty clearing is null', () => {
    expect(clearingRuler({ pieces: [] }, ['marquise', 'eyrie'])).toBeNull()
  })
})
