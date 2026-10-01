import type { ActionSpec } from '#api/client.ts'
import {
  type ActionComposerHooks,
  type ComposerOutcome,
  readChoiceParams,
} from '#game/resolution/ActionComposer.ts'

type VagabondDraft =
  | { type: 'idle' }
  | { type: 'slip'; clearings: number[]; forests: number[] }
  | {
      type: 'vbMove'
      clearings: number[]
      vbMoves: Array<{ to: number; allySeat?: number; allyCount?: number }>
    }
  | {
      type: 'vbBattle'
      targets: Array<{ clearing: number; defender: number }>
      alliedSeat?: number
    }
  | AidDraft
  | { type: 'strike'; targets: Array<{ clearing: number; defender: number }> }
  | { type: 'repair'; indexes: number[] }
  | { type: 'vbCraft'; cardIds: string[] }
  | { type: 'steal'; defenders: number[] }
  | { type: 'quest'; questIds: string[]; questId?: string }

/** Aid picks in order: card → target → item to exhaust. */
type AidDraft = {
  type: 'aid'
  cardIds: string[]
  defenders: number[]
  costItemTypes: string[]
  takeItemTypes: string[]
  cardId?: string
  target?: number
  costItem?: string
}

const REPAIR_VALUE_PREFIX = 'repair:'
const AID_COST_VALUE_PREFIX = 'cost:'
const AID_TAKE_VALUE_PREFIX = 'take:'
const AID_TAKE_NOTHING_VALUE = 'take-nothing'

function unique(values: number[]): number[] {
  return [...new Set(values)]
}

function isVbMoveChoice(
  value: unknown,
): value is { to: number; allySeat?: number; allyCount?: number } {
  if (typeof value !== 'object' || value === null) return false
  return typeof (value as { to?: unknown }).to === 'number'
}

/** Vagabond daylight / birdsong choice flows. */
export function createVagabondComposerHooks(): {
  hooks: ActionComposerHooks
  getDraft: () => VagabondDraft
  getPromptOptions: () => Array<{ label: string; value: string }>
} {
  let draft: VagabondDraft = { type: 'idle' }
  let promptOptions: Array<{ label: string; value: string }> = []

  function setDefenderPrompt(
    message: string,
    defenders: readonly number[],
  ): ComposerOutcome {
    promptOptions = defenders.map((seat) => ({
      label: `seat ${String(seat)}`,
      value: String(seat),
    }))
    return {
      kind: 'incomplete',
      prompt: {
        message,
        highlightClearings: [],
        enabledCardIds: null,
        canConfirm: false,
        canCancel: true,
      },
    }
  }

  /** Rule: 9.5.6 Aid — ask for whatever is still missing, then submit. */
  function continueAid(aid: AidDraft): ComposerOutcome | null {
    const cardId = aid.cardId
    if (cardId === undefined) return null
    if (aid.target === undefined) {
      if (aid.defenders.length === 0) return null
      if (aid.defenders.length > 1) {
        draft = aid
        return setDefenderPrompt('Aid — pick target', aid.defenders)
      }
      return continueAid({ ...aid, target: aid.defenders[0]! })
    }
    const target = aid.target
    if (aid.costItem === undefined && aid.costItemTypes.length === 1) {
      return continueAid({ ...aid, costItem: aid.costItemTypes[0]! })
    }
    if (aid.costItem === undefined && aid.costItemTypes.length > 1) {
      draft = aid
      promptOptions = aid.costItemTypes.map((itemType) => ({
        label: itemType,
        value: `${AID_COST_VALUE_PREFIX}${itemType}`,
      }))
      return {
        kind: 'incomplete',
        prompt: {
          message: 'Aid — pick item to exhaust',
          highlightClearings: [],
          enabledCardIds: null,
          canConfirm: false,
          canCancel: true,
        },
      }
    }
    if (aid.takeItemTypes.length > 0) {
      draft = aid
      promptOptions = [
        ...aid.takeItemTypes.map((itemType) => ({
          label: `take ${itemType}`,
          value: `${AID_TAKE_VALUE_PREFIX}${itemType}`,
        })),
        { label: 'take nothing', value: AID_TAKE_NOTHING_VALUE },
      ]
      return {
        kind: 'incomplete',
        prompt: {
          message: 'Aid — take a crafted item?',
          highlightClearings: [],
          enabledCardIds: null,
          canConfirm: false,
          canCancel: true,
        },
      }
    }
    return finishAid(aid, cardId, target, undefined)
  }

  function finishAid(
    aid: AidDraft,
    cardId: string,
    target: number,
    takeItem: string | undefined,
  ): ComposerOutcome {
    draft = { type: 'idle' }
    promptOptions = []
    return {
      kind: 'ready',
      action: {
        type: 'aid',
        cardId,
        target,
        ...(aid.costItem !== undefined ? { costItem: aid.costItem } : {}),
        ...(takeItem !== undefined ? { takeItem } : {}),
      },
    }
  }

  const hooks: ActionComposerHooks = {
    begin: (spec: ActionSpec): ComposerOutcome | null => {
      promptOptions = []
      const params = readChoiceParams(spec)
      if (spec.type === 'vbRearrange') {
        const itemType = params.itemTypes?.[0]
        const from = params.rearrangeFrom?.[0]
        if (
          (itemType === 'tea' || itemType === 'coin' || itemType === 'bag') &&
          (from === 'track' || from === 'satchel')
        ) {
          return {
            kind: 'ready',
            action: { type: 'vbRearrange', itemType, from },
          }
        }
        return null
      }
      if (spec.type === 'slip') {
        const clearings = params.clearings ?? []
        const forests = params.forests ?? []
        draft = { type: 'slip', clearings, forests }
        return {
          kind: 'incomplete',
          prompt: {
            message: 'Slip — pick clearing (or forest via options)',
            highlightClearings: clearings,
            enabledCardIds: null,
            canConfirm: forests.length > 0,
            canCancel: true,
          },
        }
      }
      if (spec.type === 'vbMove') {
        const clearings = params.clearings ?? []
        const vbMoves = (params.vbMoves ?? []).filter(isVbMoveChoice)
        draft = { type: 'vbMove', clearings, vbMoves }
        return {
          kind: 'incomplete',
          prompt: {
            message: 'Move — pick clearing',
            highlightClearings: clearings,
            enabledCardIds: null,
            canConfirm: false,
            canCancel: true,
          },
        }
      }
      if (spec.type === 'vbBattle' || spec.type === 'strike') {
        const targets = params.targets ?? []
        const alliedSeat = params.alliedSeat?.[0]
        draft = {
          type: spec.type === 'vbBattle' ? 'vbBattle' : 'strike',
          targets,
          ...(spec.type === 'vbBattle' && alliedSeat !== undefined
            ? { alliedSeat }
            : {}),
        }
        return {
          kind: 'incomplete',
          prompt: {
            message: `${spec.type === 'vbBattle' ? 'Battle' : 'Strike'} — pick clearing`,
            highlightClearings: unique(targets.map((target) => target.clearing)),
            enabledCardIds: null,
            canConfirm: false,
            canCancel: true,
          },
        }
      }
      if (spec.type === 'aid') {
        draft = {
          type: 'aid',
          cardIds: params.cardIds ?? [],
          defenders: params.defender ?? [],
          costItemTypes: params.costItemTypes ?? [],
          takeItemTypes: params.takeItemTypes ?? [],
        }
        return {
          kind: 'incomplete',
          prompt: {
            message: 'Aid — pick card',
            highlightClearings: [],
            enabledCardIds: params.cardIds ?? [],
            canConfirm: false,
            canCancel: true,
          },
        }
      }
      if (spec.type === 'repair') {
        const indexes = params.clearings ?? []
        draft = { type: 'repair', indexes }
        if (indexes.length === 1) {
          return {
            kind: 'ready',
            action: { type: 'repair', itemIndex: indexes[0]! },
          }
        }
        const damagedItems = params.vagabondItems ?? []
        promptOptions = indexes.map((itemIndex) => {
          const item = damagedItems[itemIndex]
          const itemName = item?.type ?? `item ${String(itemIndex + 1)}`
          return {
            label: item?.exhausted === true ? `${itemName} (exhausted)` : itemName,
            value: `${REPAIR_VALUE_PREFIX}${String(itemIndex)}`,
          }
        })
        return {
          kind: 'incomplete',
          prompt: {
            message: 'Repair — pick damaged item',
            highlightClearings: [],
            enabledCardIds: null,
            canConfirm: false,
            canCancel: true,
          },
        }
      }
      if (spec.type === 'vbCraft') {
        draft = { type: 'vbCraft', cardIds: params.cardIds ?? [] }
        return {
          kind: 'incomplete',
          prompt: {
            message: 'Craft — pick card',
            highlightClearings: [],
            enabledCardIds: params.cardIds ?? [],
            canConfirm: false,
            canCancel: true,
          },
        }
      }
      if (spec.type === 'steal') {
        const defenders = params.defender ?? []
        draft = { type: 'steal', defenders }
        if (defenders.length === 1) {
          return {
            kind: 'ready',
            action: { type: 'steal', target: defenders[0]! },
          }
        }
        return setDefenderPrompt('Steal — pick target', defenders)
      }
      if (spec.type === 'quest') {
        const questIds = params.questIds ?? []
        draft = { type: 'quest', questIds }
        if (questIds.length === 1) {
          draft = { type: 'quest', questIds, questId: questIds[0]! }
          promptOptions = [
            { label: 'VP for suit', value: 'vp' },
            { label: 'Draw 2', value: 'draw' },
          ]
          return {
            kind: 'incomplete',
            prompt: {
              message: 'Quest — pick reward',
              highlightClearings: [],
              enabledCardIds: null,
              canConfirm: false,
              canCancel: true,
            },
          }
        }
        promptOptions = questIds.map((questId, index) => ({
          label: `quest ${String(index + 1)}`,
          value: questId,
        }))
        return {
          kind: 'incomplete',
          prompt: {
            message: 'Quest — pick face-up quest',
            highlightClearings: [],
            enabledCardIds: null,
            canConfirm: false,
            canCancel: true,
          },
        }
      }
      draft = { type: 'idle' }
      return null
    },

    chooseClearing: (clearingId: number): ComposerOutcome | null => {
      promptOptions = []
      if (draft.type === 'slip') {
        if (!draft.clearings.includes(clearingId)) return null
        draft = { type: 'idle' }
        return { kind: 'ready', action: { type: 'slip', to: clearingId } }
      }
      if (draft.type === 'vbMove') {
        if (!draft.clearings.includes(clearingId)) return null
        const matches = draft.vbMoves.filter((move) => move.to === clearingId)
        if (matches.length === 0) {
          draft = { type: 'idle' }
          return { kind: 'ready', action: { type: 'vbMove', to: clearingId } }
        }
        if (matches.length === 1) {
          const choice = matches[0]!
          draft = { type: 'idle' }
          if (choice.allySeat !== undefined && choice.allyCount !== undefined) {
            return {
              kind: 'ready',
              action: {
                type: 'vbMove',
                to: choice.to,
                allySeat: choice.allySeat,
                allyCount: choice.allyCount,
              },
            }
          }
          return { kind: 'ready', action: { type: 'vbMove', to: choice.to } }
        }
        promptOptions = matches.map((choice, index) => ({
          label:
            choice.allySeat !== undefined
              ? `+${String(choice.allyCount)} ally seat ${String(choice.allySeat)}`
              : 'pawn only',
          value: String(index),
        }))
        draft = { type: 'vbMove', clearings: [clearingId], vbMoves: matches }
        return {
          kind: 'incomplete',
          prompt: {
            message: 'Move — escort Allied?',
            highlightClearings: [clearingId],
            enabledCardIds: null,
            canConfirm: false,
            canCancel: true,
          },
        }
      }
      if (draft.type === 'vbBattle' || draft.type === 'strike') {
        const matches = draft.targets.filter(
          (target) => target.clearing === clearingId,
        )
        if (matches.length === 0) return null
        if (matches.length === 1) {
          const match = matches[0]!
          if (draft.type === 'vbBattle') {
            const alliedSeat = draft.alliedSeat
            draft = { type: 'idle' }
            return {
              kind: 'ready',
              action:
                alliedSeat !== undefined
                  ? {
                      type: 'vbBattle',
                      defender: match.defender,
                      alliedSeat,
                    }
                  : { type: 'vbBattle', defender: match.defender },
            }
          }
          draft = { type: 'idle' }
          return {
            kind: 'ready',
            action: { type: 'strike', defender: match.defender },
          }
        }
        promptOptions = matches.map((match) => ({
          label: `seat ${String(match.defender)}`,
          value: String(match.defender),
        }))
        return {
          kind: 'incomplete',
          prompt: {
            message: 'Pick defender seat',
            highlightClearings: [clearingId],
            enabledCardIds: null,
            canConfirm: false,
            canCancel: true,
          },
        }
      }
      return null
    },

    chooseCard: (cardId: string): ComposerOutcome | null => {
      if (
        draft.type === 'aid' &&
        draft.cardId === undefined &&
        draft.cardIds.includes(cardId)
      ) {
        return continueAid({ ...draft, cardId })
      }
      if (draft.type === 'vbCraft' && draft.cardIds.includes(cardId)) {
        draft = { type: 'idle' }
        promptOptions = []
        return { kind: 'ready', action: { type: 'vbCraft', cardId } }
      }
      return null
    },

    chooseDefender: (defenderSeat: number): ComposerOutcome | null => {
      if (draft.type === 'steal' && draft.defenders.includes(defenderSeat)) {
        draft = { type: 'idle' }
        promptOptions = []
        return { kind: 'ready', action: { type: 'steal', target: defenderSeat } }
      }
      if (
        draft.type === 'aid' &&
        draft.target === undefined &&
        draft.defenders.includes(defenderSeat)
      ) {
        return continueAid({ ...draft, target: defenderSeat })
      }
      if (draft.type === 'vbBattle' || draft.type === 'strike') {
        const match = draft.targets.find(
          (target) => target.defender === defenderSeat,
        )
        if (match === undefined) return null
        const type = draft.type === 'vbBattle' ? 'vbBattle' : 'strike'
        draft = { type: 'idle' }
        promptOptions = []
        return { kind: 'ready', action: { type, defender: match.defender } }
      }
      return null
    },

    chooseColumn: (column: string): ComposerOutcome | null => {
      if (draft.type === 'repair' && column.startsWith(REPAIR_VALUE_PREFIX)) {
        const itemIndex = Number(column.slice(REPAIR_VALUE_PREFIX.length))
        if (!draft.indexes.includes(itemIndex)) return null
        draft = { type: 'idle' }
        promptOptions = []
        return { kind: 'ready', action: { type: 'repair', itemIndex } }
      }
      if (draft.type === 'aid' && column.startsWith(AID_COST_VALUE_PREFIX)) {
        const costItem = column.slice(AID_COST_VALUE_PREFIX.length)
        if (!draft.costItemTypes.includes(costItem)) return null
        return continueAid({ ...draft, costItem })
      }
      if (
        draft.type === 'aid' &&
        draft.cardId !== undefined &&
        draft.target !== undefined
      ) {
        if (column === AID_TAKE_NOTHING_VALUE) {
          return finishAid(draft, draft.cardId, draft.target, undefined)
        }
        if (column.startsWith(AID_TAKE_VALUE_PREFIX)) {
          const takeItem = column.slice(AID_TAKE_VALUE_PREFIX.length)
          if (!draft.takeItemTypes.includes(takeItem)) return null
          return finishAid(draft, draft.cardId, draft.target, takeItem)
        }
      }
      if (draft.type === 'vbMove') {
        const index = Number(column)
        if (
          !Number.isInteger(index) ||
          index < 0 ||
          index >= draft.vbMoves.length
        ) {
          return null
        }
        const choice = draft.vbMoves[index]!
        draft = { type: 'idle' }
        promptOptions = []
        if (choice.allySeat !== undefined && choice.allyCount !== undefined) {
          return {
            kind: 'ready',
            action: {
              type: 'vbMove',
              to: choice.to,
              allySeat: choice.allySeat,
              allyCount: choice.allyCount,
            },
          }
        }
        return { kind: 'ready', action: { type: 'vbMove', to: choice.to } }
      }
      if (draft.type === 'quest') {
        if (draft.questId === undefined) {
          if (!draft.questIds.includes(column)) {
            return null
          }
          draft = { type: 'quest', questIds: draft.questIds, questId: column }
          promptOptions = [
            { label: 'VP for suit', value: 'vp' },
            { label: 'Draw 2', value: 'draw' },
          ]
          return {
            kind: 'incomplete',
            prompt: {
              message: 'Quest — pick reward',
              highlightClearings: [],
              enabledCardIds: null,
              canConfirm: false,
              canCancel: true,
            },
          }
        }
        if (column !== 'vp' && column !== 'draw') {
          return null
        }
        const questId = draft.questId
        draft = { type: 'idle' }
        promptOptions = []
        return {
          kind: 'ready',
          action: { type: 'quest', questId, reward: column },
        }
      }
      const seat = Number(column)
      if (!Number.isInteger(seat)) {
        return null
      }
      return hooks.chooseDefender?.(seat) ?? null
    },

    confirm: (): ComposerOutcome | null => {
      if (draft.type === 'slip' && draft.forests.length > 0) {
        const forest = draft.forests[0]!
        draft = { type: 'idle' }
        promptOptions = []
        return { kind: 'ready', action: { type: 'slip', to: `forest:${forest}` } }
      }
      return null
    },

    cancel: (): ComposerOutcome | null => {
      draft = { type: 'idle' }
      promptOptions = []
      return { kind: 'idle' }
    },
  }

  return {
    hooks,
    getDraft: (): VagabondDraft => draft,
    getPromptOptions: () => promptOptions,
  }
}
