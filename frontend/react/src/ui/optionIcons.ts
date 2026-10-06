import type { IconType } from 'react-icons'
import { LuSailboat, LuSwords, LuWalletCards } from 'react-icons/lu'

/** Icon drawn before the label of a banner option, by option icon id. */
const OPTION_ICONS: Readonly<Record<string, IconType>> = {
  // Rule: 11.2.6 Riverfolk services — ids are the service names of the API.
  handCard: LuWalletCards,
  riverboats: LuSailboat,
  mercenaries: LuSwords,
}

/** Icon of a banner option; null when the option has none. */
export function optionIconFor(iconId: string): IconType | null {
  return OPTION_ICONS[iconId] ?? null
}
