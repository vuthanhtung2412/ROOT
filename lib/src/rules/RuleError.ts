export class RuleError extends Error {
  readonly code: string
  readonly detail: unknown

  constructor(code: string, detail?: unknown) {
    super(code)
    this.name = 'RuleError'
    this.code = code
    this.detail = detail
  }
}
