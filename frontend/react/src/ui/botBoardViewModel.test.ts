import { describe, expect, it } from 'vitest'
import { buildBotBoardViewModel, isBotBoardViewModel } from '#ui/botBoardViewModel.ts'

const BOT_SEAT = 1
const FOX_ANVIL = { id: 'ROOT-204#1', defId: 'ROOT-204' }
const VIZIER = { id: 'vizier-0', defId: 'VIZIER' }

describe('buildBotBoardViewModel', () => {
  it('shows the Mechanical Marquise order card, tracks and crafted items', () => {
    const view = buildBotBoardViewModel({
      seat: BOT_SEAT,
      faction: 'mechanicalMarquise',
      vp: 7,
      craftedItems: [{ type: 'hammer', exhausted: false }],
      board: {
        kind: 'mechanicalMarquise',
        supply: { warriors: 12 },
        tracks: { sawmill: { placed: 4 }, workshop: { placed: 5 }, recruiter: { placed: 3 } },
        orderCard: FOX_ANVIL,
      },
    })

    expect(view).toMatchObject({
      kind: 'mechanicalMarquise',
      seat: BOT_SEAT,
      victoryPoints: 7,
      warriors: 12,
      orderCard: { cardId: FOX_ANVIL.id, suit: 'fox' },
      craftedItems: ['hammer'],
      tracks: [
        { building: 'sawmill', onTrack: 4 },
        { building: 'workshop', onTrack: 5 },
        { building: 'recruiter', onTrack: 3 },
      ],
    })
  })

  it('lists the difficulty and trait cards with their text (Rootbotics 3.3)', () => {
    const board = {
      kind: 'mechanicalMarquise',
      supply: { warriors: 12 },
      tracks: {},
      orderCard: null,
    }
    const player = { seat: BOT_SEAT, faction: 'mechanicalMarquise', vp: 0, board }

    expect(buildBotBoardViewModel(player)?.settings).toEqual({
      difficulty: { name: 'Default', text: 'The rules on the faction board.' },
      traits: [],
    })
    const settings = buildBotBoardViewModel(player, {
      mechanicalMarquise: { difficulty: 'easy', traits: ['ironWill'] },
    })?.settings
    expect(settings?.difficulty.name).toBe('Easy')
    expect(settings?.traits).toEqual([
      { name: 'Iron Will', text: 'In Escalated Daylight recruit twice as many warriors.' },
    ])
  })

  it('shows the Electric Eyrie Decree by suit, viziers in the bird column', () => {
    const view = buildBotBoardViewModel({
      seat: BOT_SEAT,
      faction: 'electricEyrie',
      vp: 0,
      board: {
        kind: 'electricEyrie',
        supply: { warriors: 14 },
        decree: { fox: [FOX_ANVIL], mouse: [], rabbit: [], bird: [VIZIER] },
        roostTrack: { placed: 5 },
        orderCard: null,
      },
    })

    expect(view).toMatchObject({
      kind: 'electricEyrie',
      orderCard: null,
      roostsOnTrack: 5,
      decree: [
        { suit: 'fox', cards: [{ cardId: FOX_ANVIL.id, suit: 'fox' }] },
        { suit: 'mouse', cards: [] },
        { suit: 'rabbit', cards: [] },
        { suit: 'bird', cards: [{ cardId: VIZIER.id, name: 'Loyal Vizier', suit: 'bird' }] },
      ],
    })
    expect(view !== null && isBotBoardViewModel(view)).toBe(true)
  })

  it('is null for a human faction board', () => {
    expect(
      buildBotBoardViewModel({ seat: 0, faction: 'alliance', vp: 0, board: { kind: 'alliance' } }),
    ).toBeNull()
  })
})
