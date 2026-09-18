import { describe, expect, it } from 'vitest'
import { makeActionSpec } from '../test/factories.ts'
import { ActionComposer } from './ActionComposer.ts'
import { createEventComposerHooks } from './eventActionComposer.ts'

describe('eventActionComposer Field Hospitals', () => {
  it('decline resolveEvent submits immediately', () => {
    const events = createEventComposerHooks()
    const composer = new ActionComposer()
    composer.setHooks(events.hooks)

    expect(
      composer.begin(
        makeActionSpec({
          type: 'resolveEvent',
          params: { decline: [true] },
        }),
      ),
    ).toEqual({
      kind: 'ready',
      action: { type: 'resolveEvent', decline: true },
    })
  })

  it('single cardId resolveEvent submits immediately', () => {
    const events = createEventComposerHooks()
    const composer = new ActionComposer()
    composer.setHooks(events.hooks)

    expect(
      composer.begin(
        makeActionSpec({
          type: 'resolveEvent',
          params: { cardIds: ['ROOT-205#1'] },
        }),
      ),
    ).toEqual({
      kind: 'ready',
      action: { type: 'resolveEvent', cardId: 'ROOT-205#1' },
    })
  })
})
