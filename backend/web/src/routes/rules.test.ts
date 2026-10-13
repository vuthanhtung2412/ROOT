import { describe, expect, it } from 'vitest'
import { app } from '#openapi.js'

describe('rules routes', () => {
  it('returns a numbered rule with its sub-rules as text', async () => {
    const response = await app.request('/game/rules?query=4.3')

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/plain')
    const text = await response.text()
    expect(text).toMatch(/^4\.3 Battle/)
    expect(text).toContain('4.3.1')
  })

  it('searches by keywords and says when nothing matches', async () => {
    const found = await app.request('/game/rules?query=ambush')
    const missing = await app.request('/game/rules?query=submarine')

    expect((await found.text()).toLowerCase()).toContain('ambush')
    expect(await missing.text()).toContain('No rule matches')
  })

  it('needs a query', async () => {
    const response = await app.request('/game/rules')

    expect(response.status).toBe(400)
  })
})
