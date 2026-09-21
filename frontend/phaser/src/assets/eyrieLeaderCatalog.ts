/** Eyrie leader specials — text from official leader cards. */

export type EyrieLeaderId =
  | 'builder'
  | 'charismatic'
  | 'commander'
  | 'despot'

export type EyrieLeaderInfo = {
  id: EyrieLeaderId
  name: string
  /** Starting Loyal Vizier columns on the Decree. */
  decree: string
  /** Special ability text from the leader card. */
  ability: string
  imagePath: string
}

export const EYRIE_LEADER_CATALOG: Record<EyrieLeaderId, EyrieLeaderInfo> = {
  builder: {
    id: 'builder',
    name: 'Builder',
    decree: 'Recruit & Move',
    ability: 'Ignore your Disdain for Trade when you craft.',
    imagePath: 'assets/eyrie-leaders/eyrie-leader-builder.webp',
  },
  charismatic: {
    id: 'charismatic',
    name: 'Charismatic',
    decree: 'Recruit & Battle',
    ability: 'You place two warriors, not one, each time you recruit.',
    imagePath: 'assets/eyrie-leaders/eyrie-leader-charismatic.webp',
  },
  commander: {
    id: 'commander',
    name: 'Commander',
    decree: 'Move & Battle',
    ability: 'As attacker in battle, you deal an extra hit.',
    imagePath: 'assets/eyrie-leaders/eyrie-leader-commander.webp',
  },
  despot: {
    id: 'despot',
    name: 'Despot',
    decree: 'Move & Build',
    ability:
      'Score a point if you remove at least one building or token in battle.',
    imagePath: 'assets/eyrie-leaders/eyrie-leader-despot.webp',
  },
}

export function isEyrieLeaderId(value: string): value is EyrieLeaderId {
  return Object.prototype.hasOwnProperty.call(EYRIE_LEADER_CATALOG, value)
}

export function lookupEyrieLeader(leaderId: string): EyrieLeaderInfo | null {
  if (!isEyrieLeaderId(leaderId)) {
    return null
  }
  return EYRIE_LEADER_CATALOG[leaderId]
}

export function eyrieLeaderTextureKey(leaderId: string): string {
  return `eyrie-leader:${leaderId}`
}

export function formatEyrieLeaderOptionLabel(leaderId: string): string {
  const info = lookupEyrieLeader(leaderId)
  if (info === null) {
    return leaderId
  }
  return `${info.name} · ${info.decree}`
}
