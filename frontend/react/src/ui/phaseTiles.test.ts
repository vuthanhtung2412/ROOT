import { describe, expect, it } from 'vitest'
import { makeActionSpec } from '#test/factories.ts'
import {
  EMPTY_PHASE_TILE_MEMORY,
  phaseTilesOf,
  rememberPhaseTiles,
  type KeyedAction,
} from '#ui/phaseTiles.ts'

const DAYLIGHT_KEY = '3:0:daylight'
const EVENING_KEY = '3:0:evening'

function makeTile(type: string): KeyedAction {
  return { key: type, spec: makeActionSpec({ type }) }
}

describe('rememberPhaseTiles', () => {
  it('keeps a tile that is no longer legal in its place, spent', () => {
    const recruit = makeTile('recruit')
    const march = makeTile('march')
    const build = makeTile('build')
    const seen = rememberPhaseTiles(EMPTY_PHASE_TILE_MEMORY, DAYLIGHT_KEY, [
      recruit,
      march,
      build,
    ])

    const afterRecruit = rememberPhaseTiles(seen, DAYLIGHT_KEY, [march, build])

    expect(
      phaseTilesOf(afterRecruit, [march, build]).map((tile) => [
        tile.key,
        tile.isSpent,
      ]),
    ).toEqual([
      ['recruit', true],
      ['march', false],
      ['build', false],
    ])
  })

  it('appends a tile that becomes legal later in the phase', () => {
    const march = makeTile('march')
    const battle = makeTile('battle')
    const seen = rememberPhaseTiles(EMPTY_PHASE_TILE_MEMORY, DAYLIGHT_KEY, [
      march,
    ])

    const afterMarch = rememberPhaseTiles(seen, DAYLIGHT_KEY, [battle, march])

    expect(afterMarch.tiles.map((tile) => tile.key)).toEqual(['march', 'battle'])
  })

  it('takes the latest action of a tile seen again', () => {
    const firstMarch = makeTile('march')
    const laterMarch: KeyedAction = {
      key: 'march',
      spec: makeActionSpec({ type: 'march', params: { moves: [] } }),
    }
    const seen = rememberPhaseTiles(EMPTY_PHASE_TILE_MEMORY, DAYLIGHT_KEY, [
      firstMarch,
    ])

    const again = rememberPhaseTiles(seen, DAYLIGHT_KEY, [laterMarch])

    expect(again.tiles[0]?.spec).toBe(laterMarch.spec)
  })

  it('forgets the tiles of the phase before', () => {
    const seen = rememberPhaseTiles(EMPTY_PHASE_TILE_MEMORY, DAYLIGHT_KEY, [
      makeTile('recruit'),
    ])
    const draw = makeTile('eveningDraw')

    const evening = rememberPhaseTiles(seen, EVENING_KEY, [draw])

    expect(evening.tiles).toEqual([draw])
  })

  it('leaves the phase untouched while a pending event is answered', () => {
    const seen = rememberPhaseTiles(EMPTY_PHASE_TILE_MEMORY, DAYLIGHT_KEY, [
      makeTile('recruit'),
    ])

    const answering = rememberPhaseTiles(seen, null, [makeTile('resolveEvent')])

    expect(answering).toBe(seen)
  })
})
