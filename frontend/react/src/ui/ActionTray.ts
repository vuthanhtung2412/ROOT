import type { ActionSpec, GameState } from '#api/client.ts'
import { lookupCardCatalog } from '#assets/gameAssets.ts'
import { readChoiceParams } from '#game/resolution/ActionComposer.ts'

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
  if (spec.type === 'resolveEvent') {
    const startingBuilding = params.building?.[0]
    if (startingBuilding !== undefined) {
      return `place ${startingBuilding}`
    }
    if (params.clearing !== undefined) {
      return 'choose keep'
    }
    if (params.leaders !== undefined) {
      return 'choose leader'
    }
    if (pendingType === 'fieldHospital') {
      if (params.decline !== undefined) {
        return 'Decline Field Hospitals'
      }
      if (params.cardIds !== undefined) {
        return 'Field Hospitals: pay'
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

/** Exported for unit tests. */
export { formatActionLabel }
