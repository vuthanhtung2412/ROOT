import type { ActionComposerHooks } from '#game/ActionComposer.ts'

/** First non-null hook win across faction/event composers. */
export function mergeComposerHooks(
  ...hookSets: ActionComposerHooks[]
): ActionComposerHooks {
  return {
    begin: (spec) => {
      for (const hooks of hookSets) {
        const outcome = hooks.begin?.(spec) ?? null
        if (outcome !== null) {
          return outcome
        }
      }
      return null
    },
    chooseCard: (cardId) => {
      for (const hooks of hookSets) {
        const outcome = hooks.chooseCard?.(cardId) ?? null
        if (outcome !== null) {
          return outcome
        }
      }
      return null
    },
    chooseClearing: (clearingId) => {
      for (const hooks of hookSets) {
        const outcome = hooks.chooseClearing?.(clearingId) ?? null
        if (outcome !== null) {
          return outcome
        }
      }
      return null
    },
    chooseDefender: (defenderSeat) => {
      for (const hooks of hookSets) {
        const outcome = hooks.chooseDefender?.(defenderSeat) ?? null
        if (outcome !== null) {
          return outcome
        }
      }
      return null
    },
    chooseColumn: (column) => {
      for (const hooks of hookSets) {
        const outcome = hooks.chooseColumn?.(column) ?? null
        if (outcome !== null) {
          return outcome
        }
      }
      return null
    },
    choosePiece: (pieceId) => {
      for (const hooks of hookSets) {
        const outcome = hooks.choosePiece?.(pieceId) ?? null
        if (outcome !== null) {
          return outcome
        }
      }
      return null
    },
    confirm: () => {
      for (const hooks of hookSets) {
        const outcome = hooks.confirm?.() ?? null
        if (outcome !== null) {
          return outcome
        }
      }
      return null
    },
    cancel: () => {
      for (const hooks of hookSets) {
        const outcome = hooks.cancel?.() ?? null
        if (outcome !== null) {
          return outcome
        }
      }
      return null
    },
  }
}
