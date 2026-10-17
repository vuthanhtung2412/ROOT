import { describe, expect, it } from 'vitest'
import type { GameState } from '#api/client.ts'
import {
  botTakingTurn,
  buildBotTurnBannerViewModel,
  nextLatestStepStart,
} from '#ui/botTurnBannerViewModel.ts'
import type { GameLogContext } from '#ui/gameLog.ts'

const HUMAN_SEAT = 0
const BOT_SEAT = 1
const FOX_ANVIL = { id: 'ROOT-204#1', defId: 'ROOT-204' }
const FACTIONS: string[] = ['alliance', 'mechanicalMarquise']

type StateOverrides = Partial<Pick<GameState, 'currentSeat' | 'status' | 'phase' | 'step'>>

function makeState(overrides: StateOverrides = {}): GameState {
  return {
    id: 'game-1',
    seed: 1,
    status: 'playing',
    turn: 2,
    currentSeat: BOT_SEAT,
    phase: 'daylight',
    step: 'battle',
    factions: FACTIONS,
    players: [
      { playerId: 'alliance', seat: HUMAN_SEAT, faction: 'alliance', vp: 0, hand: [] },
      {
        playerId: 'bot-mechanicalMarquise',
        seat: BOT_SEAT,
        faction: 'mechanicalMarquise',
        vp: 3,
        hand: [],
        board: { kind: 'mechanicalMarquise', supply: { warriors: 10 }, tracks: {}, orderCard: FOX_ANVIL },
      },
    ],
    clearings: [],
    pending: [],
    ...overrides,
  }
}

const CONTEXT: GameLogContext = {
  factionOfSeat: (seat: number): string => FACTIONS[seat] ?? 'unknown',
  cardName: (): string => 'Anvil',
}

function botTurnStart(actor: number): unknown {
  return { t: 'phase', actor, phase: 'birdsong', step: 'reveal' }
}

function botAction(action: Record<string, unknown>): unknown {
  return { t: 'action', actor: BOT_SEAT, action }
}

const PREVIOUS_TURN_LOG: unknown[] = [
  botTurnStart(BOT_SEAT),
  botAction({ type: 'botRecruit', clearing: 2 }),
  botTurnStart(HUMAN_SEAT),
  { t: 'action', actor: HUMAN_SEAT, action: { type: 'craft', cardId: 'x' } },
]

describe('buildBotTurnBannerViewModel', () => {
  it('shows the order card and the actions of the bot turn in progress, latest last', () => {
    const log: unknown[] = [
      ...PREVIOUS_TURN_LOG,
      botTurnStart(BOT_SEAT),
      botAction({ type: 'revealOrder', cardId: FOX_ANVIL.id }),
      botAction({ type: 'botCraft', cardId: FOX_ANVIL.id }),
      botAction({ type: 'botBattle', clearing: 5, defender: HUMAN_SEAT }),
      botAction({ type: 'botRecruit', clearing: 1 }),
      botAction({ type: 'botBuild', clearing: 3 }),
    ]

    const view = buildBotTurnBannerViewModel(makeState(), { log, latestStepStart: log.length - 1 }, CONTEXT)

    expect(view?.faction).toBe('mechanicalMarquise')
    expect(view?.phase).toBe('daylight')
    expect(view?.orderCard).toMatchObject({ cardId: FOX_ANVIL.id, definitionId: 'ROOT-204', suit: 'fox' })
    expect(view?.latestActions.map((action) => action.number)).toEqual([5])
    expect(view?.latestActions[0]?.parts).toContainEqual({ kind: 'clearing', clearingId: 3 })
    expect(view?.earlierActions.map((action) => action.number)).toEqual([2, 3, 4])
  })

  it('groups the actions of one bot step: a Recruit in several clearings', () => {
    const turnStart: unknown[] = [...PREVIOUS_TURN_LOG, botTurnStart(BOT_SEAT), botAction({ type: 'revealOrder', cardId: FOX_ANVIL.id })]
    const log: unknown[] = [
      ...turnStart,
      botAction({ type: 'botRecruit', clearing: 2 }),
      botAction({ type: 'botRecruit', clearing: 4 }),
    ]

    const view = buildBotTurnBannerViewModel(makeState(), { log, latestStepStart: turnStart.length }, CONTEXT)

    expect(view?.latestActions.map((action) => action.number)).toEqual([2, 3])
    expect(view?.earlierActions.map((action) => action.number)).toEqual([1])
  })

  it('waits for the first action at the start of the bot turn', () => {
    const log: unknown[] = [...PREVIOUS_TURN_LOG, botTurnStart(BOT_SEAT)]

    const view = buildBotTurnBannerViewModel(makeState(), { log, latestStepStart: log.length }, CONTEXT)

    expect(view?.latestActions).toEqual([])
    expect(view?.earlierActions).toEqual([])
  })

  it('shows nothing on a human turn or once the game is over', () => {
    const turnLog = { log: [], latestStepStart: 0 }

    expect(buildBotTurnBannerViewModel(makeState({ currentSeat: HUMAN_SEAT }), turnLog, CONTEXT)).toBeNull()
    expect(buildBotTurnBannerViewModel(makeState({ status: 'finished' }), turnLog, CONTEXT)).toBeNull()
  })
})

describe('nextLatestStepStart', () => {
  const previousLog: unknown[] = [botTurnStart(BOT_SEAT)]

  it('starts the latest step where the new actions begin', () => {
    const nextLog: unknown[] = [...previousLog, botAction({ type: 'botRecruit', clearing: 2 })]

    expect(nextLatestStepStart(previousLog, nextLog, 0)).toBe(previousLog.length)
  })

  it('keeps the latest step when the new entries hold no action', () => {
    const nextLog: unknown[] = [...previousLog, botAction({ type: 'endPhase' }), botTurnStart(BOT_SEAT)]
    const keptStart = 0

    expect(nextLatestStepStart(previousLog, nextLog, keptStart)).toBe(keptStart)
  })
})

describe('botTakingTurn', () => {
  it('names the bot on its turn', () => {
    expect(botTakingTurn(makeState())).toBe('mechanicalMarquise')
  })

  it('is null on the player turn and once the game is over', () => {
    expect(botTakingTurn(makeState({ currentSeat: HUMAN_SEAT }))).toBeNull()
    expect(botTakingTurn(makeState({ status: 'finished' }))).toBeNull()
  })
})
