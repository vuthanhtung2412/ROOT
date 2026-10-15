import { api } from '#api/client.js'

const JSON_INDENT = 2

/** Legal action types in plain words: kind, Law of Root rules, JSON Schema. */
export async function cmdExplain(): Promise<void> {
  const { actions } = await api.explainedActions()
  console.log(JSON.stringify(actions, null, JSON_INDENT))
}
