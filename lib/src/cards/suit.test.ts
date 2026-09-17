import { describe, expect, it } from 'vitest'
import { matchesSuit } from './suit.js'

describe('matchesSuit', () => {
  it('birds are wild', () => {
    const bird = { id: 'ROOT-200#1', defId: 'ROOT-200' }
    expect(matchesSuit(bird, 'fox')).toBe(true)
    expect(matchesSuit(bird, 'mouse')).toBe(true)
    expect(matchesSuit(bird, 'rabbit')).toBe(true)
  })

  it('non-bird matches only own suit', () => {
    const fox = { id: 'ROOT-202#1', defId: 'ROOT-202' } // Ambush fox
    expect(matchesSuit(fox, 'fox')).toBe(true)
    expect(matchesSuit(fox, 'mouse')).toBe(false)
  })
})
