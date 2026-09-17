import type { Context } from 'hono'
import { RuleError } from '@root/lib'

export class HttpError extends Error {
  readonly status: number
  readonly code: string
  readonly detail: unknown

  constructor(status: number, code: string, detail?: unknown) {
    super(code)
    this.name = 'HttpError'
    this.status = status
    this.code = code
    this.detail = detail
  }
}

export function noGame(): never {
  throw new HttpError(404, 'NO_GAME')
}

export function gameExists(): never {
  throw new HttpError(409, 'GAME_EXISTS')
}

export function onError(err: Error, c: Context): Response {
  if (err instanceof HttpError) {
    return c.json({ code: err.code, detail: err.detail ?? null }, err.status as 404 | 409)
  }
  if (err instanceof RuleError) {
    return c.json({ code: err.code, detail: err.detail ?? null }, 400)
  }
  console.error(err)
  return c.json({ code: 'INTERNAL_ERROR', detail: err.message }, 500)
}
