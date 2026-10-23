import type { Context } from 'hono'
import { RuleError } from '@root/lib'

export type HttpErrorStatus = 400 | 403 | 404 | 409 | 503

export class HttpError extends Error {
  readonly status: HttpErrorStatus
  readonly code: string
  readonly detail: unknown

  constructor(status: HttpErrorStatus, code: string, detail?: unknown) {
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

/** Online mode: caller's player id does not own the seat that may act. */
export function notYourSeat(): never {
  throw new HttpError(403, 'NOT_YOUR_SEAT')
}

export function onError(err: Error, context: Context): Response {
  if (err instanceof HttpError) {
    return context.json(
      { code: err.code, detail: err.detail ?? null },
      err.status,
    )
  }
  if (err instanceof RuleError) {
    return context.json({ code: err.code, detail: err.detail ?? null }, 400)
  }
  console.error(err)
  return context.json({ code: 'INTERNAL_ERROR', detail: err.message }, 500)
}
