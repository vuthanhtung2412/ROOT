export type ActionTrayDisableInput = {
  isFieldHospitalStaging: boolean
  isComposerStaging: boolean
  isAnyModalOpen: boolean
  isLocalActor: boolean
  isGameFinished: boolean
}

/**
 * Hide ActionTray when primary input is elsewhere.
 * Field Hospitals stay enabled — pay/decline live in the tray.
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
  if (input.isFieldHospitalStaging) {
    return false
  }
  if (input.isComposerStaging) {
    return true
  }
  return false
}
