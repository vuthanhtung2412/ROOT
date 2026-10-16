import { lookupEyrieLeader } from '#assets/eyrieLeaderCatalog.ts'
import { imagePathForAssetKey } from '#assets/gameAssets.ts'
import { publicAssetUrl } from '#assets/publicAssetUrl.ts'
import {
  CHOOSE_CHARACTER_PROMPT,
  VAGABOND_CHARACTER_CATALOG,
} from '#assets/vagabondBoardCatalog.ts'

/** Which deck of cards the full-screen pick overlay shows. */
export type SetupCardPickKind = 'leader' | 'character'

export type SetupCardPickOption = {
  id: string
  name: string
  /** Null = no art: the overlay shows a labelled placeholder. */
  imagePath: string | null
  /** Lines under the card. */
  caption: readonly string[]
}

const CHOOSE_LEADER_TITLE = 'Choose Eyrie leader'

export function setupCardPickTitle(kind: SetupCardPickKind): string {
  return kind === 'character' ? CHOOSE_CHARACTER_PROMPT : CHOOSE_LEADER_TITLE
}

function rootRelativePath(imagePath: string): string {
  return publicAssetUrl(imagePath)
}

function leaderOption(leaderId: string): SetupCardPickOption {
  const leader = lookupEyrieLeader(leaderId)
  if (leader === null) {
    return { id: leaderId, name: leaderId, imagePath: null, caption: [leaderId] }
  }
  return {
    id: leaderId,
    name: leader.name,
    imagePath: rootRelativePath(leader.imagePath),
    caption: [leader.name, `Viziers: ${leader.decree}`, leader.ability].filter(
      (line: string): boolean => line.length > 0,
    ),
  }
}

function characterOption(characterId: string): SetupCardPickOption {
  const character = VAGABOND_CHARACTER_CATALOG.find(
    (entry) => entry.id === characterId,
  )
  if (character === undefined) {
    return {
      id: characterId,
      name: characterId,
      imagePath: null,
      caption: [characterId],
    }
  }
  return {
    id: characterId,
    name: character.name,
    imagePath: imagePathForAssetKey(character.cardAssetKey),
    caption: [
      character.name,
      `${character.special.name}: ${character.special.description}`,
      `Starts with: ${character.startingItems.join(', ')}`,
    ],
  }
}

/** Cards to show for the pending setup pick, in the order offered. */
export function setupCardPickOptions(
  kind: SetupCardPickKind,
  optionIds: readonly string[],
): SetupCardPickOption[] {
  return optionIds.map(kind === 'character' ? characterOption : leaderOption)
}
