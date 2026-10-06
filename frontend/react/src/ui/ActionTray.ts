import type { ActionSpec, GameState } from '#api/client.ts'
import { lookupCardCatalog } from '#assets/gameAssets.ts'
import { pendingEventType } from '#game/expansionPendingPrompts.ts'
import { readChoiceParams } from '#game/resolution/ActionComposer.ts'
import { QUEST_ACTION_TYPE } from '#game/vagabondQuest.ts'
import { REARRANGE_ACTION_TYPE } from '#game/vagabondRearrange.ts'

export type ActionTraySyncOptions = {
  lockToActionTypes?: readonly string[]
  /** Hide tray and clear buttons (e.g. while march is staged). */
  disabled?: boolean
}

export interface ActionTrayState {
  actions: readonly ActionSpec[]
  actorSeat: number
  pending?: unknown
  options?: ActionTraySyncOptions | undefined
  state?: GameState
}

const VIZIER_DEF_ID = 'VIZIER'

/** Tray labels for Lizard Cult and Riverfolk Company actions. */
const EXPANSION_ACTION_LABELS: Readonly<Record<string, string>> = {
  crusadeBattle: 'crusade: battle',
  crusadeMove: 'crusade: move',
  skipCrusadeBattle: 'skip battle',
  convert: 'convert',
  sanctify: 'sanctify',
  ritualBuild: 'build garden',
  ritualRecruit: 'recruit',
  ritualScore: 'score',
  ritualSacrifice: 'sacrifice',
  riverfolkMove: 'move',
  riverfolkBattle: 'battle',
  riverfolkCraft: 'craft',
  riverfolkDraw: 'draw',
  riverfolkRecruit: 'recruit',
  establishTradePost: 'trade post',
  setServiceCosts: 'set costs',
}

function formatActionLabel(
  spec: ActionSpec,
  pending?: unknown,
  state?: GameState,
): string {
  const params = readChoiceParams(spec)
  const pendingType =
    typeof pending === 'object' && pending !== null
      ? Reflect.get(pending, 'type')
      : undefined
  if (spec.type === 'decree') {
    const column = params.column?.[0]
    const cardId = params.cardIds?.[0]
    const suit = cardId !== undefined ? decreeCardSuit(cardId, state) : null
    if (column !== undefined && suit !== null) {
      return `${column}: ${suit}`
    }
    return column !== undefined ? column : 'decree'
  }
  if (spec.type === 'addToDecree') return 'add to decree'
  if (spec.type === 'revolt') return 'revolt'
  if (spec.type === 'spreadSympathy') return 'spread sympathy'
  if (spec.type === 'mobilize') return 'mobilize'
  if (spec.type === 'train') return 'train'
  if (spec.type === 'militaryOp') {
    const op = params.op?.[0]
    return op !== undefined ? `op: ${op}` : 'military op'
  }
  if (spec.type === 'refresh') return 'refresh'
  if (spec.type === 'slip') return 'slip'
  if (spec.type === 'vbMove') return 'move'
  if (spec.type === 'vbBattle') return 'battle'
  if (spec.type === 'explore') return 'explore'
  if (spec.type === 'quest') return 'quest'
  if (spec.type === 'takeDominance') return 'take dominance'
  if (spec.type === 'activateDominance') return 'activate dominance'
  if (spec.type === 'aid') return 'aid'
  if (spec.type === 'strike') return 'strike'
  if (spec.type === 'repair') return 'repair'
  if (spec.type === 'vbCraft') return 'craft'
  if (spec.type === 'steal') return 'steal'
  if (spec.type === 'dayLabor') return 'day labor'
  if (spec.type === 'hideout') return 'hideout'
  if (spec.type === 'vbRemoveItems') return 'remove items'
  if (spec.type === 'rest') return 'rest'
  if (spec.type === 'spendBird') return 'spend bird'
  if (spec.type === 'eveningDraw') return 'draw'
  if (spec.type === 'endPhase') return 'end phase'
  if (spec.type === 'overwork') return 'overwork'
  const expansionLabel = EXPANSION_ACTION_LABELS[spec.type]
  if (expansionLabel !== undefined) return expansionLabel
  if (spec.type === 'resolveEvent') {
    if (pendingType === 'buyServices') {
      return params.decline !== undefined ? 'skip service' : 'buy service'
    }
    const startingBuilding = params.building?.[0]
    if (startingBuilding !== undefined) {
      return `place ${startingBuilding}`
    }
    if (params.clearing !== undefined) {
      return 'choose keep'
    }
    if (params.forests !== undefined) {
      return 'choose forest'
    }
    if (params.leaders !== undefined) {
      return 'choose leader'
    }
    if (params.characters !== undefined) {
      return 'choose character'
    }
    if (params.vagabondItems !== undefined) {
      return 'damage items'
    }
    if (pendingType === 'fieldHospital') {
      if (params.decline !== undefined) {
        return 'Decline Field Hospitals'
      }
      if (params.cardIds !== undefined) {
        return 'Field Hospitals: pay'
      }
    }
    if (pendingType === 'outrage') {
      if (params.decline !== undefined) {
        return 'Outrage: reveal'
      }
      if (params.cardIds !== undefined) {
        return 'Outrage: give card'
      }
    }
    if (params.decline !== undefined) {
      return 'skip ambush'
    }
    if (params.cardIds !== undefined) {
      return 'play ambush'
    }
    if (params.pieceIds !== undefined) {
      return `remove hits`
    }
    if (params.useEffect !== undefined) {
      const only = params.useEffect[0]
      if (params.useEffect.length === 1 && only === true) {
        return 'use effect'
      }
      if (params.useEffect.length === 1 && only === false) {
        return 'skip effect'
      }
      return 'battle effect'
    }
    if (params.order !== undefined) {
      return 'effects order'
    }
    return 'resolveEvent'
  }
  return spec.type
}

const DECREE_ACTION_TYPE = 'decree'

/** What a tray medallion draws: an icon key and, for a card play, its suit. */
export type TrayActionArt = {
  /** Key for `actionIconFor`: the action type, or the Decree column. */
  iconKey: string
  suit: string | null
}

const RESOLVE_EVENT_ACTION_TYPE = 'resolveEvent'
const BUY_SERVICES_PENDING_TYPE = 'buyServices'
/** Icon keys of the answers to a pending event (all are `resolveEvent`). */
export const DECLINE_ICON_KEY = 'declineEvent'
export const BUY_SERVICE_ICON_KEY = 'buyService'
export const DECLINE_SERVICE_ICON_KEY = 'declineService'
export const REMOVE_HITS_ICON_KEY = 'removeHits'

/** Answers to one pending event share a type: tell them apart by what they send. */
function resolveEventIconKey(spec: ActionSpec, pending: unknown): string {
  const params = readChoiceParams(spec)
  const isBuyingServices: boolean =
    pendingEventType(pending) === BUY_SERVICES_PENDING_TYPE
  if (params.decline !== undefined) {
    return isBuyingServices ? DECLINE_SERVICE_ICON_KEY : DECLINE_ICON_KEY
  }
  if (isBuyingServices) {
    return BUY_SERVICE_ICON_KEY
  }
  if (params.pieceIds !== undefined) {
    return REMOVE_HITS_ICON_KEY
  }
  return spec.type
}

/**
 * Decree: icon of the column, suit of the card. Pending event: icon of the
 * answer. Others: icon of the type.
 */
export function trayActionArt(
  spec: ActionSpec,
  state?: GameState,
  pending?: unknown,
): TrayActionArt {
  if (spec.type === RESOLVE_EVENT_ACTION_TYPE) {
    return { iconKey: resolveEventIconKey(spec, pending), suit: null }
  }
  if (spec.type !== DECREE_ACTION_TYPE) {
    return { iconKey: spec.type, suit: null }
  }
  const params = readChoiceParams(spec)
  const cardId: string | undefined = params.cardIds?.[0]
  return {
    iconKey: params.column?.[0] ?? spec.type,
    suit: cardId !== undefined ? decreeCardSuit(cardId, state) : null,
  }
}

function decreeCardSuit(cardId: string, state?: GameState): string | null {
  const fromState = findCardDefIdInState(cardId, state)
  const defId = fromState ?? parseDefIdFromCardId(cardId)
  if (defId === null) {
    return null
  }
  if (defId === VIZIER_DEF_ID) {
    return 'bird'
  }
  return lookupCardCatalog(defId)?.suit ?? null
}

function parseDefIdFromCardId(cardId: string): string | null {
  const hashIndex = cardId.indexOf('#')
  if (hashIndex <= 0) {
    return null
  }
  return cardId.slice(0, hashIndex)
}

function findCardDefIdInState(cardId: string, state?: GameState): string | null {
  if (state === undefined) {
    return null
  }
  for (const player of state.players) {
    for (const card of player.hand) {
      if (card.id === cardId) {
        return card.defId
      }
    }
    const defIdFromBoard = findCardDefIdOnEyrieDecree(player.board, cardId)
    if (defIdFromBoard !== null) {
      return defIdFromBoard
    }
  }
  return null
}

function findCardDefIdOnEyrieDecree(board: unknown, cardId: string): string | null {
  if (typeof board !== 'object' || board === null) {
    return null
  }
  if (Reflect.get(board, 'kind') !== 'eyrie') {
    return null
  }
  const decree = Reflect.get(board, 'decree')
  if (typeof decree !== 'object' || decree === null) {
    return null
  }
  for (const columnCards of Object.values(decree)) {
    if (!Array.isArray(columnCards)) {
      continue
    }
    for (const entry of columnCards) {
      if (typeof entry !== 'object' || entry === null) {
        continue
      }
      const id = Reflect.get(entry, 'id')
      const defId = Reflect.get(entry, 'defId')
      if (id === cardId && typeof defId === 'string') {
        return defId
      }
    }
  }
  return null
}

/** Vagabond actions started by clicking a piece on the faction board. */
const BOARD_ONLY_ACTION_TYPES: ReadonlySet<string> = new Set([
  REARRANGE_ACTION_TYPE,
  QUEST_ACTION_TYPE,
])

/**
 * Actions taken on the faction board, not from a tray button
 * (Vagabond moves items and claims quests by clicking them).
 */
export function withoutBoardOnlyActions(
  actions: readonly ActionSpec[],
): ActionSpec[] {
  return actions.filter((spec) => !BOARD_ONLY_ACTION_TYPES.has(spec.type))
}

export function filterTrayActions(
  actions: readonly ActionSpec[],
  actorSeat: number,
  options?: ActionTraySyncOptions,
): ActionSpec[] {
  if (options?.disabled === true) {
    return []
  }
  const lockTypes = options?.lockToActionTypes
  return actions.filter((spec) => {
    if (spec.actor !== actorSeat) {
      return false
    }
    if (lockTypes !== undefined && !lockTypes.includes(spec.type)) {
      return false
    }
    return true
  })
}

/**
 * Turn-control / budget helpers sit apart from the main action choices
 * (e.g. Marquise daylight: battle/build/… vs spend bird + end phase).
 */
const TRAY_META_ACTION_TYPES: ReadonlySet<string> = new Set([
  'spendBird',
  'endPhase',
  'eveningDraw',
])

export type TrayActionRegion = {
  readonly id: 'actions' | 'meta'
  readonly title: string
  readonly actions: readonly ActionSpec[]
}

/**
 * Split collapsed tray specs into primary choices vs turn meta.
 * Empty regions are omitted.
 * Marquise daylight: title shows action budget left, not button count.
 */
export function partitionTrayActionRegions(
  actions: readonly ActionSpec[],
  state?: GameState,
): TrayActionRegion[] {
  const primary: ActionSpec[] = []
  const meta: ActionSpec[] = []
  for (const spec of actions) {
    if (TRAY_META_ACTION_TYPES.has(spec.type)) {
      meta.push(spec)
    } else {
      primary.push(spec)
    }
  }
  const regions: TrayActionRegion[] = []
  if (primary.length > 0) {
    regions.push({
      id: 'actions',
      title: primaryActionsRegionTitle(primary.length, state),
      actions: primary,
    })
  }
  if (meta.length > 0) {
    regions.push({
      id: 'meta',
      title: meta.length === 1 ? 'Turn' : `Turn (${String(meta.length)})`,
      actions: meta,
    })
  }
  return regions
}

/**
 * Short count beside the phase name in the tray header: the Marquise
 * Daylight budget left, otherwise the number of buttons.
 */
export function trayActionCountLabel(
  buttonCount: number,
  state: GameState | undefined,
): string {
  const actionsLeft = marquiseDaylightActionsLeft(state)
  if (actionsLeft !== null) {
    return `${String(actionsLeft)} left`
  }
  return buttonCount === 1 ? '1 action' : `${String(buttonCount)} actions`
}

function primaryActionsRegionTitle(
  buttonCount: number,
  state: GameState | undefined,
): string {
  const actionsLeft = marquiseDaylightActionsLeft(state)
  if (actionsLeft !== null) {
    return `Actions · ${String(actionsLeft)} left`
  }
  return `Actions (${String(buttonCount)})`
}

/** Marquise Daylight action budget (actionsLeft + spend-bird extras). */
function marquiseDaylightActionsLeft(state: GameState | undefined): number | null {
  if (state === undefined) {
    return null
  }
  if (state.phase !== 'daylight' || state.step !== 'actions') {
    return null
  }
  const actor = state.players.find((player) => player.seat === state.currentSeat)
  if (actor?.faction !== 'marquise') {
    return null
  }
  const scratch = state.turnScratch
  if (typeof scratch !== 'object' || scratch === null) {
    return null
  }
  const actionsLeft = Reflect.get(scratch, 'actionsLeft')
  const extraActions = Reflect.get(scratch, 'extraActions')
  if (typeof actionsLeft !== 'number' || typeof extraActions !== 'number') {
    return null
  }
  return actionsLeft + extraActions
}

/**
 * One tray button per label: merge duplicate specs (e.g. many `aid` /
 * `battle` targets) so Marquise daylight / Vagabond satchel stay readable.
 */
export function collapseTrayActionsByLabel(
  actions: readonly ActionSpec[],
  pending?: unknown,
  state?: GameState,
): ActionSpec[] {
  const groups = new Map<string, ActionSpec[]>()
  const order: string[] = []
  for (const spec of actions) {
    const label = formatActionLabel(spec, pending, state)
    const key = `${spec.type}::${label}`
    const existing = groups.get(key)
    if (existing === undefined) {
      groups.set(key, [spec])
      order.push(key)
      continue
    }
    existing.push(spec)
  }
  return order.map((key) => {
    const group = groups.get(key)
    if (group === undefined || group.length === 0) {
      throw new Error(`missing tray group ${key}`)
    }
    if (group.length === 1) {
      return group[0]!
    }
    return mergeActionSpecs(group)
  })
}

function mergeActionSpecs(specs: readonly ActionSpec[]): ActionSpec {
  const first = specs[0]
  if (first === undefined) {
    throw new Error('mergeActionSpecs requires at least one spec')
  }
  const mergedParams: Record<string, unknown[]> = {}
  for (const spec of specs) {
    if (spec.params === undefined) {
      continue
    }
    for (const [key, value] of Object.entries(spec.params)) {
      if (!Array.isArray(value)) {
        continue
      }
      const bucket = mergedParams[key] ?? []
      for (const entry of value) {
        if (!paramEntryAlreadyPresent(bucket, entry)) {
          bucket.push(entry)
        }
      }
      mergedParams[key] = bucket
    }
  }
  return {
    type: first.type,
    actor: first.actor,
    params: mergedParams,
  }
}

function paramEntryAlreadyPresent(
  bucket: readonly unknown[],
  entry: unknown,
): boolean {
  if (typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean') {
    return bucket.includes(entry)
  }
  if (typeof entry !== 'object' || entry === null) {
    return false
  }
  const serialized = JSON.stringify(entry)
  return bucket.some(
    (existing) =>
      typeof existing === 'object' &&
      existing !== null &&
      JSON.stringify(existing) === serialized,
  )
}

/** Exported for unit tests. */
export { formatActionLabel }
