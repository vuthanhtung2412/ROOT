import { z } from 'zod'
import {
  ACTION_FIELD_SCHEMAS,
  actionSchema,
  isActionType,
  type ActionFieldSchema,
  type ActionFieldSchemas,
} from '#actions/actionSchemas.js'
import type { Action } from '#actions/types.js'
import { RuleError } from '#rules/RuleError.js'

/** What an action field may hold once it arrived as JSON from a client. */
export type ActionFieldValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | readonly ActionFieldValue[]
  | { readonly [fieldName: string]: ActionFieldValue }

const SHAPE_ALTERNATIVE_SEPARATOR = ' or '
const FIELD_SEPARATOR = ', '
const OPTIONAL_FIELD_MARK = '?'

/** The schema under `.nullish()`: what an optional field holds when present. */
function presentValueSchema(schema: ActionFieldSchema): ActionFieldSchema {
  if (schema instanceof z.ZodOptional || schema instanceof z.ZodNullable) {
    return presentValueSchema(schema.unwrap())
  }
  return schema
}

function isRequiredField(schema: ActionFieldSchema): boolean {
  return !(schema instanceof z.ZodOptional)
}

function describeShape(schema: ActionFieldSchema): string {
  const valueSchema: ActionFieldSchema = presentValueSchema(schema)
  if (valueSchema instanceof z.ZodString) {
    return 'text'
  }
  if (valueSchema instanceof z.ZodNumber) {
    return 'number'
  }
  if (valueSchema instanceof z.ZodBoolean) {
    return 'true or false'
  }
  if (valueSchema instanceof z.ZodArray) {
    return `list of ${describeShape(valueSchema.element)}`
  }
  if (valueSchema instanceof z.ZodObject) {
    return `{${describeFields(valueSchema.shape)}}`
  }
  if (valueSchema instanceof z.ZodUnion) {
    return valueSchema.options
      .map(describeShape)
      .join(SHAPE_ALTERNATIVE_SEPARATOR)
  }
  throw new Error(`no plain words for schema ${valueSchema._zod.def.type}`)
}

function describeFields(fields: ActionFieldSchemas): string {
  return Object.entries(fields)
    .map(
      ([fieldName, field]: [string, ActionFieldSchema]): string =>
        `${fieldName}${isRequiredField(field) ? '' : OPTIONAL_FIELD_MARK}: ${describeShape(field)}`,
    )
    .join(FIELD_SEPARATOR)
}

/**
 * The fields an action of `type` takes, as text: `{type: "discard", cardIds:
 * list of text}`. Null for a type the game does not know.
 *
 * `offeredFields` shortens an action of many optional fields (an answer to a
 * pending event) to the ones on offer; a required field is never left out.
 */
export function describeActionShape(
  type: string,
  offeredFields?: readonly string[],
): string | null {
  if (!isActionType(type)) {
    return null
  }
  const allFields: ActionFieldSchemas = ACTION_FIELD_SCHEMAS[type]
  const fields: string = describeFields(
    offeredFields === undefined
      ? allFields
      : Object.fromEntries(
          Object.entries(allFields).filter(
            ([fieldName, field]: [string, ActionFieldSchema]): boolean =>
              isRequiredField(field) || offeredFields.includes(fieldName),
          ),
        ),
  )
  return fields === ''
    ? `{type: "${type}"}`
    : `{type: "${type}", ${fields}}`
}

/** Name of the first field that is missing or holds the wrong kind of value. */
function malformedFieldName(action: Action): string | null {
  const issues: readonly z.core.$ZodIssue[] =
    actionSchema(action.type).safeParse(action).error?.issues ?? []
  if (issues.length === 0) {
    return null
  }
  const fieldName: PropertyKey | undefined = issues[0]?.path[0]
  return typeof fieldName === 'string' ? fieldName : 'type'
}

/**
 * Throws `MALFORMED_ACTION` when a field of the action is missing or holds the
 * wrong kind of value, so the rule checks never read a field that is not there.
 * Actions come from clients as JSON: their static type promises nothing.
 */
export function assertActionShape(action: Action): void {
  if (!isActionType(action.type)) {
    throw new RuleError('MALFORMED_ACTION', { field: 'type', action })
  }
  const field: string | null = malformedFieldName(action)
  if (field === null) {
    return
  }
  throw new RuleError('MALFORMED_ACTION', {
    field,
    expected: `{type: "${action.type}", ${describeFields(ACTION_FIELD_SCHEMAS[action.type])}}`,
    action,
  })
}
