import { describe, expect, it } from 'vitest'
import {
  buildGameLogLines,
  type GameLogContext,
  type GameLogLine,
  type GameLogPart,
} from '#ui/gameLog.ts'

const FACTIONS: readonly string[] = ['marquise', 'eyrie']
const CARD_NAMES: Readonly<Record<string, string>> = {
  'ROOT-222#1': 'Root Tea',
  'ROOT-224#1': 'Sword',
}

const context: GameLogContext = {
  factionOfSeat: (seat: number): string => FACTIONS[seat] ?? `seat ${String(seat)}`,
  cardName: (cardId: string): string | null => CARD_NAMES[cardId] ?? null,
}

function actionEntry(actor: number, action: Record<string, unknown>): object {
  return { t: 'action', actor, action }
}

/** The parts of the only action line the log produces. */
function partsOf(action: Record<string, unknown>): GameLogPart[] {
  const lines: GameLogLine[] = buildGameLogLines([actionEntry(0, action)], context)
  const line: GameLogLine | undefined = lines[0]
  if (line === undefined || line.kind !== 'action') {
    throw new Error('expected one action line')
  }
  return line.parts
}

/** Parts as one string: `[Card]` for a card, `C7` for a clearing. */
function readable(parts: readonly GameLogPart[]): string {
  return parts
    .map((part: GameLogPart): string => {
      if (part.kind === 'card') return `[${part.name}]`
      if (part.kind === 'clearing') return `C${String(part.clearingId)}`
      return part.text
    })
    .join(' ')
}

describe('buildGameLogLines', () => {
  it('shows a card by its name, never by its id', () => {
    expect(readable(partsOf({ type: 'craft', cardId: 'ROOT-222#1' }))).toBe(
      'craft [Root Tea]',
    )
  })

  it('shows a hidden card of another player as "a card"', () => {
    expect(readable(partsOf({ type: 'mobilize', cardIds: ['HIDDEN'] }))).toBe(
      'mobilize [a card]',
    )
  })

  it('shows a clearing as a reference the UI can point at', () => {
    const parts: GameLogPart[] = partsOf({
      type: 'battle',
      clearing: 7,
      defender: 1,
    })

    expect(parts).toContainEqual({ kind: 'clearing', clearingId: 7 })
    expect(readable(parts)).toBe('battle in C7 against eyrie')
  })

  it('shows each move of a march: count, origin, destination', () => {
    expect(
      readable(
        partsOf({
          type: 'march',
          moves: [
            { from: 7, to: 6, count: 1 },
            { from: 11, to: 6, count: 2 },
          ],
        }),
      ),
    ).toBe('march 1 × C7 → C6 2 × C11 → C6')
  })

  it('shows a single move the same way', () => {
    expect(
      readable(partsOf({ type: 'crusadeMove', from: 0, to: 8, count: 2 })),
    ).toBe('crusade move 2 × C0 → C8')
  })

  it('shows each card added to the Decree with its column', () => {
    expect(
      readable(
        partsOf({
          type: 'addToDecree',
          cards: [{ cardId: 'ROOT-224#1', column: 'battle' }],
        }),
      ),
    ).toBe('adds to the Decree [Sword] → battle')
  })

  it('shows answers to a prompt: a decline, a card, removed pieces', () => {
    expect(readable(partsOf({ type: 'resolveEvent', decline: true }))).toBe(
      'answers declines',
    )
    expect(
      readable(partsOf({ type: 'resolveEvent', pieceIds: ['w-1', 'b-2'] })),
    ).toBe('answers removes 2 pieces')
  })

  it('leaves out phase ends and everything that is game state', () => {
    const lines: GameLogLine[] = buildGameLogLines(
      [
        actionEntry(0, { type: 'endPhase' }),
        { t: 'vp', actor: 0, delta: 2, reason: 'build' },
        { t: 'pieces', clearing: 6, placed: [{ id: 'w-1', kind: 'warrior', owner: 0 }] },
        { t: 'event', event: { type: 'battle', clearing: 6, attacker: 0, defender: 1 } },
        { t: 'phase', actor: 0, phase: 'daylight', step: 'actions' },
        actionEntry(0, { type: 'recruit' }),
      ],
      context,
    )

    expect(lines).toEqual([
      {
        kind: 'action',
        key: '5',
        faction: 'marquise',
        parts: [{ kind: 'text', text: 'recruit' }],
      },
    ])
  })

  it('opens each turn with one heading for its faction', () => {
    const lines: GameLogLine[] = buildGameLogLines(
      [
        { t: 'phase', actor: 1, phase: 'birdsong', step: 'emergency' },
        { t: 'phase', actor: 1, phase: 'birdsong', step: 'decreeAdd' },
        actionEntry(1, { type: 'addToDecree', cards: [] }),
        // A later Birdsong step of the same turn: no second heading.
        { t: 'phase', actor: 1, phase: 'birdsong', step: 'newRoost' },
        actionEntry(1, { type: 'turmoil' }),
        { t: 'phase', actor: 0, phase: 'birdsong', step: 'wood' },
      ],
      context,
    )

    expect(
      lines.map((line: GameLogLine): string => `${line.kind}:${line.faction}`),
    ).toEqual(['turn:eyrie', 'action:eyrie', 'action:eyrie', 'turn:marquise'])
  })
})
