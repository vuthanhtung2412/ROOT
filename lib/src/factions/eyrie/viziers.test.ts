import { describe, expect, it } from 'vitest'
import { isVizier, makeViziers, VIZIER_DEF, VIZIER_DEF_ID } from './viziers.js'

describe('eyrie viziers', () => {
  it('makes two synthetic bird vizier cards', () => {
    const [a, b] = makeViziers()
    expect(a.id).toBe('vizier-0')
    expect(b.id).toBe('vizier-1')
    expect(a.defId).toBe(VIZIER_DEF_ID)
    expect(isVizier(a)).toBe(true)
    expect(VIZIER_DEF.suit).toBe('bird')
  })
})
