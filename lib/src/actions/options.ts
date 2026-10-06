/**
 * One complete legal payload of an action (every field but `type`).
 * Specs list them in `params.options`; the client picks one field at a time.
 */
export type ActionOption = Record<string, string | number | boolean>

type OptionValue = ActionOption[string]

function isOptionValue(value: unknown): value is OptionValue {
  return (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  )
}

const ACTION_TYPE_FIELD = 'type'

/** Payload fields of an action, without its `type`. */
function payloadEntries(action: object): Array<[string, unknown]> {
  const entries: Array<[string, unknown]> = Object.entries(action)
  return entries.filter(
    ([field, value]: [string, unknown]): boolean =>
      field !== ACTION_TYPE_FIELD && value !== undefined,
  )
}

/** True when the action payload equals one of the listed options exactly. */
export function actionMatchesOption(
  action: object,
  options: readonly ActionOption[],
): boolean {
  const payload = payloadEntries(action)
  return options.some((option: ActionOption): boolean => {
    if (Object.keys(option).length !== payload.length) return false
    return payload.every(
      ([field, value]: [string, unknown]): boolean =>
        isOptionValue(value) && option[field] === value,
    )
  })
}

function isActionOption(value: unknown): value is ActionOption {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }
  return Object.values(value).every(isOptionValue)
}

/** Options listed on a spec, ignoring the paired shapes older actions use. */
export function actionOptionsOf(
  options: readonly unknown[] | undefined,
): ActionOption[] {
  return (options ?? []).filter(isActionOption)
}
