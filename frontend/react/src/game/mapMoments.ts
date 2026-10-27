import { numberField, readLoggedAction } from '#game/momentLogEntries.ts'

/**
 * Woodland moments played on the map itself, at their clearing: a ruin
 * giving up its item, a clearing rising up in a brawl.
 */

/** A Vagabond explored the ruin of a clearing. Rule: 9.5.3. */
export type BoardExploreEffect = {
  kind: 'explore'
  clearing: number
  /** The item the ruin gave up. */
  itemType: string
}

/** The Woodland Alliance revolted in a clearing. Rule: 8.4.1. */
export type BoardRevoltEffect = {
  kind: 'revolt'
  clearing: number
}

export type MapMomentEffect = BoardExploreEffect | BoardRevoltEffect

/** The part of a clearing the explored ruin is read from. */
export type MapMomentClearing = {
  ruin?: { items: readonly string[] }
}

export type MapMomentState = {
  id: string
  clearings: readonly MapMomentClearing[]
}

const EXPLORE_ACTION_TYPE = 'explore'
const BOT_EXPLORE_ACTION_TYPE = 'botExplore'
const REVOLT_ACTION_TYPE = 'revolt'
const BOT_REVOLT_ACTION_TYPE = 'botRevolt'

/** A bot explore names its clearing and item: it takes a random one. */
function botExploredRuin(action: object): BoardExploreEffect | null {
  const clearing: number | null = numberField(action, 'clearing')
  const itemType: unknown = Reflect.get(action, 'item')
  return clearing === null || typeof itemType !== 'string'
    ? null
    : { kind: 'explore', clearing, itemType }
}

/** The clearing whose ruin lost an item, with that item (the last one). */
function exploredRuin(
  previous: MapMomentState,
  next: MapMomentState,
): BoardExploreEffect | null {
  for (const [clearing, before] of previous.clearings.entries()) {
    const itemsBefore: readonly string[] = before.ruin?.items ?? []
    const itemsAfter: readonly string[] =
      next.clearings[clearing]?.ruin?.items ?? []
    const itemType: string | undefined = itemsBefore[itemsBefore.length - 1]
    if (itemType !== undefined && itemsAfter.length < itemsBefore.length) {
      return { kind: 'explore', clearing, itemType }
    }
  }
  return null
}

function entryEffect(
  previous: MapMomentState,
  next: MapMomentState,
  entry: unknown,
): MapMomentEffect | null {
  const logged = readLoggedAction(entry)
  if (logged === null) return null
  if (logged.actionType === EXPLORE_ACTION_TYPE) {
    return exploredRuin(previous, next)
  }
  if (logged.actionType === BOT_EXPLORE_ACTION_TYPE) {
    return botExploredRuin(logged.action)
  }
  if (
    logged.actionType === REVOLT_ACTION_TYPE ||
    logged.actionType === BOT_REVOLT_ACTION_TYPE
  ) {
    const clearing: number | null = numberField(logged.action, 'clearing')
    return clearing === null ? null : { kind: 'revolt', clearing }
  }
  return null
}

/**
 * Map moments one update's log entries tell, in log order. None for the
 * first state seen or another game.
 */
export function mapMomentEffectsBetween(
  previous: MapMomentState | null,
  next: MapMomentState,
  newLogEntries: readonly unknown[],
): MapMomentEffect[] {
  if (previous === null || previous.id !== next.id) return []
  return newLogEntries.flatMap((entry: unknown): MapMomentEffect[] => {
    const effect: MapMomentEffect | null = entryEffect(previous, next, entry)
    return effect === null ? [] : [effect]
  })
}

export function isMapMomentEffect(effect: {
  kind: string
}): effect is MapMomentEffect {
  return effect.kind === EXPLORE_ACTION_TYPE || effect.kind === REVOLT_ACTION_TYPE
}
