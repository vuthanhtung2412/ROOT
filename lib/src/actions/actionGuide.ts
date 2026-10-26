import type { Action } from '#actions/types.js'

/** What an action is called in plain words, and where the Law of Root covers it. */
export type ActionGuideEntry = {
  kind: string
  /** Law of Root rule numbers, most specific first: `["6.5.2", "4.2"]`. */
  ruleSections: readonly string[]
}

const TURN_STRUCTURE = '1.4.1'
const INTERRUPTS = '1.4.2'
const DISCARD = '1.2.2'
const CRAFT = '4.1'
const PERSISTENT_EFFECTS = '4.1.3'
const MOVE = '4.2'
const BATTLE = '4.3'
const AMBUSH_CARDS = '2.1.2'
const STANDARD_SETUP = '5.1'
const VAGABOND_ITEMS = '9.2.5'
const VAGABOND_SPECIAL_ACTION = '9.5.9'
const LIZARD_CONSPIRACIES = '10.4.3'

/** One entry per action type: a new action cannot go unexplained. */
export const ACTION_GUIDE: Readonly<Record<Action['type'], ActionGuideEntry>> = {
  join: { kind: 'Join Game', ruleSections: ['5.1.1'] },
  expel: { kind: 'Expel Player', ruleSections: ['5.1.1'] },
  start: { kind: 'Start Game', ruleSections: [STANDARD_SETUP] },
  birdsongWood: { kind: 'Place Wood', ruleSections: ['6.4'] },
  eveningDraw: { kind: 'Draw Cards', ruleSections: ['6.6'] },
  emergencyOrders: { kind: 'Emergency Orders', ruleSections: ['7.4.1'] },
  eveningScore: { kind: 'Score Roosts', ruleSections: ['7.6.1'] },
  endPhase: { kind: 'End Phase', ruleSections: [TURN_STRUCTURE] },
  spendBird: { kind: 'Spend Bird Card for Extra Action', ruleSections: ['6.5'] },
  recruit: { kind: 'Recruit', ruleSections: ['6.5.3'] },
  march: { kind: 'March', ruleSections: ['6.5.2', MOVE] },
  build: { kind: 'Build', ruleSections: ['6.5.4'] },
  overwork: { kind: 'Overwork', ruleSections: ['6.5.5'] },
  craft: { kind: 'Craft', ruleSections: [CRAFT] },
  battle: { kind: 'Battle', ruleSections: [BATTLE] },
  swapMeet: { kind: 'Swap Meet', ruleSections: [PERSISTENT_EFFECTS] },
  charmOffensive: { kind: 'Charm Offensive', ruleSections: [PERSISTENT_EFFECTS] },
  informantsTakeAmbush: {
    kind: 'Informants: Take Ambush Card',
    ruleSections: [PERSISTENT_EFFECTS, AMBUSH_CARDS],
  },
  leagueMove: {
    kind: 'League of Adventurous Mice: Move',
    ruleSections: [PERSISTENT_EFFECTS, MOVE],
  },
  leagueBattle: {
    kind: 'League of Adventurous Mice: Battle',
    ruleSections: [PERSISTENT_EFFECTS, BATTLE],
  },
  propagandaBureau: {
    kind: 'Propaganda Bureau',
    ruleSections: [PERSISTENT_EFFECTS],
  },
  saboteurs: { kind: 'Saboteurs', ruleSections: [PERSISTENT_EFFECTS] },
  falseOrders: {
    kind: 'False Orders',
    ruleSections: [PERSISTENT_EFFECTS, MOVE],
  },
  eyrieEmigre: {
    kind: 'Eyrie Émigré',
    ruleSections: [PERSISTENT_EFFECTS, MOVE, BATTLE],
  },
  discard: { kind: 'Discard Cards', ruleSections: [DISCARD] },
  addToDecree: { kind: 'Add to the Decree', ruleSections: ['7.4.2'] },
  newRoost: { kind: 'A New Roost', ruleSections: ['7.4.3'] },
  turmoil: { kind: 'Turmoil', ruleSections: ['7.7'] },
  decree: { kind: 'Resolve the Decree', ruleSections: ['7.5.2'] },
  revolt: { kind: 'Revolt', ruleSections: ['8.4.1'] },
  spreadSympathy: { kind: 'Spread Sympathy', ruleSections: ['8.4.2'] },
  mobilize: { kind: 'Mobilize', ruleSections: ['8.5.2'] },
  train: { kind: 'Train', ruleSections: ['8.5.3'] },
  militaryOp: { kind: 'Military Operation', ruleSections: ['8.6.1'] },
  slip: { kind: 'Slip', ruleSections: ['9.4.2'] },
  vbMove: { kind: 'Move', ruleSections: ['9.5.1', MOVE] },
  vbBattle: { kind: 'Battle', ruleSections: ['9.5.2', BATTLE] },
  explore: { kind: 'Explore', ruleSections: ['9.5.3'] },
  quest: { kind: 'Quest', ruleSections: ['9.5.5'] },
  aid: { kind: 'Aid', ruleSections: ['9.5.4'] },
  strike: { kind: 'Strike', ruleSections: ['9.5.6'] },
  repair: { kind: 'Repair', ruleSections: ['9.5.7'] },
  vbCraft: { kind: 'Craft', ruleSections: ['9.5.8', CRAFT] },
  steal: { kind: 'Steal', ruleSections: [VAGABOND_SPECIAL_ACTION] },
  dayLabor: { kind: 'Day Labor', ruleSections: [VAGABOND_SPECIAL_ACTION] },
  hideout: { kind: 'Hideout', ruleSections: [VAGABOND_SPECIAL_ACTION] },
  vbRearrange: { kind: 'Rearrange Items', ruleSections: [VAGABOND_ITEMS] },
  vbRemoveItems: { kind: 'Check Item Capacity', ruleSections: ['9.6.4'] },
  takeDominance: { kind: 'Take Dominance Card', ruleSections: ['3.3.4'] },
  activateDominance: {
    kind: 'Activate Dominance Card',
    ruleSections: ['3.3.1'],
  },
  refresh: { kind: 'Refresh', ruleSections: ['9.4.1'] },
  rest: { kind: 'Rest', ruleSections: ['9.6.1'] },
  adjustOutcast: {
    kind: 'Adjust Outcast',
    ruleSections: ['10.4.1', '10.4.2'],
  },
  crusadeBattle: {
    kind: 'Crusade: Battle',
    ruleSections: [LIZARD_CONSPIRACIES, BATTLE],
  },
  crusadeMove: {
    kind: 'Crusade: Move',
    ruleSections: [LIZARD_CONSPIRACIES, MOVE],
  },
  skipCrusadeBattle: {
    kind: 'Crusade: Skip Battle',
    ruleSections: [LIZARD_CONSPIRACIES],
  },
  convert: { kind: 'Convert', ruleSections: [LIZARD_CONSPIRACIES] },
  sanctify: { kind: 'Sanctify', ruleSections: [LIZARD_CONSPIRACIES] },
  ritualBuild: { kind: 'Ritual: Build', ruleSections: ['10.5.1'] },
  ritualRecruit: { kind: 'Ritual: Recruit', ruleSections: ['10.5.2'] },
  ritualScore: { kind: 'Ritual: Score', ruleSections: ['10.5.3'] },
  ritualSacrifice: { kind: 'Ritual: Sacrifice', ruleSections: ['10.5.4'] },
  returnRevealed: {
    kind: 'Return Revealed Cards',
    ruleSections: ['10.6.1'],
  },
  gatherFunds: { kind: 'Gather Funds', ruleSections: ['11.4.3'] },
  riverfolkMove: { kind: 'Move', ruleSections: ['11.5.1', MOVE] },
  riverfolkBattle: { kind: 'Battle', ruleSections: ['11.5.2', BATTLE] },
  riverfolkCraft: { kind: 'Craft', ruleSections: ['11.5.3', CRAFT] },
  riverfolkDraw: { kind: 'Draw', ruleSections: ['11.5.4'] },
  riverfolkRecruit: { kind: 'Recruit', ruleSections: ['11.5.5'] },
  establishTradePost: {
    kind: 'Establish Trade Post with Garrison',
    ruleSections: ['11.5.6'],
  },
  setServiceCosts: { kind: 'Set Costs', ruleSections: ['11.6.2'] },
  // Bots act on their own (Law of Rootbotics 4–5); players never send these.
  // The kind names the Rootbotics rule, the sections the Law of Root base.
  botStep: { kind: 'Bot Step (Rootbotics 2.7)', ruleSections: [TURN_STRUCTURE] },
  revealOrder: {
    kind: 'Reveal Order Card (Rootbotics 4.4.1, 5.4.1)',
    ruleSections: [TURN_STRUCTURE],
  },
  botCraft: { kind: 'Craft Order (Rootbotics 1.1)', ruleSections: [CRAFT] },
  botRecruit: {
    kind: 'Recruit (Rootbotics 4.5.2, 5.5.1.I)',
    ruleSections: [TURN_STRUCTURE],
  },
  botBuild: {
    kind: 'Build (Rootbotics 4.5.3, 5.5.1.IV)',
    ruleSections: [TURN_STRUCTURE],
  },
  botMove: { kind: 'Move (Rootbotics 4.5.4, 5.5.1.II)', ruleSections: [MOVE] },
  botBattle: {
    kind: 'Battle (Rootbotics 4.5.1, 5.5.1.III)',
    ruleSections: [BATTLE],
  },
  botTurmoil: { kind: 'Turmoil (Rootbotics 5.7)', ruleSections: ['7.7'] },
  botRevolt: { kind: 'Revolt (Rootbotics 6.4.3, 6.5.2)', ruleSections: ['8.4.1'] },
  botSpreadSympathy: {
    kind: 'Spread Sympathy (Rootbotics 6.5.1)',
    ruleSections: ['8.4.2'],
  },
  botOrganize: { kind: 'Organize (Rootbotics 6.6.1)', ruleSections: ['8.6.1'] },
  botPawnMove: { kind: 'Vagabot Move (Rootbotics 7.5)', ruleSections: [MOVE] },
  botSlip: { kind: 'Slip (Rootbotics 7.4.3)', ruleSections: ['9.4.2'] },
  botExplore: { kind: 'Explore (Rootbotics 7.5.1)', ruleSections: ['9.5.3'] },
  botQuest: { kind: 'Quest (Rootbotics 7.5.2)', ruleSections: ['9.5.5'] },
  botAid: { kind: 'Aid (Rootbotics 7.5.3)', ruleSections: ['9.5.4'] },
  botRepair: { kind: 'Repair (Rootbotics 7.5.5, 7.6.2)', ruleSections: ['9.5.7'] },
  botSteal: { kind: 'Steal (Rootbotics 7.7.1)', ruleSections: ['9.5.9'] },
  botDayLabor: { kind: 'Day Labor (Rootbotics 7.7.2)', ruleSections: [CRAFT] },
  botRefresh: { kind: 'Refresh (Rootbotics 7.6.1)', ruleSections: ['9.4.1'] },
  resolveEvent:{ kind: 'Answer Pending Event', ruleSections: [INTERRUPTS] },
}
