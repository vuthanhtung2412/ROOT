/**
 * Lizard Cult + Riverfolk Company QA run, from the Cult Evening on (plan steps 26–43:
 * end of Part 3, Marquise turn, second round) and Part 0 (New Game setup).
 * Earlier steps and the helpers: lizard-riverfolk-qa-steps.mjs.
 * Plan: resources/notes/QA-plan-lizard-riverfolk.md — titles carry the plan step numbers.
 */
import {
  CARD,
  LIZARD,
  MARQUISE,
  RIVERFOLK,
  RIVER_CLEARINGS,
  board,
  expectEqual,
  expectThat,
  handOf,
  legalCardIds,
  legalValues,
  lostSouls,
  ownedBy,
  piecesOfType,
  readLostSouls,
  readRevealedPanel,
  victoryPoints,
  warriorsIn,
} from './lizard-riverfolk-qa-steps.mjs'

const CULT_ADJACENT_TO_CORNER = [4, 8, 9]

export const CULT_EVENING_TO_SECOND_ROUND_STEPS = [
  {
    title: '26 · Evening: revealed cards return to hand (L11)',
    play: async (ui) => {
      await ui.button('end phase')
      const craftable = legalCardIds(await ui.fetchLegalActions(), 'craft')
      const revealedPanel = await ui.lookAtBoard('lizard', readRevealedPanel)
      return { craftable, revealedPanel }
    },
    verify: (state, seen) => {
      const hand = handOf(state, LIZARD)
      expectEqual(board(state, LIZARD).revealed.length, 0, 'revealed')
      expectEqual(seen.revealedPanel, 'Revealed cards (0)', 'Revealed panel')
      for (const card of [CARD.bakeSale, CARD.mouseInASack, CARD.birdyBindle]) {
        expectThat(hand.includes(card), `${card} not back in hand`)
      }
      expectEqual(seen.craftable.length, 1, 'craftable cards')
      expectThat(seen.craftable[0].startsWith(CARD.foxfolkSteel), `craftable = ${seen.craftable[0]}`)
      return 'Panel empty, 3 cards back; only Foxfolk Steel craftable (Outcast fox gardens)'
    },
  },
  {
    title: '27–28 · Craft Foxfolk Steel, draw 3 (L11 L12)',
    play: async (ui) => {
      await ui.button('craft')
      await ui.handCard(CARD.foxfolkSteel)
      await ui.waitForButton('discard')
    },
    verify: (state) => {
      expectEqual(victoryPoints(state)[LIZARD], 5, 'Cult VP')
      expectEqual(handOf(state, LIZARD).length, 7, 'hand')
      expectEqual(state.step, 'discard', 'step')
      return '+2 VP; Travel Gear (rabbit cost) not craftable; drew 1 + rabbit + fox bonus'
    },
  },
  {
    title: '29–30 · Discard Travel Gear + Birdy Bindle → Marquise turn',
    play: async (ui) => {
      await ui.button('discard')
      await ui.handCard(CARD.travelGearFox)
      await ui.handCard(CARD.birdyBindle)
      await ui.button('OK')
      await ui.waitForButton('buy service')
    },
    verify: (state) => {
      expectEqual(handOf(state, LIZARD).length, 5, 'hand')
      expectEqual(lostSouls(state).length, 4, 'Lost Souls')
      expectEqual(state.currentSeat, MARQUISE, 'seat')
      return 'Lost Souls: 3 fox + 1 bird; Marquise gets the service prompt'
    },
  },
  {
    title: '31–33 · Marquise buys Hand Card, Riverboats, Mercenaries (R12–R15)',
    play: async (ui) => {
      await ui.button('buy service')
      await ui.button('Hand Card')
      await ui.galleryCard(CARD.smugglersTrail)
      await ui.button('buy service')
      await ui.button('Riverboats')
      await ui.button('buy service')
      await ui.button('Mercenaries')
      await ui.waitForButton('end phase')
    },
    verify: (state) => {
      expectThat(handOf(state, MARQUISE).includes(CARD.smugglersTrail), 'card not taken')
      expectEqual(ownedBy(board(state, RIVERFOLK).payments, MARQUISE), 4, 'Cat payments')
      expectEqual(state.pending.length, 0, 'pending')
      expectEqual(state.turnScratch.riverboats && state.turnScratch.mercenaries, true, 'services')
      return 'Paid 1 + 1 + 2 warriors; prompt closed after 3 (posts on 4 and 11)'
    },
  },
  {
    title: '34–35 · March 10 → 9 by Riverboats (R13)',
    play: async (ui) => {
      await ui.button('end phase')
      await ui.button('march')
      await ui.clearing(10)
      await ui.clearing(9)
      await ui.button('OK')
      await ui.button('OK')
    },
    verify: (state) => {
      const woodOnMap = state.clearings.reduce(
        (total, clearing, clearingId) => total + piecesOfType(state, clearingId, 'wood'),
        0,
      )
      expectEqual(woodOnMap, 0, 'wood on map')
      expectEqual(warriorsIn(state, 9, MARQUISE), 1, 'Cat on 9')
      return 'No wood (sawmill sanctified); moved along the river'
    },
  },
  {
    title: '36 · Battle the lone post on 11: Trade Disruption (R16)',
    play: async (ui) => {
      await ui.button('battle')
      await ui.clearing(11)
      await ui.resolveBattle({ fieldHospitals: false })
    },
    verify: (state) => {
      const riverfolk = board(state, RIVERFOLK)
      expectEqual(piecesOfType(state, 11, 'tradePost'), 0, 'posts on 11')
      expectEqual(victoryPoints(state)[MARQUISE], 1, 'Cat VP')
      expectEqual(riverfolk.funds.length, 1, 'funds')
      expectEqual(riverfolk.supply.warriors, 4, 'Riverfolk supply')
      expectEqual(riverfolk.tradePosts.fox, 2, 'fox track')
      return 'Dice 0 / 0, defenseless hit removes the post; half the funds lost; post out of game'
    },
  },
  {
    title: '37 · Battle the Cult on 4: Revenge + mercenary split (L13 R14)',
    play: async (ui) => {
      const cultSupplyBefore = board(await ui.fetchState(), LIZARD).supply.warriors
      await ui.button('battle')
      await ui.clearing(4)
      await ui.button('OK')
      const defender = (await ui.fetchState()).pending[0]?.defender
      await ui.resolveBattle({ fieldHospitals: true })
      return { cultSupplyBefore, defender }
    },
    verify: (state, seen) => {
      expectEqual(seen.defender, LIZARD, 'defender')
      expectEqual(board(state, LIZARD).acolytes, 3, 'acolytes')
      expectEqual(board(state, LIZARD).supply.warriors, seen.cultSupplyBefore, 'Cult supply')
      expectEqual(warriorsIn(state, 4, LIZARD), 0, 'Cult on 4')
      expectEqual(warriorsIn(state, 4, MARQUISE), 2, 'Cat on 4')
      expectEqual(warriorsIn(state, 4, RIVERFOLK), 0, 'Riverfolk on 4')
      expectEqual(piecesOfType(state, 4, 'garden'), 2, 'gardens on 4')
      expectEqual(piecesOfType(state, 4, 'tradePost'), 1, 'posts on 4')
      return 'Dice 2 / 2: Cult warriors → Acolytes (1 → 3); Cat hits split with the mercenary'
    },
  },
  {
    title: '38 · Spend bird, battle the garden on 5: Fear of the Faithful (L15)',
    play: async (ui) => {
      await ui.button('spend bird')
      await ui.handCard(CARD.crossbowBird)
      await ui.button('battle')
      await ui.clearing(5)
      await ui.resolveBattle({ fieldHospitals: false })
    },
    verify: (state) => {
      expectEqual(piecesOfType(state, 5, 'garden'), 0, 'gardens on 5')
      expectEqual(board(state, LIZARD).gardens.fox, 4, 'fox gardens on track')
      expectEqual(handOf(state, LIZARD).length, 4, 'Cult hand')
      expectEqual(victoryPoints(state)[MARQUISE], 2, 'Cat VP')
      return 'Garden back on the track; Cult lost a random card → Lost Souls; Cat +1 VP'
    },
  },
  {
    title: '39–40 · Riverfolk Birdsong: no Protectionism (R1 R2 R3)',
    play: async (ui) => {
      const supplyBefore = board(await ui.fetchState(), RIVERFOLK).supply.warriors
      await ui.button('end phase')
      await ui.waitForButton('trade post')
      return { supplyBefore }
    },
    verify: (state, seen) => {
      const riverfolk = board(state, RIVERFOLK)
      expectEqual(state.currentSeat, RIVERFOLK, 'seat')
      expectEqual(riverfolk.supply.warriors, seen.supplyBefore, 'Riverfolk supply')
      expectEqual(victoryPoints(state)[RIVERFOLK], 7, 'Riverfolk VP')
      expectEqual(riverfolk.funds.length, 12, 'funds')
      return 'Payments were not empty → no free warriors; 0 VP for 1 fund; 12 funds gathered'
    },
  },
  {
    title: '41–42 · Pass to the Cult; Lost Souls fox again → Hated (L16)',
    play: async (ui) => {
      await ui.button('end phase')
      await ui.button('end phase')
      await ui.waitForButton('no service')
      const before = await ui.lookAtBoard('lizard', readLostSouls)
      await ui.button('no service')
      await ui.waitForButton('convert')
      const after = await ui.lookAtBoard('lizard', readLostSouls)
      return { before, after }
    },
    verify: (state, seen) => {
      expectEqual(seen.before.leadingSuits, ['fox: 3'], 'highlighted suit')
      expectEqual(seen.after.outcastMarker, 'Hated Outcast', 'marker side')
      expectEqual(board(state, LIZARD).outcast, 'fox', 'outcast')
      expectEqual(board(state, LIZARD).hated, true, 'hated')
      return 'Riverfolk discarded nothing; fox leads and is already Outcast → Hated side'
    },
  },
  {
    title: '43 · Convert at the Hated discount (L16)',
    play: async (ui) => {
      await ui.button('convert')
      await ui.clearing(7)
      await ui.button('riverfolk')
    },
    verify: (state) => {
      expectEqual(board(state, LIZARD).acolytes, 2, 'acolytes')
      expectEqual(warriorsIn(state, 7, LIZARD), 4, 'Cult on 7')
      return 'Acolytes 3 → 2: conspiracy costs 1 instead of 2'
    },
  },
]

const SETUP_KEEP_CLEARING = 2
const SETUP_CULT_CORNER = 0
const SETUP_RIVERFOLK_PLACEMENTS = [6, 6, 10, 3]

export const SETUP_STEPS = [
  {
    title: 'A · Marquise: keep on corner 2, sawmill, workshop, recruiter',
    play: async (ui) => {
      for (const clearingId of [SETUP_KEEP_CLEARING, 5, 10, SETUP_KEEP_CLEARING]) {
        await ui.clearing(clearingId)
      }
    },
    verify: (state) => {
      expectEqual(piecesOfType(state, SETUP_KEEP_CLEARING, 'keep'), 1, 'keep')
      expectEqual(state.pending[0]?.type, 'chooseCultCorner', 'pending')
      return 'Keep + 3 buildings placed; Cult chooses its corner next'
    },
  },
  {
    title: 'B · Cult: starting corner opposite the keep (S1)',
    play: async (ui) => {
      const offered = legalValues(await ui.fetchLegalActions(), 'resolveEvent', 'clearing')
      await ui.clearing(SETUP_CULT_CORNER)
      return { offered }
    },
    verify: (state, seen) => {
      expectEqual(seen.offered, [SETUP_CULT_CORNER], 'corners offered')
      expectEqual(warriorsIn(state, SETUP_CULT_CORNER, LIZARD), 4, 'Cult on the corner')
      expectEqual(piecesOfType(state, SETUP_CULT_CORNER, 'garden'), 1, 'gardens')
      for (const clearingId of CULT_ADJACENT_TO_CORNER) {
        expectEqual(warriorsIn(state, clearingId, LIZARD), 1, `Cult on ${clearingId}`)
      }
      return 'Only corner 0 offered; 4 warriors + garden, 1 warrior in each adjacent clearing'
    },
  },
  {
    title: 'C · Cult: choose the Outcast suit (S1)',
    play: (ui) => ui.button('fox'),
    verify: (state) => {
      expectEqual(board(state, LIZARD).outcast, 'fox', 'outcast')
      expectEqual(board(state, LIZARD).hated, false, 'hated')
      return 'Marker on fox, Outcast side'
    },
  },
  {
    title: 'D · Riverfolk: place 4 warriors on the river (S2)',
    play: async (ui) => {
      const offered = legalValues(await ui.fetchLegalActions(), 'resolveEvent', 'clearing')
      for (const clearingId of SETUP_RIVERFOLK_PLACEMENTS) {
        await ui.clearing(clearingId)
      }
      return { offered }
    },
    verify: (state, seen) => {
      expectEqual(seen.offered, RIVER_CLEARINGS, 'clearings offered')
      const placed = RIVER_CLEARINGS.reduce(
        (total, clearingId) => total + warriorsIn(state, clearingId, RIVERFOLK),
        0,
      )
      expectEqual(placed, 4, 'Riverfolk warriors on the river')
      expectEqual(board(state, RIVERFOLK).payments.length, 3, 'payments')
      return 'Only river clearings offered (never the keep); Payments starts with 3'
    },
  },
  {
    title: 'E · Riverfolk: starting costs, then the Marquise service prompt (S2)',
    play: async (ui) => {
      await ui.button('Cost 2')
      await ui.button('Cost 1')
      await ui.button('Cost 4')
      await ui.waitForButton('buy service')
    },
    verify: (state) => {
      const costs = board(state, RIVERFOLK).serviceCosts
      expectEqual(costs, { handCard: 2, riverboats: 1, mercenaries: 4 }, 'costs')
      expectEqual(state.pending[0], { type: 'buyServices', buyer: MARQUISE, bought: 0 }, 'pending')
      return 'Costs 2 / 1 / 4 set; first turn opens with the Marquise service prompt'
    },
  },
]
