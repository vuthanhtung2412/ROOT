import { describe, expect, it } from 'vitest'
import { makeActionSpec } from '#test/factories.ts'
import { ActionComposer } from '#game/resolution/ActionComposer.ts'
import { mergeComposerHooks } from '#game/resolution/mergeComposerHooks.ts'
import { createMarquiseCardComposerHooks } from '#game/resolution/marquiseActionComposer.ts'
import { createMarchWorkflowHooks } from '#game/resolution/marchWorkflowHooks.ts'
import type { ComposerOutcome } from '#game/resolution/ActionComposer.ts'

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

function lastIncomplete(
  outcomes: ComposerOutcome[],
): Extract<ComposerOutcome, { kind: 'incomplete' }> {
  const found = [...outcomes]
    .reverse()
    .find((entry) => entry.kind === 'incomplete')
  if (found === undefined || found.kind !== 'incomplete') {
    throw new Error('expected incomplete outcome')
  }
  return found
}

describe('march workflow', () => {
  it('prompts from → to → count then confirms single move', async () => {
    const march = createMarchWorkflowHooks()
    const outcomes: ComposerOutcome[] = []
    march.setOnOutcome((outcome) => {
      outcomes.push(outcome)
    })
    const composer = new ActionComposer()
    composer.setHooks(march.hooks)

    composer.begin(
      makeActionSpec({
        type: 'march',
        params: {
          moves: [
            { from: 0, to: 4, count: 1 },
            { from: 0, to: 4, count: 2 },
            { from: 4, to: 9, count: 1 },
          ],
        },
      }),
    )
    expect(lastIncomplete(outcomes).prompt.message).toContain('pick origin')

    composer.chooseClearing(0)
    await flushMicrotasks()
    expect(lastIncomplete(outcomes).prompt.message).toContain('destination')

    composer.chooseClearing(4)
    await flushMicrotasks()
    const afterTo = lastIncomplete(outcomes)
    expect(afterTo.prompt.message).toContain('how many')
    expect(afterTo.prompt.canConfirm).toBe(false)
    expect(march.getPromptOptions()).toEqual([
      { label: '1 x warriors', value: '1' },
      { label: '2 x warriors', value: '2' },
    ])

    composer.chooseColumn('1')
    await flushMicrotasks()
    expect(lastIncomplete(outcomes).prompt.canConfirm).toBe(true)

    composer.confirm()
    await flushMicrotasks()
    expect(outcomes.at(-1)).toEqual({
      kind: 'ready',
      action: { type: 'march', moves: [{ from: 0, to: 4, count: 1 }] },
    })
  })

  it('submits two moves after second count', async () => {
    const march = createMarchWorkflowHooks()
    const outcomes: ComposerOutcome[] = []
    march.setOnOutcome((outcome) => {
      outcomes.push(outcome)
    })
    const composer = new ActionComposer()
    composer.setHooks(march.hooks)

    composer.begin(
      makeActionSpec({
        type: 'march',
        params: {
          moves: [
            { from: 0, to: 4, count: 2 },
            { from: 4, to: 1, count: 1 },
          ],
        },
      }),
    )
    composer.chooseClearing(0)
    await flushMicrotasks()
    composer.chooseClearing(4)
    await flushMicrotasks()
    composer.chooseColumn('2')
    await flushMicrotasks()
    composer.chooseClearing(4)
    await flushMicrotasks()
    composer.chooseClearing(1)
    await flushMicrotasks()
    composer.chooseColumn('1')
    await flushMicrotasks()

    expect(outcomes.at(-1)).toEqual({
      kind: 'ready',
      action: {
        type: 'march',
        moves: [
          { from: 0, to: 4, count: 2 },
          { from: 4, to: 1, count: 1 },
        ],
      },
    })
  })

  it('second move can take warriors that arrived on first', async () => {
    const march = createMarchWorkflowHooks({
      warriorCountsForCurrentSeat: () =>
        new Map([
          [1, 1],
          [5, 1],
        ]),
    })
    const outcomes: ComposerOutcome[] = []
    march.setOnOutcome((outcome) => {
      outcomes.push(outcome)
    })
    const composer = new ActionComposer()
    composer.setHooks(march.hooks)

    composer.begin(
      makeActionSpec({
        type: 'march',
        params: {
          moves: [
            { from: 1, to: 5, count: 1 },
            { from: 5, to: 10, count: 1 },
            { from: 5, to: 1, count: 1 },
          ],
        },
      }),
    )
    composer.chooseClearing(1)
    await flushMicrotasks()
    composer.chooseClearing(5)
    await flushMicrotasks()
    composer.chooseColumn('1')
    await flushMicrotasks()
    composer.chooseClearing(5)
    await flushMicrotasks()
    composer.chooseClearing(10)
    await flushMicrotasks()
    expect(march.getPromptOptions()).toEqual([
      { label: '1 x warriors', value: '1' },
      { label: '2 x warriors', value: '2' },
    ])
    composer.chooseColumn('2')
    await flushMicrotasks()
    expect(outcomes.at(-1)).toEqual({
      kind: 'ready',
      action: {
        type: 'march',
        moves: [
          { from: 1, to: 5, count: 1 },
          { from: 5, to: 10, count: 2 },
        ],
      },
    })
  })

  it('Rule: 4.2.1 — after move into contested clearing, dest not 2nd origin', async () => {
    type TestPiece = { id: string; kind: string; owner: number }
    const clearings = Array.from(
      { length: 12 },
      (): { pieces: TestPiece[] } => ({ pieces: [] }),
    )
    clearings[2] = {
      pieces: [
        { id: 'm1', kind: 'warrior', owner: 0 },
        { id: 'm2', kind: 'warrior', owner: 0 },
      ],
    }
    clearings[6] = {
      pieces: [
        { id: 'e1', kind: 'warrior', owner: 1 },
        { id: 'e2', kind: 'warrior', owner: 1 },
      ],
    }
    const march = createMarchWorkflowHooks({
      warriorCountsForCurrentSeat: () => new Map([[2, 2]]),
      boardForMarch: () => ({
        clearings,
        factions: ['marquise', 'eyrie'],
        seat: 0,
        treatsRiversAsPaths: false,
      }),
    })
    const outcomes: ComposerOutcome[] = []
    march.setOnOutcome((outcome) => {
      outcomes.push(outcome)
    })
    const composer = new ActionComposer()
    composer.setHooks(march.hooks)

    composer.begin(
      makeActionSpec({
        type: 'march',
        params: {
          moves: [
            { from: 2, to: 6, count: 1 },
            { from: 2, to: 6, count: 2 },
          ],
        },
      }),
    )
    composer.chooseClearing(2)
    await flushMicrotasks()
    composer.chooseClearing(6)
    await flushMicrotasks()
    composer.chooseColumn('2')
    await flushMicrotasks()
    const afterFirst = lastIncomplete(outcomes)
    expect(afterFirst.prompt.highlightClearings).not.toContain(6)
    expect(afterFirst.prompt.canConfirm).toBe(true)

    composer.chooseClearing(6)
    await flushMicrotasks()
    const ignored = lastIncomplete(outcomes)
    expect(ignored.prompt.message).toContain('Confirm, or pick 2nd origin')
    expect(ignored.prompt.highlightClearings).not.toContain(6)
  })

  it('Rule: Boat Builders — 2nd march leg may use river (C11→C6 then C3→C6)', async () => {
    type TestPiece = { id: string; kind: string; owner: number; type?: string }
    const clearings = Array.from(
      { length: 12 },
      (): { pieces: TestPiece[] } => ({ pieces: [] }),
    )
    clearings[3] = { pieces: [{ id: 'm3', kind: 'warrior', owner: 0 }] }
    clearings[6] = {
      pieces: [
        { id: 'e1', kind: 'warrior', owner: 1 },
        { id: 'roost', kind: 'building', owner: 1, type: 'roost' },
      ],
    }
    clearings[11] = {
      pieces: [
        { id: 'm11a', kind: 'warrior', owner: 0 },
        { id: 'm11b', kind: 'warrior', owner: 0 },
        { id: 'm11c', kind: 'warrior', owner: 0 },
      ],
    }
    const march = createMarchWorkflowHooks({
      warriorCountsForCurrentSeat: () =>
        new Map([
          [3, 1],
          [11, 3],
        ]),
      boardForMarch: () => ({
        clearings,
        factions: ['marquise', 'eyrie'],
        seat: 0,
        treatsRiversAsPaths: true,
      }),
    })
    const outcomes: ComposerOutcome[] = []
    march.setOnOutcome((outcome) => {
      outcomes.push(outcome)
    })
    const composer = new ActionComposer()
    composer.setHooks(march.hooks)

    composer.begin(
      makeActionSpec({
        type: 'march',
        params: {
          moves: [
            { from: 11, to: 6, count: 2 },
            { from: 3, to: 6, count: 1 },
          ],
        },
      }),
    )
    composer.chooseClearing(11)
    await flushMicrotasks()
    composer.chooseClearing(6)
    await flushMicrotasks()
    composer.chooseColumn('2')
    await flushMicrotasks()

    const afterFirst = lastIncomplete(outcomes)
    expect(afterFirst.prompt.highlightClearings).toContain(3)

    composer.chooseClearing(3)
    await flushMicrotasks()
    const afterOrigin = lastIncomplete(outcomes)
    expect(afterOrigin.prompt.highlightClearings).toContain(6)

    composer.chooseClearing(6)
    await flushMicrotasks()
    composer.chooseColumn('1')
    await flushMicrotasks()

    expect(outcomes.at(-1)).toEqual({
      kind: 'ready',
      action: {
        type: 'march',
        moves: [
          { from: 11, to: 6, count: 2 },
          { from: 3, to: 6, count: 1 },
        ],
      },
    })
  })

  it('cancel after 1st move clears march even if card hooks merge first', async () => {
    const cards = createMarquiseCardComposerHooks()
    const march = createMarchWorkflowHooks()
    const composer = new ActionComposer()
    composer.setHooks(mergeComposerHooks(cards.hooks, march.hooks))

    composer.begin(
      makeActionSpec({
        type: 'march',
        params: {
          moves: [
            { from: 0, to: 4, count: 1 },
            { from: 0, to: 4, count: 2 },
          ],
        },
      }),
    )
    composer.chooseClearing(0)
    await flushMicrotasks()
    composer.chooseClearing(4)
    await flushMicrotasks()
    composer.chooseColumn('1')
    await flushMicrotasks()
    expect(march.isActive()).toBe(true)
    expect(march.getMarchPreviewMove()).toEqual({ from: 0, to: 4, count: 1 })

    expect(composer.cancel()).toEqual({ kind: 'idle' })
    expect(march.isActive()).toBe(false)
    expect(march.getMarchPreviewMove()).toBeNull()
  })
})
