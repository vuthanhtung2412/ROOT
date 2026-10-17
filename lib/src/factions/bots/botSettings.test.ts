import { describe, expect, it } from 'vitest'
import {
  botDifficultyOf,
  botHasTrait,
  isChallengingOrHarder,
} from '#factions/bots/botSettings.js'
import { Game } from '#game/Game.js'
import type { Seat } from '#pieces/types.js'
import type { BotSettingsByFaction } from '#public/botSettings.js'
import type { GameState } from '#state/types.js'
import { minimalState, player } from '#test/fixtures.js'

const HUMAN: Seat = 0
const MARQUISE_BOT: Seat = 1
const EYRIE_BOT: Seat = 2
const NIGHTMARE_BLITZ: BotSettingsByFaction = {
  mechanicalMarquise: { difficulty: 'nightmare', traits: ['blitz'] },
}

function soloState(botSettings?: BotSettingsByFaction): GameState {
  return minimalState({
    factions: ['alliance', 'mechanicalMarquise', 'electricEyrie'],
    players: [
      player(HUMAN, 'alliance'),
      player(MARQUISE_BOT, 'mechanicalMarquise'),
      player(EYRIE_BOT, 'electricEyrie'),
    ],
    ...(botSettings === undefined ? {} : { botSettings }),
  })
}

describe('bot settings (Rootbotics 3.3)', () => {
  it('3.3.1 a bot with no difficulty card plays default, with no trait', () => {
    const state = soloState()

    expect(botDifficultyOf(state, MARQUISE_BOT)).toBe('default')
    expect(botHasTrait(state, MARQUISE_BOT, 'blitz')).toBe(false)
    expect(isChallengingOrHarder(state, MARQUISE_BOT)).toBe(false)
  })

  it('3.3 reads each bot its own difficulty and traits', () => {
    const state = soloState(NIGHTMARE_BLITZ)

    expect(botDifficultyOf(state, MARQUISE_BOT)).toBe('nightmare')
    expect(isChallengingOrHarder(state, MARQUISE_BOT)).toBe(true)
    expect(botHasTrait(state, MARQUISE_BOT, 'blitz')).toBe(true)
    expect(botDifficultyOf(state, EYRIE_BOT)).toBe('default')
    expect(botHasTrait(state, HUMAN, 'blitz')).toBe(false)
  })

  it('a new game keeps its bot settings, also after an undo', () => {
    const game = Game.create({
      seed: 7,
      factions: ['alliance', 'mechanicalMarquise', 'electricEyrie'],
      botSettings: NIGHTMARE_BLITZ,
    })
    game.join('alliance')
    game.start()
    game.undo()

    expect(game.state.botSettings).toEqual(NIGHTMARE_BLITZ)
    expect(Game.fromJSON(game.toJSON()).state.botSettings).toEqual(NIGHTMARE_BLITZ)
  })
})
