import type { ActionSpec } from '#api/client.ts'

/** Client action payload submitted to POST /game/actions. */
export type ClientAction = {
  type: string
  [key: string]: unknown
}

export type ComposerPrompt = {
  message: string
  highlightClearings: number[]
  enabledCardIds: string[] | null
  canConfirm: boolean
  canCancel: boolean
}

export type ComposerOutcome =
  | { kind: 'idle' }
  | { kind: 'incomplete'; prompt: ComposerPrompt }
  | { kind: 'ready'; action: ClientAction }

export type ActionChoiceParamsView = {
  cardIds?: string[]
  birdCardIds?: string[]
  clearings?: number[]
  clearing?: number[]
  moves?: Array<{ from: number; to: number; count: number }>
  options?: unknown[]
  targets?: Array<{ clearing: number; defender: number }>
  columns?: string[]
  column?: string[]
  pieceIds?: string[]
  decline?: true[]
  useEffect?: boolean[]
  defender?: number[]
  order?: number[][]
  leaders?: string[]
  building?: string[]
  op?: Array<'move' | 'battle' | 'recruit' | 'organize'>
  forests?: number[]
  supporterIds?: string[]
}

export function readChoiceParams(
  spec: ActionSpec,
): ActionChoiceParamsView {
  const raw = spec.params
  if (raw === undefined) {
    return {}
  }
  const view: ActionChoiceParamsView = {}
  const cardIds = asStringArray(raw.cardIds)
  if (cardIds !== undefined) {
    view.cardIds = cardIds
  }
  const birdCardIds = asStringArray(raw.birdCardIds)
  if (birdCardIds !== undefined) {
    view.birdCardIds = birdCardIds
  }
  const clearings = asNumberArray(raw.clearings)
  if (clearings !== undefined) {
    view.clearings = clearings
  }
  const clearing = asNumberArray(raw.clearing)
  if (clearing !== undefined) {
    view.clearing = clearing
  }
  const moves = asMarchMoveArray(raw.moves)
  if (moves !== undefined) {
    view.moves = moves
  }
  if (Array.isArray(raw.options)) {
    view.options = raw.options
  }
  const targets = asBattleTargetArray(raw.targets)
  if (targets !== undefined) {
    view.targets = targets
  }
  const columns = asStringArray(raw.columns)
  if (columns !== undefined) {
    view.columns = columns
  }
  const column = asStringArray(raw.column)
  if (column !== undefined) {
    view.column = column
  }
  const pieceIds = asStringArray(raw.pieceIds)
  if (pieceIds !== undefined) {
    view.pieceIds = pieceIds
  }
  const decline = asTrueArray(raw.decline)
  if (decline !== undefined) {
    view.decline = decline
  }
  const useEffect = asBooleanArray(raw.useEffect)
  if (useEffect !== undefined) {
    view.useEffect = useEffect
  }
  const defender = asNumberArray(raw.defender)
  if (defender !== undefined) {
    view.defender = defender
  }
  const order = asSeatOrderArray(raw.order)
  if (order !== undefined) {
    view.order = order
  }
  const leaders = asStringArray(raw.leaders)
  if (leaders !== undefined) {
    view.leaders = leaders
  }
  const building = asStringArray(raw.building)
  if (building !== undefined) {
    view.building = building
  }
  const op = asMilitaryOpArray(raw.op)
  if (op !== undefined) {
    view.op = op
  }
  const forests = asNumberArray(raw.forests)
  if (forests !== undefined) {
    view.forests = forests
  }
  const supporterIds = asStringArray(raw.supporterIds)
  if (supporterIds !== undefined) {
    view.supporterIds = supporterIds
  }
  return view
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined
  }
  if (!value.every((entry) => typeof entry === 'string')) {
    return undefined
  }
  return value
}

const MILITARY_OPS = new Set(['move', 'battle', 'recruit', 'organize'])

function isMilitaryOp(
  value: string,
): value is 'move' | 'battle' | 'recruit' | 'organize' {
  return MILITARY_OPS.has(value)
}

function asMilitaryOpArray(
  value: unknown,
): Array<'move' | 'battle' | 'recruit' | 'organize'> | undefined {
  const strings = asStringArray(value)
  if (strings === undefined) return undefined
  if (!strings.every(isMilitaryOp)) return undefined
  return strings
}

function asNumberArray(value: unknown): number[] | undefined {
  if (!Array.isArray(value)) {
    return undefined
  }
  if (!value.every((entry) => typeof entry === 'number')) {
    return undefined
  }
  return value
}

function asBooleanArray(value: unknown): boolean[] | undefined {
  if (!Array.isArray(value)) {
    return undefined
  }
  if (!value.every((entry) => typeof entry === 'boolean')) {
    return undefined
  }
  return value
}

function asTrueArray(value: unknown): true[] | undefined {
  if (!Array.isArray(value)) {
    return undefined
  }
  if (!value.every((entry) => entry === true)) {
    return undefined
  }
  return value
}

function asMarchMoveArray(
  value: unknown,
): Array<{ from: number; to: number; count: number }> | undefined {
  if (!Array.isArray(value)) {
    return undefined
  }
  const moves: Array<{ from: number; to: number; count: number }> = []
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) {
      return undefined
    }
    const from = Reflect.get(entry, 'from')
    const to = Reflect.get(entry, 'to')
    const count = Reflect.get(entry, 'count')
    if (
      typeof from !== 'number' ||
      typeof to !== 'number' ||
      typeof count !== 'number'
    ) {
      return undefined
    }
    moves.push({ from, to, count })
  }
  return moves
}

function asBattleTargetArray(
  value: unknown,
): Array<{ clearing: number; defender: number }> | undefined {
  if (!Array.isArray(value)) {
    return undefined
  }
  const targets: Array<{ clearing: number; defender: number }> = []
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) {
      return undefined
    }
    const clearing = Reflect.get(entry, 'clearing')
    const defender = Reflect.get(entry, 'defender')
    if (typeof clearing !== 'number' || typeof defender !== 'number') {
      return undefined
    }
    targets.push({ clearing, defender })
  }
  return targets
}

function asSeatOrderArray(value: unknown): number[][] | undefined {
  if (!Array.isArray(value)) {
    return undefined
  }
  const orders: number[][] = []
  for (const entry of value) {
    if (!Array.isArray(entry)) {
      return undefined
    }
    if (!entry.every((seat) => typeof seat === 'number')) {
      return undefined
    }
    orders.push(entry)
  }
  return orders
}

/** Actions with no player choices — ready immediately. */
const IMMEDIATE_TYPES = new Set([
  'endPhase',
  'recruit',
  'turmoil',
  'birdsongWood',
  'eveningDraw',
  'emergencyOrders',
  'eveningScore',
  'refresh',
  'rest',
  'explore',
])

export type ActionComposerHooks = {
  begin?: (spec: ActionSpec) => ComposerOutcome | null
  chooseCard?: (cardId: string) => ComposerOutcome | null
  chooseClearing?: (clearingId: number) => ComposerOutcome | null
  chooseDefender?: (defenderSeat: number) => ComposerOutcome | null
  chooseColumn?: (column: string) => ComposerOutcome | null
  choosePiece?: (pieceId: string) => ComposerOutcome | null
  confirm?: () => ComposerOutcome | null
  cancel?: () => ComposerOutcome | null
}

/**
 * Staged action builder. UI feeds choices; composer emits Action JSON.
 * Faction-specific flows plug in via hooks (later commits).
 */
export class ActionComposer {
  private outcome: ComposerOutcome = { kind: 'idle' }
  private activeSpec: ActionSpec | null = null
  private hooks: ActionComposerHooks = {}

  setHooks(hooks: ActionComposerHooks): void {
    this.hooks = hooks
  }

  getOutcome(): ComposerOutcome {
    return this.outcome
  }

  getActiveSpec(): ActionSpec | null {
    return this.activeSpec
  }

  begin(spec: ActionSpec): ComposerOutcome {
    this.activeSpec = spec
    const hooked = this.hooks.begin?.(spec) ?? null
    if (hooked !== null) {
      this.outcome = hooked
      return this.outcome
    }

    if (IMMEDIATE_TYPES.has(spec.type)) {
      this.outcome = { kind: 'ready', action: { type: spec.type } }
      return this.outcome
    }

    const params = readChoiceParams(spec)

    if (
      (spec.type === 'craft' ||
        spec.type === 'spendBird' ||
        spec.type === 'discard') &&
      params.cardIds !== undefined
    ) {
      this.outcome = {
        kind: 'incomplete',
        prompt: {
          message: `Pick card for ${spec.type}`,
          highlightClearings: [],
          enabledCardIds: params.cardIds,
          canConfirm: false,
          canCancel: true,
        },
      }
      return this.outcome
    }

    this.outcome = {
      kind: 'incomplete',
      prompt: {
        message: `Unsupported action ${spec.type}`,
        highlightClearings: [],
        enabledCardIds: null,
        canConfirm: false,
        canCancel: true,
      },
    }
    return this.outcome
  }

  chooseCard(cardId: string): ComposerOutcome {
    const hooked = this.hooks.chooseCard?.(cardId) ?? null
    if (hooked !== null) {
      this.outcome = hooked
      return this.outcome
    }

    const spec = this.activeSpec
    if (spec === null) {
      return this.outcome
    }

    if (spec.type === 'craft' || spec.type === 'spendBird') {
      this.outcome = {
        kind: 'ready',
        action: { type: spec.type, cardId },
      }
      return this.outcome
    }

    if (spec.type === 'discard') {
      this.outcome = {
        kind: 'ready',
        action: { type: 'discard', cardIds: [cardId] },
      }
      return this.outcome
    }

    return this.outcome
  }

  chooseClearing(clearingId: number): ComposerOutcome {
    const hooked = this.hooks.chooseClearing?.(clearingId) ?? null
    if (hooked !== null) {
      this.outcome = hooked
      return this.outcome
    }
    return this.outcome
  }

  chooseDefender(defenderSeat: number): ComposerOutcome {
    const hooked = this.hooks.chooseDefender?.(defenderSeat) ?? null
    if (hooked !== null) {
      this.outcome = hooked
      return this.outcome
    }
    return this.outcome
  }

  chooseColumn(column: string): ComposerOutcome {
    const hooked = this.hooks.chooseColumn?.(column) ?? null
    if (hooked !== null) {
      this.outcome = hooked
      return this.outcome
    }
    return this.outcome
  }

  choosePiece(pieceId: string): ComposerOutcome {
    const hooked = this.hooks.choosePiece?.(pieceId) ?? null
    if (hooked !== null) {
      this.outcome = hooked
      return this.outcome
    }
    return this.outcome
  }

  confirm(): ComposerOutcome {
    const hooked = this.hooks.confirm?.() ?? null
    if (hooked !== null) {
      this.outcome = hooked
      return this.outcome
    }
    return this.outcome
  }

  cancel(): ComposerOutcome {
    const hooked = this.hooks.cancel?.() ?? null
    if (hooked !== null) {
      this.outcome = hooked
      return this.outcome
    }
    this.activeSpec = null
    this.outcome = { kind: 'idle' }
    return this.outcome
  }

  reset(): void {
    this.activeSpec = null
    this.outcome = { kind: 'idle' }
  }
}
