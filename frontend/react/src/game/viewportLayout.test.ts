import { describe, expect, it } from 'vitest'
import {
  portraitMapHostSize,
  resolveViewportLayoutMode,
} from '#game/viewportLayout.ts'

describe('resolveViewportLayoutMode', () => {
  it('marks taller viewports as portrait', () => {
    expect(resolveViewportLayoutMode(390, 844)).toBe('portrait')
    expect(resolveViewportLayoutMode(768, 1024)).toBe('portrait')
  })

  it('marks wider viewports as landscape', () => {
    expect(resolveViewportLayoutMode(1280, 720)).toBe('landscape')
    expect(resolveViewportLayoutMode(844, 390)).toBe('landscape')
  })
})

describe('portraitMapHostSize', () => {
  it('reserves top and bottom chrome insets', () => {
    const host = portraitMapHostSize({ width: 390, height: 844 })
    expect(host.width).toBe(370)
    expect(host.height).toBe(516)
  })
})
