import type { ActionSpec } from '#api/client.ts'
import {
  readChoiceParams,
  type ActionComposerHooks,
  type ClientAction,
  type ComposerOutcome,
} from '#game/resolution/ActionComposer.ts'
import { clearingRuler } from '#game/clearingRuler.ts'
import { fallAdjacentClearings } from '#game/fallPaths.ts'
import {
  applyMarchMovesToClearings,
  type ClearingPiecesSnapshot,
} from '#game/resolution/marchClearingsPreview.ts'

type OverworkOption = { cardId: string; clearing: number }

type MarquiseCardDraft =
  | { type: 'idle' }
  | {
      type: 'overwork'
      options: OverworkOption[]
      cardId: string | null
    }
  | {
      type: 'discardMany'
      cardIds: string[]
      selected: string[]
    }

function isOverworkOption(value: unknown): value is OverworkOption {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const cardId = Reflect.get(value, 'cardId')
  const clearing = Reflect.get(value, 'clearing')
  return typeof cardId === 'string' && typeof clearing === 'number'
}

/**
 * Marquise card flows: craft / spendBird / discard / overwork (paired).
 * Shared craft/discard paths also usable when Eyrie seat has those specs.
 */
export function createMarquiseCardComposerHooks(): {
  hooks: ActionComposerHooks
  getDraft: () => MarquiseCardDraft
} {
  let draft: MarquiseCardDraft = { type: 'idle' }

  const hooks: ActionComposerHooks = {
    begin: (spec: ActionSpec): ComposerOutcome | null => {
      if (spec.type === 'overwork') {
        const params = readChoiceParams(spec)
        const options = (params.options ?? []).filter(isOverworkOption)
        draft = { type: 'overwork', options, cardId: null }
        return {
          kind: 'incomplete',
          prompt: {
            message: 'Overwork — pick matching card',
            highlightClearings: [],
            enabledCardIds: options.map((option) => option.cardId),
            canConfirm: false,
            canCancel: true,
          },
        }
      }

      if (spec.type === 'discard') {
        const params = readChoiceParams(spec)
        const cardIds = params.cardIds ?? []
        draft = { type: 'discardMany', cardIds, selected: [] }
        return {
          kind: 'incomplete',
          prompt: {
            message: 'Discard down to 5 — pick cards, then Confirm',
            highlightClearings: [],
            enabledCardIds: cardIds,
            canConfirm: false,
            canCancel: true,
          },
        }
      }

      // craft / spendBird fall through to ActionComposer core
      draft = { type: 'idle' }
      return null
    },

    chooseCard: (cardId: string): ComposerOutcome | null => {
      if (draft.type === 'overwork') {
        const matches = draft.options.filter((option) => option.cardId === cardId)
        if (matches.length === 0) {
          return null
        }
        draft = { ...draft, cardId }
        return {
          kind: 'incomplete',
          prompt: {
            message: 'Overwork — pick sawmill clearing',
            highlightClearings: matches.map((option) => option.clearing),
            enabledCardIds: [cardId],
            canConfirm: false,
            canCancel: true,
          },
        }
      }

      if (draft.type === 'discardMany') {
        const selected = draft.selected.includes(cardId)
          ? draft.selected.filter((id) => id !== cardId)
          : [...draft.selected, cardId]
        draft = { ...draft, selected }
        return {
          kind: 'incomplete',
          prompt: {
            message: `Discard ${String(selected.length)} card(s) — Confirm when ready`,
            highlightClearings: [],
            enabledCardIds: draft.cardIds,
            canConfirm: selected.length > 0,
            canCancel: true,
          },
        }
      }

      return null
    },

    chooseClearing: (clearingId: number): ComposerOutcome | null => {
      if (draft.type !== 'overwork' || draft.cardId === null) {
        return null
      }
      const selectedCardId = draft.cardId
      const match = draft.options.find(
        (option) =>
          option.cardId === selectedCardId && option.clearing === clearingId,
      )
      if (match === undefined) {
        return null
      }
      const action: ClientAction = {
        type: 'overwork',
        cardId: match.cardId,
        clearing: match.clearing,
      }
      draft = { type: 'idle' }
      return { kind: 'ready', action }
    },

    confirm: (): ComposerOutcome | null => {
      if (draft.type !== 'discardMany' || draft.selected.length === 0) {
        return null
      }
      const action: ClientAction = {
        type: 'discard',
        cardIds: draft.selected,
      }
      draft = { type: 'idle' }
      return { kind: 'ready', action }
    },

    cancel: (): ComposerOutcome | null => {
      if (draft.type === 'idle') {
        return null
      }
      draft = { type: 'idle' }
      return { kind: 'idle' }
    },
  }

  return {
    hooks,
    getDraft: () => draft,
  }
}

type MarchMove = { from: number; to: number; count: number }

type MarchPicking =
  | 'firstFrom'
  | 'firstTo'
  | 'firstCount'
  | 'secondFrom'
  | 'secondTo'
  | 'secondCount'

type MarchBoardSnapshot = {
  clearings: ClearingPiecesSnapshot[]
  factions: readonly string[]
  seat: number
}

type MarchDraft =
  | { type: 'idle' }
  | {
      type: 'march'
      legalMoves: MarchMove[]
      /** Warrior counts before any march move (current seat). */
      initialCounts: Map<number, number>
      /** Board at march begin — used to rule-check second leg (4.2.1). */
      boardSnapshot: MarchBoardSnapshot | null
      picking: MarchPicking
      firstMove: MarchMove | null
      from: number | null
      to: number | null
    }

export type MarchBoardSource = {
  warriorCountsForCurrentSeat: () => Map<number, number>
  /** Live board pieces for sequential march rule checks. */
  boardForMarch?: () => MarchBoardSnapshot | null
}

function unique(values: number[]): number[] {
  return [...new Set(values)]
}

function countsFromLegalMoves(legalMoves: MarchMove[]): Map<number, number> {
  const counts = new Map<number, number>()
  for (const move of legalMoves) {
    counts.set(move.from, Math.max(counts.get(move.from) ?? 0, move.count))
  }
  return counts
}

/** Apply one march leg to warrior counts (6.5.2 sequential). */
export function warriorCountsAfterMove(
  before: ReadonlyMap<number, number>,
  move: MarchMove,
): Map<number, number> {
  const next = new Map(before)
  next.set(move.from, (next.get(move.from) ?? 0) - move.count)
  next.set(move.to, (next.get(move.to) ?? 0) + move.count)
  return next
}

/** Adjacent march legs from warrior counts only (no rule check). */
export function legalMarchLegsFromCounts(
  counts: ReadonlyMap<number, number>,
): MarchMove[] {
  const moves: MarchMove[] = []
  for (const [from, available] of counts) {
    if (available < 1) {
      continue
    }
    for (const to of fallAdjacentClearings(from)) {
      for (let count = 1; count <= available; count += 1) {
        moves.push({ from, to, count })
      }
    }
  }
  return moves
}

/** Rule: 4.2.1 — must rule origin and/or destination. */
function marchLegRulesOriginOrDestination(
  clearings: readonly ClearingPiecesSnapshot[],
  factions: readonly string[],
  seat: number,
  move: MarchMove,
): boolean {
  const fromClearing = clearings[move.from]
  const toClearing = clearings[move.to]
  if (fromClearing === undefined || toClearing === undefined) {
    return false
  }
  return (
    clearingRuler(fromClearing, factions) === seat ||
    clearingRuler(toClearing, factions) === seat
  )
}

function activeLegs(draft: Extract<MarchDraft, { type: 'march' }>): MarchMove[] {
  if (draft.firstMove === null) {
    return draft.legalMoves
  }
  const afterFirstCounts = warriorCountsAfterMove(
    draft.initialCounts,
    draft.firstMove,
  )
  const adjacencyLegs = legalMarchLegsFromCounts(afterFirstCounts)
  const board = draft.boardSnapshot
  if (board === null) {
    return adjacencyLegs
  }
  const clearingsAfterFirst = applyMarchMovesToClearings(
    board.clearings,
    board.seat,
    [draft.firstMove],
  )
  return adjacencyLegs.filter((move) =>
    marchLegRulesOriginOrDestination(
      clearingsAfterFirst,
      board.factions,
      board.seat,
      move,
    ),
  )
}

/**
 * Compound March (6.5.2): each move is from → to → count.
 * After first move count: Confirm to submit, or start second move
 * (second may use warriors that arrived on the first).
 */
export function createMarquiseMarchComposerHooks(
  board?: MarchBoardSource,
): {
  hooks: ActionComposerHooks
  getDraft: () => MarchDraft
  getPromptOptions: () => Array<{ label: string; value: string }>
} {
  let draft: MarchDraft = { type: 'idle' }
  let promptOptions: Array<{ label: string; value: string }> = []

  const setCountOptions = (moves: MarchMove[]): void => {
    const counts = unique(moves.map((move) => move.count)).sort((a, b) => a - b)
    promptOptions = counts.map((count) => ({
      label: `${String(count)} x warriors`,
      value: String(count),
    }))
  }

  const clearCountOptions = (): void => {
    promptOptions = []
  }

  const hooks: ActionComposerHooks = {
    begin: (spec: ActionSpec): ComposerOutcome | null => {
      if (spec.type !== 'march') {
        return null
      }
      const params = readChoiceParams(spec)
      const legalMoves = params.moves ?? []
      const fromBoard = board?.warriorCountsForCurrentSeat()
      const initialCounts =
        fromBoard !== undefined && fromBoard.size > 0
          ? fromBoard
          : countsFromLegalMoves(legalMoves)
      const boardSnapshot = board?.boardForMarch?.() ?? null
      clearCountOptions()
      draft = {
        type: 'march',
        legalMoves,
        initialCounts,
        boardSnapshot,
        picking: 'firstFrom',
        firstMove: null,
        from: null,
        to: null,
      }
      return {
        kind: 'incomplete',
        prompt: {
          message: 'March 1/2 — pick origin',
          highlightClearings: unique(legalMoves.map((move) => move.from)),
          enabledCardIds: null,
          canConfirm: false,
          canCancel: true,
        },
      }
    },

    chooseClearing: (clearingId: number): ComposerOutcome | null => {
      if (draft.type !== 'march') {
        return null
      }

      const legs = activeLegs(draft)

      if (draft.picking === 'firstFrom' || draft.picking === 'secondFrom') {
        const fromMoves = legs.filter((move) => move.from === clearingId)
        if (fromMoves.length === 0) {
          return null
        }
        const moveIndex = draft.picking === 'firstFrom' ? '1' : '2'
        clearCountOptions()
        draft = {
          ...draft,
          from: clearingId,
          to: null,
          picking: draft.picking === 'firstFrom' ? 'firstTo' : 'secondTo',
        }
        return {
          kind: 'incomplete',
          prompt: {
            message: `March ${moveIndex}/2 — pick destination`,
            highlightClearings: unique(fromMoves.map((move) => move.to)),
            enabledCardIds: null,
            canConfirm: false,
            canCancel: true,
          },
        }
      }

      if (draft.picking === 'firstTo' || draft.picking === 'secondTo') {
        if (draft.from === null) {
          return null
        }
        const origin = draft.from
        const candidates = legs.filter(
          (move) => move.from === origin && move.to === clearingId,
        )
        if (candidates.length === 0) {
          return null
        }
        const moveIndex = draft.picking === 'firstTo' ? '1' : '2'
        setCountOptions(candidates)
        draft = {
          ...draft,
          to: clearingId,
          picking: draft.picking === 'firstTo' ? 'firstCount' : 'secondCount',
        }
        return {
          kind: 'incomplete',
          prompt: {
            message: `March ${moveIndex}/2 — how many warriors?`,
            highlightClearings: [origin, clearingId],
            enabledCardIds: null,
            canConfirm: false,
            canCancel: true,
          },
        }
      }

      // After first count chosen: picking a clearing starts second move origin
      if (draft.picking === 'firstCount' && draft.firstMove !== null) {
        const secondLegs = activeLegs(draft)
        const fromMoves = secondLegs.filter((move) => move.from === clearingId)
        if (fromMoves.length === 0) {
          return null
        }
        clearCountOptions()
        draft = {
          ...draft,
          from: clearingId,
          to: null,
          picking: 'secondTo',
        }
        return {
          kind: 'incomplete',
          prompt: {
            message: 'March 2/2 — pick destination',
            highlightClearings: unique(fromMoves.map((move) => move.to)),
            enabledCardIds: null,
            canConfirm: true,
            canCancel: true,
          },
        }
      }

      return null
    },

    chooseColumn: (countValue: string): ComposerOutcome | null => {
      if (draft.type !== 'march') {
        return null
      }
      if (draft.picking !== 'firstCount' && draft.picking !== 'secondCount') {
        return null
      }
      if (draft.from === null || draft.to === null) {
        return null
      }

      const count = Number(countValue)
      if (!Number.isInteger(count) || count < 1) {
        return null
      }
      const origin = draft.from
      const destination = draft.to
      const legs = activeLegs(draft)
      const match = legs.find(
        (move) =>
          move.from === origin && move.to === destination && move.count === count,
      )
      if (match === undefined) {
        return null
      }

      if (draft.picking === 'firstCount') {
        clearCountOptions()
        draft = {
          ...draft,
          firstMove: match,
          picking: 'firstCount',
          from: null,
          to: null,
        }
        const secondOrigins = unique(
          activeLegs(draft).map((move) => move.from),
        )
        return {
          kind: 'incomplete',
          prompt: {
            message: `March 1 done (${String(count)}) — Confirm, or pick 2nd origin`,
            highlightClearings: secondOrigins,
            enabledCardIds: null,
            canConfirm: true,
            canCancel: true,
          },
        }
      }

      if (draft.firstMove === null) {
        return null
      }
      const action: ClientAction = {
        type: 'march',
        moves: [draft.firstMove, match],
      }
      clearCountOptions()
      draft = { type: 'idle' }
      return { kind: 'ready', action }
    },

    confirm: (): ComposerOutcome | null => {
      if (draft.type !== 'march' || draft.firstMove === null) {
        return null
      }
      // Confirm after first count, or abandon incomplete second destination pick
      if (draft.picking !== 'firstCount' && draft.picking !== 'secondTo') {
        return null
      }
      const action: ClientAction = {
        type: 'march',
        moves: [draft.firstMove],
      }
      clearCountOptions()
      draft = { type: 'idle' }
      return { kind: 'ready', action }
    },

    cancel: (): ComposerOutcome | null => {
      if (draft.type !== 'march') {
        return null
      }
      clearCountOptions()
      draft = { type: 'idle' }
      return { kind: 'idle' }
    },
  }

  return {
    hooks,
    getDraft: () => draft,
    getPromptOptions: () => promptOptions,
  }
}

type BuildOption = { clearing: number; building: string }
type BattleTarget = { clearing: number; defender: number }

type BoardDraft =
  | { type: 'idle' }
  | { type: 'build'; options: BuildOption[]; clearing: number | null }
  | {
      type: 'battle'
      targets: BattleTarget[]
      clearing: number | null
    }

function isBuildOption(value: unknown): value is BuildOption {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const clearing = Reflect.get(value, 'clearing')
  const building = Reflect.get(value, 'building')
  return typeof clearing === 'number' && typeof building === 'string'
}

/**
 * Marquise board daylight: recruit (immediate), build (paired), battle.
 */
export function createMarquiseBoardComposerHooks(): {
  hooks: ActionComposerHooks
  getDraft: () => BoardDraft
  getPromptOptions: () => Array<{ label: string; value: string }>
} {
  let draft: BoardDraft = { type: 'idle' }
  let promptOptions: Array<{ label: string; value: string }> = []

  const hooks: ActionComposerHooks = {
    begin: (spec: ActionSpec): ComposerOutcome | null => {
      promptOptions = []
      if (spec.type === 'build') {
        const params = readChoiceParams(spec)
        const options = (params.options ?? []).filter(isBuildOption)
        draft = { type: 'build', options, clearing: null }
        return {
          kind: 'incomplete',
          prompt: {
            message: 'Build — pick clearing',
            highlightClearings: unique(options.map((option) => option.clearing)),
            enabledCardIds: null,
            canConfirm: false,
            canCancel: true,
          },
        }
      }
      if (spec.type === 'battle') {
        const params = readChoiceParams(spec)
        const targets = params.targets ?? []
        draft = { type: 'battle', targets, clearing: null }
        return {
          kind: 'incomplete',
          prompt: {
            message: 'Battle — pick clearing',
            highlightClearings: unique(targets.map((target) => target.clearing)),
            enabledCardIds: null,
            canConfirm: false,
            canCancel: true,
          },
        }
      }
      // recruit handled by ImmediateTypes in core
      draft = { type: 'idle' }
      return null
    },

    chooseClearing: (clearingId: number): ComposerOutcome | null => {
      if (draft.type === 'build') {
        const matches = draft.options.filter(
          (option) => option.clearing === clearingId,
        )
        if (matches.length === 0) {
          return null
        }
        if (matches.length === 1) {
          const match = matches[0]
          if (match === undefined) {
            return null
          }
          draft = { type: 'idle' }
          promptOptions = []
          return {
            kind: 'ready',
            action: {
              type: 'build',
              clearing: match.clearing,
              building: match.building,
            },
          }
        }
        draft = { ...draft, clearing: clearingId }
        promptOptions = matches.map((option) => ({
          label: option.building,
          value: option.building,
        }))
        return {
          kind: 'incomplete',
          prompt: {
            message: 'Build — pick building type',
            highlightClearings: [clearingId],
            enabledCardIds: null,
            canConfirm: false,
            canCancel: true,
          },
        }
      }

      if (draft.type === 'battle') {
        const matches = draft.targets.filter(
          (target) => target.clearing === clearingId,
        )
        if (matches.length === 0) {
          return null
        }
        draft = { ...draft, clearing: clearingId }
        if (matches.length === 1) {
          const match = matches[0]
          if (match === undefined) {
            return null
          }
          draft = { type: 'idle' }
          promptOptions = []
          return {
            kind: 'ready',
            action: {
              type: 'battle',
              clearing: match.clearing,
              defender: match.defender,
            },
          }
        }
        promptOptions = matches.map((target) => ({
          label: `seat ${String(target.defender)}`,
          value: String(target.defender),
        }))
        return {
          kind: 'incomplete',
          prompt: {
            message: 'Battle — pick defender',
            highlightClearings: [clearingId],
            enabledCardIds: null,
            canConfirm: false,
            canCancel: true,
          },
        }
      }

      return null
    },

    chooseColumn: (buildingOrSeat: string): ComposerOutcome | null => {
      if (draft.type === 'build' && draft.clearing !== null) {
        const clearing = draft.clearing
        const match = draft.options.find(
          (option) =>
            option.clearing === clearing && option.building === buildingOrSeat,
        )
        if (match === undefined) {
          return null
        }
        draft = { type: 'idle' }
        promptOptions = []
        return {
          kind: 'ready',
          action: {
            type: 'build',
            clearing: match.clearing,
            building: match.building,
          },
        }
      }

      if (draft.type === 'battle' && draft.clearing !== null) {
        const defender = Number(buildingOrSeat)
        if (!Number.isInteger(defender)) {
          return null
        }
        const clearing = draft.clearing
        const match = draft.targets.find(
          (target) =>
            target.clearing === clearing && target.defender === defender,
        )
        if (match === undefined) {
          return null
        }
        draft = { type: 'idle' }
        promptOptions = []
        return {
          kind: 'ready',
          action: {
            type: 'battle',
            clearing: match.clearing,
            defender: match.defender,
          },
        }
      }

      return null
    },

    cancel: (): ComposerOutcome | null => {
      if (draft.type === 'idle') {
        return null
      }
      draft = { type: 'idle' }
      promptOptions = []
      return { kind: 'idle' }
    },
  }

  return {
    hooks,
    getDraft: () => draft,
    getPromptOptions: () => promptOptions,
  }
}
