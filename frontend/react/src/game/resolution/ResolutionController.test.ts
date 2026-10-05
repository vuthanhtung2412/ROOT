import { describe, expect, it, vi } from 'vitest'
import {
  isResolutionCancelled,
  ResolutionController,
} from '#game/resolution/ResolutionController.ts'
import { ResolutionCancelled } from '#game/resolution/ResolutionUi.ts'

describe('ResolutionController', () => {
  it('paints then resolves pickClearing', async () => {
    const onPaint = vi.fn()
    const controller = new ResolutionController({ onPaint })
    controller.beginSession()

    const pending = controller.pickClearing({
      message: 'pick origin',
      clearings: [0, 4],
      canCancel: true,
    })
    expect(onPaint).toHaveBeenCalledWith({
      prompt: {
        message: 'pick origin',
        highlightClearings: [0, 4],
        enabledCardIds: null,
        canConfirm: false,
        canCancel: true,
      },
      options: [],
    })
    expect(controller.isActive()).toBe(true)

    const outcome = controller.chooseClearing(0)
    expect(outcome?.kind).toBe('incomplete')
    await expect(pending).resolves.toEqual({ kind: 'clearing', clearingId: 0 })
  })

  it('ignores clearing outside allowed set', async () => {
    const controller = new ResolutionController({ onPaint: () => undefined })
    controller.beginSession()
    const pending = controller.pickClearing({
      message: 'pick',
      clearings: [1],
    })
    expect(controller.chooseClearing(9)?.kind).toBe('incomplete')
    controller.chooseClearing(1)
    await expect(pending).resolves.toEqual({ kind: 'clearing', clearingId: 1 })
  })

  it('confirm resolves when allowed', async () => {
    const controller = new ResolutionController({ onPaint: () => undefined })
    controller.beginSession()
    const pending = controller.pickClearing({
      message: 'confirm or pick',
      clearings: [2],
      canConfirm: true,
    })
    controller.confirm()
    await expect(pending).resolves.toEqual({ kind: 'confirm' })
  })

  it('cancel rejects with ResolutionCancelled', async () => {
    const controller = new ResolutionController({ onPaint: () => undefined })
    controller.beginSession()
    const pending = controller.pickClearing({
      message: 'pick',
      clearings: [0],
    })
    expect(controller.cancel()).toEqual({ kind: 'idle' })
    expect(controller.isActive()).toBe(false)
    await expect(pending).rejects.toBeInstanceOf(ResolutionCancelled)
    await pending.catch((error: unknown) => {
      expect(isResolutionCancelled(error)).toBe(true)
    })
  })

  it('pickOption resolves allowed value', async () => {
    const controller = new ResolutionController({ onPaint: () => undefined })
    controller.beginSession()
    const pending = controller.pickOption({
      message: 'how many',
      clearings: [0, 4],
      options: [
        { label: '1 x warriors', value: '1' },
        { label: '2 x warriors', value: '2' },
      ],
    })
    expect(controller.getPromptOptions()).toHaveLength(2)
    controller.chooseOption('2')
    await expect(pending).resolves.toBe('2')
  })

  it('setMarchPreview exposed for board paint', () => {
    const controller = new ResolutionController({ onPaint: () => undefined })
    controller.beginSession()
    controller.setMarchPreview({ from: 0, to: 4, count: 1 })
    expect(controller.getMarchPreviewMove()).toEqual({
      from: 0,
      to: 4,
      count: 1,
    })
  })
})
