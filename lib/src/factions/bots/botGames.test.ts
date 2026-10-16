import { describe, expect, it } from 'vitest'
import type { Action, ActionSpec } from '#actions/types.js'
import { isBotFaction } from '#factions/bots/botFactions.js'
import { Game } from '#game/Game.js'
import type { FactionId } from '#pieces/types.js'
import { HAND_LIMIT } from '#state/constants.js'
import { finishSetup } from '#test/fixtures.js'

/** Player actions a passive human sends before the bots reach 30 points. */
const MAXIMUM_HUMAN_ACTIONS = 2000
const SEEDS: readonly number[] = [1, 2, 3]
const TABLES: readonly FactionId[][] = [
  ['marquise', 'electricEyrie'],
  ['mechanicalMarquise', 'alliance', 'vagabond'],
  ['mechanicalMarquise', 'electricEyrie', 'riverfolk'],
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

function startedGame(seed: number, factions: readonly FactionId[]): Game {
  const game = Game.create({ seed, factions: [...factions] })
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
