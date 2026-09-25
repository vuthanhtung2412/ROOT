export type ActionTrayDisableInput = {
  /** Frontend staging — composer draft mid-resolve. */
  isActionUnderResolution: boolean
  isAnyModalOpen: boolean
  isLocalActor: boolean
  isGameFinished: boolean
}

/**
 * Hide ActionTray when primary input is elsewhere
 * (under resolution / board / hand / modal / waiting / finished).
 */
export function shouldDisableActionTray(
  input: ActionTrayDisableInput,
): boolean {
  if (input.isGameFinished) {
    return true
  }
  if (!input.isLocalActor) {
    return true
  }
  if (input.isAnyModalOpen) {
    return true
  }
  if (input.isActionUnderResolution) {
    return true
  }
  return false
}
