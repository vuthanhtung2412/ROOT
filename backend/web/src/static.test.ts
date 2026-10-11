import { describe, expect, it } from 'vitest'
import { cacheControlForStaticPath } from '#static.js'

describe('cacheControlForStaticPath', () => {
  it('forces revalidation for index.html', () => {
    expect(cacheControlForStaticPath('index.html')).toBe('no-cache')
    expect(cacheControlForStaticPath('/public/index.html')).toBe('no-cache')
  })

  it('long-caches Vite hashed JS/CSS', () => {
    expect(
      cacheControlForStaticPath('/assets/index-Dw2Y3I9z.js'),
    ).toBe('public, max-age=31536000, immutable')
    expect(
      cacheControlForStaticPath('assets/style-aBcDeFgH.css'),
    ).toBe('public, max-age=31536000, immutable')
  })

  it('short-caches map and card images', () => {
    expect(
      cacheControlForStaticPath('assets/map/autumn-map.webp'),
    ).toBe('public, max-age=86400')
    expect(
      cacheControlForStaticPath('assets/cards/ambush-bird.png'),
    ).toBe('public, max-age=86400')
  })
})
