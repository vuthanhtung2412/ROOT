/**
 * Steps of the Lizard Cult + Riverfolk Company QA run (replay-lizard-riverfolk-qa.mjs):
 * shared helpers + Parts 1–3 up to the Cult Daylight (plan steps 1–25).
 * Plan: resources/notes/QA-plan-lizard-riverfolk.md — titles carry the plan step numbers.
 *
 * One step: `play` clicks through the UI (and may return what it saw on the page),
 * `verify` checks server state and returns the caption detail.
 */
const MARQUISE = 0
const RIVERFOLK = 1
const LIZARD = 2

const RIVER_CLEARINGS = [3, 4, 6, 9, 10]
const FOX_CLEARINGS = [0, 5, 7, 11]
const MOUSE_CLEARINGS = [1, 6, 8, 10]

const CARD = {
  anvil: 'ROOT-204',
  visitToFriends: 'ROOT-206',
  bakeSale: 'ROOT-207',
  birdyBindle: 'ROOT-208',
  crossbowBird: 'ROOT-209',
  dominanceBird: 'ROOT-211',
  foxfolkSteel: 'ROOT-215',
  mouseInASack: 'ROOT-218',
  rootTeaFox: 'ROOT-221',
  smugglersTrail: 'ROOT-223',
  travelGearFox: 'ROOT-225',
}

function expectThat(condition, message) {
  if (!condition) throw new Error(message)
}

function expectEqual(actual, expected, label) {
  const actualText = JSON.stringify(actual)
  const expectedText = JSON.stringify(expected)
  expectThat(actualText === expectedText, `${label} = ${actualText}, expected ${expectedText}`)
}

const board = (state, seat) => state.players[seat].board
const victoryPoints = (state) => state.players.map((player) => player.vp)
const handOf = (state, seat) => state.players[seat].hand.map((card) => card.defId)
const lostSouls = (state) => state.deck.lostSouls.map((card) => card.defId)
const ownedBy = (seats, owner) => seats.filter((seat) => seat === owner).length

function warriorsIn(state, clearingId, owner) {
  return state.clearings[clearingId].pieces.filter(
    (piece) => piece.kind === 'warrior' && piece.owner === owner,
  ).length
}

function piecesOfType(state, clearingId, type) {
  return state.clearings[clearingId].pieces.filter((piece) => piece.type === type).length
}

/**
 * Every value the legal actions of `type` offer for `parameter`, sorted.
 * Specs list values either directly (`params.clearing`) or per option (`params.options[]`).
 */
function legalValues(actions, type, parameter) {
  const values = actions
    .filter((action) => action.type === type)
    .flatMap((action) => [
      ...(action.params?.[parameter] ?? []),
      ...(action.params?.options ?? []).flatMap((option) => option[parameter] ?? []),
    ])
  return [...new Set(values)].sort((left, right) => (left < right ? -1 : 1))
}

/** Card ids the legal actions of `type` accept (single-card or card-list specs). */
function legalCardIds(actions, type) {
  return [...legalValues(actions, type, 'cardId'), ...legalValues(actions, type, 'cardIds')]
}

/** Clearings the legal actions of `type` offer for one card definition. */
function legalClearingsForCard(actions, type, cardDefinitionId) {
  const clearings = actions
    .filter((action) => action.type === type)
    .flatMap((action) => action.params?.options ?? [])
    .filter((option) => String(option.cardId).startsWith(cardDefinitionId))
    .map((option) => option.clearing)
  return [...new Set(clearings)].sort((left, right) => left - right)
}

function expectSubset(values, allowed, label) {
  expectThat(values.length > 0, `${label}: nothing offered`)
  expectThat(
    values.every((value) => allowed.includes(value)),
    `${label} offered ${JSON.stringify(values)}, allowed ${JSON.stringify(allowed)}`,
  )
}

/** Lost Souls frame on the Cult board: pile size + highlighted (most common) suit. */
async function readLostSouls(page) {
  const pile = page.locator('.lizard-lost-souls')
  return {
    pileLabel: await pile.getAttribute('aria-label'),
    leadingSuits: await pile
      .locator('span[title].font-bold')
      .evaluateAll((elements) => elements.map((element) => element.title)),
    outcastMarker: await page
      .locator('.faction-board-modal img[alt="Outcast"], .faction-board-modal img[alt="Hated Outcast"]')
      .first()
      .getAttribute('alt'),
  }
}

const readRevealedPanel = (page) => page.locator('.lizard-revealed').getAttribute('aria-label')

export const RIVERFOLK_TURN_TO_CULT_DAYLIGHT_STEPS = [
  {
    title: '1–2 · Marquise turn ends → Riverfolk Birdsong (R1 R2 R3)',
    play: (ui) => ui.waitForButton('trade post'),
    verify: (state) => {
      const riverfolk = board(state, RIVERFOLK)
      expectEqual(victoryPoints(state), [0, 3, 0], 'VP')
      expectEqual(riverfolk.supply.warriors, 4, 'Riverfolk supply')
      expectEqual(riverfolk.funds.length, 11, 'funds')
      expectEqual(ownedBy(riverfolk.funds, RIVERFOLK), 5, 'own funds')
      expectEqual(riverfolk.payments.length + riverfolk.committed.length, 0, 'payments + committed')
      return 'Protectionism 2 warriors, +3 VP dividends, 11 funds (UI auto-ends empty phases)'
    },
  },
  {
    title: '3 · Recruit on 9 with a Marquise fund (R9)',
    play: async (ui) => {
      await ui.button('recruit')
      const offered = legalValues(await ui.fetchLegalActions(), 'riverfolkRecruit', 'clearing')
      await ui.clearing(9)
      await ui.button('marquise fund')
      return { offered }
    },
    verify: (state, seen) => {
      expectEqual(seen.offered, RIVER_CLEARINGS, 'recruit clearings')
      expectEqual(warriorsIn(state, 9, RIVERFOLK), 1, 'Riverfolk on 9')
      expectEqual(board(state, MARQUISE).supply.warriors, 8, 'Cat supply')
      expectEqual(board(state, RIVERFOLK).funds.length, 10, 'funds')
      return 'Only river clearings offered; spent fund back to the Cat supply (7 → 8)'
    },
  },
  {
    title: '4 · Trade post on 4, ruled by the Cult garden (R10 L14)',
    play: async (ui) => {
      await ui.button('trade post')
      const offered = legalValues(await ui.fetchLegalActions(), 'establishTradePost', 'clearing')
      await ui.clearing(4)
      return { offered }
    },
    verify: (state, seen) => {
      const riverfolk = board(state, RIVERFOLK)
      expectThat(seen.offered.includes(4), `clearing 4 not offered: ${JSON.stringify(seen.offered)}`)
      expectThat(!seen.offered.includes(11), 'clearing 11 offered though it has a post')
      expectEqual(piecesOfType(state, 4, 'tradePost'), 1, 'posts on 4')
      expectEqual(warriorsIn(state, 4, RIVERFOLK), 1, 'garrison on 4')
      expectEqual(ownedBy(riverfolk.funds, LIZARD), 0, 'Cult funds left')
      expectEqual(board(state, LIZARD).supply.warriors, 9, 'Cult supply')
      expectEqual(victoryPoints(state)[RIVERFOLK], 5, 'Riverfolk VP')
      expectEqual(riverfolk.tradePosts.rabbit, 2, 'rabbit track')
      return 'Paid with both Cult funds (Pilgrims: garden rules); +2 VP, garrison placed'
    },
  },
  {
    title: '5 · Craft Anvil on the fox Trade Posts space (R6)',
    play: async (ui) => {
      await ui.button('craft')
      await ui.handCard(CARD.anvil)
      await ui.button('Craft')
    },
    verify: (state) => {
      expectEqual(state.players[RIVERFOLK].craftedItems.length, 1, 'items')
      expectEqual(victoryPoints(state)[RIVERFOLK], 7, 'Riverfolk VP')
      expectEqual(board(state, RIVERFOLK).craftCommitted.fox.length, 1, 'fox space funds')
      expectThat(lostSouls(state).includes(CARD.anvil), 'Anvil not in Lost Souls')
      return 'Item +2 VP; fund on the fox space; card → Lost Souls'
    },
  },
  {
    title: '6 · Export A Visit To Friends (R7)',
    play: async (ui) => {
      await ui.button('craft')
      await ui.handCard(CARD.visitToFriends)
      await ui.button('Export (warrior to Payments)')
    },
    verify: (state) => {
      const riverfolk = board(state, RIVERFOLK)
      expectEqual(victoryPoints(state)[RIVERFOLK], 7, 'Riverfolk VP')
      expectEqual(state.players[RIVERFOLK].craftedItems.length, 1, 'items')
      expectEqual(riverfolk.payments, [RIVERFOLK], 'payments')
      expectEqual(riverfolk.craftCommitted.rabbit.length, 1, 'rabbit space funds')
      expectThat(lostSouls(state).includes(CARD.visitToFriends), 'card not in Lost Souls')
      return 'No item, no VP; own warrior → Payments; fund on the rabbit space'
    },
  },
  {
    title: '7 · Move 10 → 9 by river, 2 warriors, Marquise fund (R4)',
    play: async (ui) => {
      await ui.button('move')
      await ui.clearing(10)
      await ui.clearing(9)
      await ui.button('>')
      await ui.button('OK')
      await ui.button('marquise fund')
    },
    verify: (state) => {
      expectEqual(warriorsIn(state, 9, RIVERFOLK), 3, 'Riverfolk on 9')
      expectEqual(warriorsIn(state, 10, RIVERFOLK), 0, 'Riverfolk on 10')
      expectEqual(board(state, RIVERFOLK).committed, [MARQUISE], 'committed')
      return 'Swimmers: no path 10–9, moved along the river; chosen fund → Committed'
    },
  },
  {
    title: '8 · Battle the Marquise on 6 (R5)',
    play: async (ui) => {
      await ui.button('battle')
      await ui.clearing(6)
      await ui.resolveBattle({ fieldHospitals: true })
    },
    verify: (state) => {
      expectEqual(warriorsIn(state, 6, MARQUISE), 0, 'Cat on 6')
      expectEqual(warriorsIn(state, 6, RIVERFOLK), 2, 'Riverfolk on 6')
      expectEqual(board(state, RIVERFOLK).committed, [MARQUISE, RIVERFOLK], 'committed')
      return 'Dice 1 / 0: Cat warrior removed, no Riverfolk loss; own fund committed'
    },
  },
  {
    title: '9 · Draw (R8)',
    play: (ui) => ui.button('draw'),
    verify: (state) => {
      expectEqual(handOf(state, RIVERFOLK).length, 6, 'hand')
      expectEqual(board(state, RIVERFOLK).committed.length, 3, 'committed')
      expectEqual(board(state, RIVERFOLK).funds.length, 3, 'funds')
      return '+1 card (6 in hand); 3 funds left'
    },
  },
  {
    title: '10 · Evening: discard down to 5 (R11)',
    play: async (ui) => {
      await ui.button('end phase')
      await ui.button('discard')
      const drawnCard = handOf(await ui.fetchState(), RIVERFOLK).at(-1)
      await ui.handCard(drawnCard)
      await ui.button('OK')
    },
    verify: (state) => {
      expectEqual(handOf(state, RIVERFOLK).length, 5, 'hand')
      expectEqual(lostSouls(state).length, 8, 'Lost Souls')
      expectEqual(state.step, 'costs', 'step')
      return 'Forced discard of 1 → Lost Souls; Set Costs step opens'
    },
  },
  {
    title: '11–12 · Set Mercenaries to cost 2, end turn (R11)',
    play: async (ui) => {
      await ui.button('set costs')
      await ui.button('Mercenaries 2')
      await ui.button('OK')
      await ui.button('end phase')
      await ui.waitForButton('buy service')
    },
    verify: (state) => {
      const costs = board(state, RIVERFOLK).serviceCosts
      expectEqual(costs, { handCard: 1, riverboats: 1, mercenaries: 2 }, 'costs')
      expectEqual(state.currentSeat, LIZARD, 'seat')
      expectEqual(state.pending[0]?.type, 'buyServices', 'pending')
      return 'Marker moved; Cult turn starts with the service prompt'
    },
  },
  {
    title: '13 · Cult buys Hand Card: Birdy Bindle (R12 R15)',
    play: async (ui) => {
      await ui.button('buy service')
      await ui.button('Hand Card')
      await ui.galleryCard(CARD.birdyBindle)
    },
    verify: (state) => {
      expectThat(handOf(state, LIZARD).includes(CARD.birdyBindle), 'card not in the Cult hand')
      expectEqual(ownedBy(board(state, RIVERFOLK).payments, LIZARD), 1, 'Cult payments')
      expectEqual(state.pending[0]?.type, 'buyServices', 'pending')
      return 'Picked from the public hand; prompt stays open (post on 4 → 2 services)'
    },
  },
  {
    title: '14 · Lost Souls: fox leads → Outcast becomes fox (L1 L2)',
    play: async (ui) => {
      const before = await ui.lookAtBoard('lizard', readLostSouls)
      await ui.button('no service')
      await ui.waitForButton('convert')
      const after = await ui.lookAtBoard('lizard', readLostSouls)
      return { before, after }
    },
    verify: (state, seen) => {
      expectEqual(seen.before.leadingSuits, ['fox: 4'], 'highlighted suit')
      expectEqual(seen.after.pileLabel, 'Observe Lost Souls (0)', 'pile after adjust')
      expectEqual(seen.after.outcastMarker, 'Outcast', 'marker side')
      expectEqual(board(state, LIZARD).outcast, 'fox', 'outcast')
      expectEqual(board(state, LIZARD).hated, false, 'hated')
      expectEqual(lostSouls(state).length, 0, 'Lost Souls')
      expectThat(
        JSON.stringify(state.dominanceAvailable).includes(CARD.dominanceBird),
        'bird Dominance not available',
      )
      return 'Tally showed fox 4 highlighted; marker → fox, pile emptied, Dominance available'
    },
  },
  {
    title: '15 · Convert the Riverfolk warrior on 7 (L5)',
    play: async (ui) => {
      await ui.button('convert')
      const offered = legalValues(await ui.fetchLegalActions(), 'convert', 'clearing')
      await ui.clearing(7)
      await ui.button('riverfolk')
      return { offered }
    },
    verify: (state, seen) => {
      expectSubset(seen.offered, FOX_CLEARINGS, 'convert clearings')
      expectEqual(warriorsIn(state, 7, LIZARD), 3, 'Cult on 7')
      expectEqual(warriorsIn(state, 7, RIVERFOLK), 1, 'Riverfolk on 7')
      expectEqual(warriorsIn(state, 7, MARQUISE), 2, 'Cat on 7')
      expectEqual(board(state, LIZARD).acolytes, 7, 'acolytes')
      return 'Only Outcast (fox) clearings; enemy warrior → Cult warrior; acolytes 9 → 7'
    },
  },
  {
    title: '16 · Crusade: battle on 7, defender Marquise (L3)',
    play: async (ui) => {
      await ui.button('crusade: battle')
      await ui.clearing(7)
      await ui.button('marquise')
      await ui.resolveBattle({ fieldHospitals: true })
      await ui.waitForButton('sanctify')
    },
    verify: (state) => {
      expectEqual(board(state, LIZARD).acolytes, 5, 'acolytes')
      expectEqual(warriorsIn(state, 7, MARQUISE), 1, 'Cat on 7')
      expectEqual(warriorsIn(state, 7, LIZARD), 3, 'Cult on 7')
      return 'Defender picked by name; dice 1 / 0; tray returns after Field Hospitals'
    },
  },
  {
    title: '17 · Sanctify the sawmill on 5 (L6)',
    play: async (ui) => {
      await ui.button('sanctify')
      await ui.clearing(5)
    },
    verify: (state) => {
      expectEqual(piecesOfType(state, 5, 'sawmill'), 0, 'sawmills on 5')
      expectEqual(piecesOfType(state, 5, 'garden'), 1, 'gardens on 5')
      expectEqual(victoryPoints(state)[LIZARD], 1, 'Cult VP')
      expectEqual(board(state, LIZARD).acolytes, 2, 'acolytes')
      expectEqual(board(state, LIZARD).gardens.fox, 3, 'fox gardens on track')
      return 'Sawmill → garden, +1 VP; acolytes 5 → 2; 2 fox gardens on the map'
    },
  },
  {
    title: '18 · Crusade: move 0 → 8 with 2 warriors (L4)',
    play: async (ui) => {
      await ui.button('crusade: move')
      await ui.clearing(0)
      await ui.clearing(8)
      await ui.button('>')
      await ui.button('OK')
      const actionTypes = (await ui.fetchLegalActions()).map((action) => action.type)
      return { actionTypes: [...new Set(actionTypes)].sort() }
    },
    verify: (state, seen) => {
      expectEqual(board(state, LIZARD).acolytes, 0, 'acolytes')
      expectEqual(warriorsIn(state, 8, LIZARD), 2, 'Cult on 8')
      expectEqual(seen.actionTypes, ['crusadeBattle', 'skipCrusadeBattle'], 'tray')
      return 'Acolytes 2 → 0; tray only offers crusade: battle / skip battle'
    },
  },
  {
    title: '19–20 · Follow-up battle on 8 → Daylight (L4)',
    play: async (ui) => {
      await ui.button('crusade: battle')
      await ui.resolveBattle({ fieldHospitals: true })
      await ui.waitForButton('build garden')
    },
    verify: (state) => {
      expectEqual(board(state, LIZARD).acolytes, 0, 'acolytes')
      expectEqual(warriorsIn(state, 8, MARQUISE), 0, 'Cat on 8')
      expectEqual(warriorsIn(state, 8, LIZARD), 2, 'Cult on 8')
      expectEqual(state.phase, 'daylight', 'phase')
      return 'No extra acolyte cost; dice 1 / 0; nothing left to conspire → Daylight'
    },
  },
  {
    title: '21 · Build a garden on 4 with Bake Sale (L7 L14)',
    play: async (ui) => {
      await ui.button('build garden')
      await ui.handCard(CARD.bakeSale)
    },
    verify: (state) => {
      expectEqual(piecesOfType(state, 4, 'garden'), 2, 'gardens on 4')
      expectThat(warriorsIn(state, 4, MARQUISE) > warriorsIn(state, 4, LIZARD), 'Cat not ahead on 4')
      expectEqual(board(state, LIZARD).revealed.map((card) => card.defId), [CARD.bakeSale], 'revealed')
      return 'Built while outnumbered 3 to 2 (Pilgrims); card revealed, not spent'
    },
  },
  {
    title: '22 · Recruit on 8 with Mouse-in-a-sack (L8)',
    play: async (ui) => {
      await ui.button('recruit')
      await ui.handCard(CARD.mouseInASack)
      const offered = legalClearingsForCard(
        await ui.fetchLegalActions(),
        'ritualRecruit',
        CARD.mouseInASack,
      )
      await ui.clearing(8)
      const revealedPanel = await ui.lookAtBoard('lizard', readRevealedPanel)
      return { offered, revealedPanel }
    },
    verify: (state, seen) => {
      expectSubset(seen.offered, MOUSE_CLEARINGS, 'recruit clearings')
      expectEqual(warriorsIn(state, 8, LIZARD), 3, 'Cult on 8')
      expectEqual(seen.revealedPanel, 'Revealed cards (2)', 'Revealed panel')
      return 'Only mouse clearings; +1 warrior on 8; Revealed panel shows 2 cards'
    },
  },
  {
    title: '23–24 · Score Root Tea (fox); fox cannot score twice (L9)',
    play: async (ui) => {
      await ui.button('score')
      await ui.handCard(CARD.rootTeaFox)
      const scoreAgain = legalCardIds(await ui.fetchLegalActions(), 'ritualScore')
      return { scoreAgain }
    },
    verify: (state, seen) => {
      expectEqual(victoryPoints(state)[LIZARD], 3, 'Cult VP')
      expectThat(lostSouls(state).includes(CARD.rootTeaFox), 'Root Tea not in Lost Souls')
      expectEqual(seen.scoreAgain, [], 'score offers after fox')
      expectThat(handOf(state, LIZARD).includes(CARD.travelGearFox), 'Travel Gear left the hand')
      return '+2 VP (2 fox gardens on map), card spent; Travel Gear (fox) no longer scorable'
    },
  },
  {
    title: '25 · Sacrifice Birdy Bindle (L10)',
    play: async (ui) => {
      const actions = await ui.fetchLegalActions()
      const birdCardId = (await ui.fetchState()).players[LIZARD].hand.find(
        (card) => card.defId === CARD.birdyBindle,
      ).id
      const birdRituals = ['ritualBuild', 'ritualRecruit', 'ritualScore'].filter((type) =>
        legalCardIds(actions, type).includes(birdCardId),
      )
      const sacrificeCards = legalCardIds(actions, 'ritualSacrifice')
      await ui.button('sacrifice')
      return { birdRituals, sacrificeCards, birdCardId }
    },
    verify: (state, seen) => {
      expectEqual(seen.birdRituals, [], 'rituals offering the bird card')
      expectEqual(seen.sacrificeCards, [seen.birdCardId], 'sacrifice cards')
      expectEqual(board(state, LIZARD).acolytes, 1, 'acolytes')
      return 'Bird card only offered for Sacrifice; +1 acolyte'
    },
  },
]

/** Shared with lizard-riverfolk-qa-later-steps.mjs (Cult Evening, Parts 4–5 and 0). */
export {
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
}
