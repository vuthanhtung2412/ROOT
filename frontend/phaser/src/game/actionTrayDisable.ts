export type ActionTrayDisableInput = {
  isComposerStaging: boolean
  isAnyModalOpen: boolean
  isLocalActor: boolean
  isGameFinished: boolean
}

/**
 * Hide ActionTray when primary input is elsewhere
 * (composer prompt / board / hand / modal / waiting / finished).
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
  if (input.isComposerStaging) {
    return true
  }
  return false
}
