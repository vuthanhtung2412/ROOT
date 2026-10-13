import type { GameState } from '#api/client.ts'

/** Actions a Marquise Daylight starts with, before any bird card is spent. */
const MARQUISE_DAYLIGHT_ACTIONS = 3

/**
 * Short count for the tray header: the budget left (Marquise Daylight
 * actions, Woodland Alliance military operations), otherwise the number of
 * buttons.
 */
export function trayActionCountLabel(
  buttonCount: number,
  state: GameState | undefined,
): string {
  const actionsLeft = turnBudgetLeft(state)
  if (actionsLeft !== null) {
    return `${String(actionsLeft)} left`
  }
  return buttonCount === 1 ? '1 action' : `${String(buttonCount)} actions`
}

/**
 * Budget beside the phase name on the dock tab, as `left/total` (Marquise
 * Daylight actions, Woodland Alliance military operations); null without one.
 */
export function trayBudgetLabel(state: GameState | undefined): string | null {
  const marquiseLeft: number | null = marquiseDaylightActionsLeft(state)
  if (marquiseLeft !== null) {
    // Bird cards add actions: the total never reads below what is left.
    const total: number = Math.max(MARQUISE_DAYLIGHT_ACTIONS, marquiseLeft)
    return `${String(marquiseLeft)}/${String(total)}`
  }
  const operationsLeft: number | null = allianceMilitaryOperationsLeft(state)
  if (operationsLeft !== null) {
    const total: number = Math.max(allianceOfficers(state), operationsLeft)
    return `${String(operationsLeft)}/${String(total)}`
  }
  return null
}

/** Actions the current seat may still take this step, when it has a budget. */
export function turnBudgetLeft(state: GameState | undefined): number | null {
  return (
    marquiseDaylightActionsLeft(state) ??
    allianceMilitaryOperationsLeft(state)
  )
}

/** Officers of the current seat's Woodland Alliance board (0 when absent). */
function allianceOfficers(state: GameState | undefined): number {
  const actor = state?.players.find(
    (player) => player.seat === state.currentSeat,
  )
  const board: unknown = actor?.board
  if (typeof board !== 'object' || board === null) {
    return 0
  }
  const officers: unknown = Reflect.get(board, 'officers')
  return typeof officers === 'number' ? officers : 0
}

/** Woodland Alliance Evening: military operations left (one per officer). */
function allianceMilitaryOperationsLeft(
  state: GameState | undefined,
): number | null {
  if (state === undefined) {
    return null
  }
  if (state.phase !== 'evening' || state.step !== 'military') {
    return null
  }
  const actor = state.players.find((player) => player.seat === state.currentSeat)
  if (actor?.faction !== 'alliance') {
    return null
  }
  const scratch = state.turnScratch
  if (typeof scratch !== 'object' || scratch === null) {
    return null
  }
  const operationsLeft = Reflect.get(scratch, 'militaryOpsLeft')
  return typeof operationsLeft === 'number' ? operationsLeft : null
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
