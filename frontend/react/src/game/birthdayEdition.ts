/**
 * Birthday edition feature flag: `ROOT_BIRTHDAY_EDITION=1` at build / dev
 * time dresses the menu, lobby and Lizard Cult art for the party.
 */
const BIRTHDAY_EDITION_ENABLED_VALUE = '1'

/** Undefined when Node loads this through vite.config.ts, outside Vite. */
const buildEnvironment: ImportMetaEnv | undefined = import.meta.env

export const IS_BIRTHDAY_EDITION: boolean =
  buildEnvironment?.ROOT_BIRTHDAY_EDITION === BIRTHDAY_EDITION_ENABLED_VALUE

/** Birthday edition: name tag under the acolytes icon on the Lizard Cult board. */
export const BIRTHDAY_ACOLYTE_NAME_TAG: string = 'TUNG'

/** Display name of the Lizard Cult; the birthday edition renames it for Phuong. */
export const LIZARD_CULT_DISPLAY_NAME: string = IS_BIRTHDAY_EDITION
  ? 'Phuong Cult'
  : 'Lizard Cult'
