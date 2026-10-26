import { describe, expect, it } from 'vitest'
import type { Action, ActionSpec } from '#actions/types.js'
import { isBotFaction } from '#factions/bots/botFactions.js'
import { Game } from '#game/Game.js'
import type { FactionId } from '#pieces/types.js'
import {
  BOT_DIFFICULTIES,
  BOT_TRAITS,
  type BotDifficulty,
  type BotSettingsByFaction,
} from '#public/botSettings.js'
import { HAND_LIMIT } from '#state/constants.js'
import { finishSetup } from '#test/fixtures.js'

/** Player actions a passive human sends before the bots reach 30 points. */
const MAXIMUM_HUMAN_ACTIONS = 2000
const SEEDS: readonly number[] = [1, 2, 3]
const TABLES: readonly FactionId[][] = [
  ['marquise', 'electricEyrie'],
  ['mechanicalMarquise', 'alliance', 'vagabond'],
  ['mechanicalMarquise', 'electricEyrie', 'riverfolk'],
  ['marquise', 'automatedAlliance'],
  ['mechanicalMarquise', 'automatedAlliance', 'riverfolk'],
  ['marquise', 'vagabot'],
  ['electricEyrie', 'automatedAlliance', 'vagabot', 'riverfolk'],
]

/** A human who only answers prompts and ends phases. */
function passiveAnswer(spec: ActionSpec): Action | null {
  const params = spec.params
  switch (spec.type) {
    case 'endPhase':
      return { type: 'endPhase' }
    case 'discard': {
      const cardIds = params?.cardIds ?? []
      return { type: 'discard', cardIds: cardIds.slice(HAND_LIMIT) }
    }
    case 'resolveEvent': {
      if (params?.decline !== undefined) return { type: 'resolveEvent', decline: true }
      const pieceIds = params?.pieceIds
      if (pieceIds !== undefined) return { type: 'resolveEvent', pieceIds }
      const order = params?.order?.[0]
      if (order !== undefined) return { type: 'resolveEvent', order }
      if (params?.useEffect !== undefined) return { type: 'resolveEvent', useEffect: false }
      const cardId = params?.cardIds?.[0]
      if (cardId !== undefined) return { type: 'resolveEvent', cardId }
      return null
    }
    default:
      return null
  }
}

function playPassively(game: Game): void {
  for (let step = 0; step < MAXIMUM_HUMAN_ACTIONS && game.state.status === 'playing'; step += 1) {
    const action = game
      .legalActions()
      .map(passiveAnswer)
      .find((candidate: Action | null): candidate is Action => candidate !== null)
    if (action === undefined) throw new Error(`no passive answer in ${game.state.phase}/${game.state.step}`)
    game.apply(action)
  }
}

function startedGame(
  seed: number,
  factions: readonly FactionId[],
  botSettings?: BotSettingsByFaction,
): Game {
  const game = Game.create({
    seed,
    factions: [...factions],
    ...(botSettings === undefined ? {} : { botSettings }),
  })
  for (const faction of factions) {
    if (!isBotFaction(faction)) game.join(`human-${faction}`)
  }
  game.start()
  finishSetup(game)
  return game
}

describe('seeded games with bots (Rootbotics 4–5)', () => {
  for (const factions of TABLES) {
    for (const seed of SEEDS) {
      it(`${factions.join(' vs ')} (seed ${seed}) plays to a winner and replays the same`, () => {
        const game = startedGame(seed, factions)
        playPassively(game)

        expect(game.state.status).toBe('finished')
        const winner = game.state.players.find((seated) => seated.seat === game.state.winner)
        expect(winner !== undefined && isBotFaction(winner.faction)).toBe(true)

        const replayed = Game.replay(seed, game.history, [...factions])
        expect(replayed.state).toEqual(game.state)
      })
    }
  }
})

const BOTS_WITH_A_HUMAN: readonly FactionId[] = ['mechanicalMarquise', 'electricEyrie', 'riverfolk']

function everyTraitAt(difficulty: BotDifficulty): BotSettingsByFaction {
  return {
    mechanicalMarquise: { difficulty, traits: [...BOT_TRAITS.mechanicalMarquise] },
    electricEyrie: { difficulty, traits: [...BOT_TRAITS.electricEyrie] },
  }
}

describe('seeded games with bot difficulty and every trait (Rootbotics 3.3)', () => {
  for (const difficulty of BOT_DIFFICULTIES) {
    for (const seed of SEEDS) {
      it(`${difficulty}, every trait (seed ${seed}) plays to a winner`, () => {
        const game = startedGame(seed, BOTS_WITH_A_HUMAN, everyTraitAt(difficulty))
        playPassively(game)

        expect(game.state.status).toBe('finished')
        expect(game.state.botSettings).toEqual(everyTraitAt(difficulty))
      })
    }
  }
})

/** Paced bots: every bot step taken one by one before the human acts again. */
function playPassivelyWithPacedBots(game: Game): void {
  game.setBotPacing(true)
  for (let step = 0; step < MAXIMUM_HUMAN_ACTIONS && game.state.status === 'playing'; step += 1) {
    while (game.botHasWork()) game.stepBot()
    if (game.state.status !== 'playing') return
    const action = game
      .legalActions()
      .map(passiveAnswer)
      .find((candidate: Action | null): candidate is Action => candidate !== null)
    if (action === undefined) throw new Error(`no passive answer in ${game.state.phase}/${game.state.step}`)
    game.apply(action)
  }
}

describe('paced bots (one bot step at a time)', () => {
  for (const factions of TABLES) {
    it(`${factions.join(' vs ')} ends like the game with bots played at once`, () => {
      const atOnce = startedGame(SEEDS[0]!, factions)
      playPassively(atOnce)
      const paced = startedGame(SEEDS[0]!, factions)
      playPassivelyWithPacedBots(paced)

      expect(paced.state).toEqual(atOnce.state)
      expect(paced.log).toEqual(atOnce.log)
    })
  }

  it('waits for stepBot after a human action that hands the turn to a bot', () => {
    const game = startedGame(SEEDS[0]!, TABLES[0]!)
    game.setBotPacing(true)
    while (!game.botHasWork()) {
      const action = game
        .legalActions()
        .map(passiveAnswer)
        .find((candidate: Action | null): candidate is Action => candidate !== null)
      if (action === undefined) throw new Error('no passive answer')
      game.apply(action)
    }
    const botSeat = game.state.currentSeat
    const logLength = game.log.length
    game.stepBot()

    expect(game.log.length).toBeGreaterThanOrEqual(logLength)
    expect(game.state.players[botSeat]?.faction).toBe('electricEyrie')
  })

  it('refuses a bot step when no bot has work', () => {
    const game = startedGame(SEEDS[0]!, TABLES[0]!)
    game.setBotPacing(true)

    expect(game.botHasWork()).toBe(false)
    expect(() => game.stepBot()).toThrow('NO_BOT_WORK')
  })
})
