import { describe, expect, it } from 'vitest'
import { ActionComposer } from '#game/resolution/ActionComposer.ts'
import { createAllianceComposerHooks } from '#game/resolution/allianceActionComposer.ts'
import { makeActionSpec } from '#test/factories.ts'

describe('allianceActionComposer spreadSympathy', () => {
  it('picks clearing then supporter spend option (birds+mouse)', () => {
    const alliance = createAllianceComposerHooks()
    const composer = new ActionComposer()
    composer.setHooks(alliance.hooks)

    const mouseClearing = 1
    const foxClearing = 0
    const mid = composer.begin(
      makeActionSpec({
        type: 'spreadSympathy',
        params: {
          options: [
            { clearing: mouseClearing, supporterIds: ['ROOT-84#1'] },
            { clearing: mouseClearing, supporterIds: ['ROOT-57#1'] },
            { clearing: foxClearing, supporterIds: ['ROOT-57#1'] },
            { clearing: foxClearing, supporterIds: ['ROOT-57#2'] },
          ],
        },
      }),
    )
    expect(mid.kind).toBe('incomplete')
    if (mid.kind !== 'incomplete') throw new Error('expected incomplete')
    expect(mid.prompt.highlightClearings).toEqual(
      expect.arrayContaining([mouseClearing, foxClearing]),
    )

    const afterClearing = composer.chooseClearing(mouseClearing)
    expect(afterClearing.kind).toBe('incomplete')
    if (afterClearing.kind !== 'incomplete') throw new Error('expected incomplete')
    expect(afterClearing.prompt.message).toBe(
      'Choose 1 mouse supporter to discard',
    )
    expect(alliance.getPromptOptions().map((option) => option.label)).toEqual([
      'mouse',
      'bird',
    ])

    expect(composer.chooseColumn('0')).toEqual({
      kind: 'ready',
      action: {
        type: 'spreadSympathy',
        clearing: mouseClearing,
        supporterIds: ['ROOT-84#1'],
      },
    })
  })

  it('titles supporter pick as Choose N suit supporters to discard', () => {
    const alliance = createAllianceComposerHooks()
    const composer = new ActionComposer()
    composer.setHooks(alliance.hooks)

    composer.begin(
      makeActionSpec({
        type: 'revolt',
        params: {
          options: [
            { clearing: 0, supporterIds: ['ROOT-72#1', 'ROOT-57#1'] },
            { clearing: 0, supporterIds: ['ROOT-72#1', 'ROOT-57#2'] },
          ],
        },
      }),
    )
    const afterClearing = composer.chooseClearing(0)
    expect(afterClearing).toMatchObject({
      kind: 'incomplete',
      prompt: { message: 'Choose 2 fox supporters to discard' },
    })
  })

  it('auto-submits when only one clearing×supporter option', () => {
    const alliance = createAllianceComposerHooks()
    const composer = new ActionComposer()
    composer.setHooks(alliance.hooks)

    expect(
      composer.begin(
        makeActionSpec({
          type: 'spreadSympathy',
          params: {
            options: [{ clearing: 1, supporterIds: ['ROOT-57#1'] }],
          },
        }),
      ),
    ).toEqual({
      kind: 'ready',
      action: {
        type: 'spreadSympathy',
        clearing: 1,
        supporterIds: ['ROOT-57#1'],
      },
    })
  })
})
