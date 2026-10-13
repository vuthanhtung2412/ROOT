/**
 * Steps of the action dock demo (replay-action-dock-qa.mjs).
 * Plan: resources/notes/QA-plan-action-dock.md — titles carry the plan step
 * numbers and the feature ids (D1…D14) each step shows.
 *
 * One step: `play` clicks through the UI and returns what it saw on the page,
 * `verify` checks the server state and the page evidence, and returns the
 * caption detail.
 */
const MARQUISE = 0
const EYRIE = 1
const ALLIANCE = 2

const KEEP_CLEARING = 2
const MARCH_DESTINATION = 5
const LEAGUE_ORIGIN = 10
const LEAGUE_DESTINATION = 11
const ROOST_CLEARING = 0
const EYRIE_FIRST_MOVE_DESTINATION = 4
const EYRIE_SECOND_MOVE_DESTINATION = 8
const BASE_CLEARING = 9
const ALLIANCE_MOVE_DESTINATION = 11

const FOXFOLK_STEEL = 'ROOT-215'
const BAKE_SALE = 'ROOT-207'
/** Add to Decree takes two cards at most. */
const MAXIMUM_STAGED_CARDS = 2
/** On the map, under the Decree panel: a staged card dropped here goes back to the hand. */
const OFF_PANEL_POINT = { x: 720, y: 560 }
const FACTION_COLORS = { marquise: '#c45c26', eyrie: '#3a5f8a', alliance: '#3d7a4a' }
const MILITARY_OPERATIONS = ['move', 'battle', 'recruit', 'organize']
const DECREE_COLUMN_COUNT = 4
const DOCK_COLUMNS = 4
/** Four 54px tiles and three 8px gaps. */
const DOCK_GRID_WIDTH_PIXELS = 240
/** The dock and the info buttons sit this close to their corner. */
const CORNER_MARGIN_PIXELS = 24

/** How long each look stays on screen before the next click. */
const LOOK_MS = 1600
const TOOLTIP_LOOK_MS = 1100
const MARCH_WALK_MS = 3800
const ANIMATION_START_WAIT_MS = 2500

const SELECTOR = {
  dock: '.action-dock',
  cardsTab: '.action-dock__cards-tab',
  cardRow: '.action-dock__card-action',
  readyCardRow: '.action-dock__card-action[aria-disabled="false"]',
  playedCardRow: '.action-dock__card-action:has(.line-through)',
  cardRule: '.action-dock__card-action [title]',
  spentTile: '.action-dock button.action-tray__action:disabled',
  undoTile: '.action-dock .game-drawer__undo',
  decree: '.action-dock__decree',
  decreeHead: '.action-dock__decree .size-14',
  decreeMark: '.action-dock__decree img',
  footstep: '.board-effects svg.overflow-visible',
  infoButtons: 'button:has-text("Discarded (")',
  decreePanel: '.decree-panel',
  decreeSlot: '.decree-panel__slot',
  offeredSlot: '.decree-panel__slot.border-dashed',
  stagedCard: '.decree-panel__staged',
  confirmTile: '.decree-panel__confirm',
  takeBackTile: '.decree-panel__take-back',
  ringedTile: '.action-dock button.shadow-gold-ring',
  stagedCount: '.action-tray__count',
  countedTile: '.action-dock button:has(.action-tray__count)',
}

const decreeSlot = (column) => `${SELECTOR.decreeSlot}[data-decree-column="${column}"]`
const stagedCard = (cardDefinitionId) =>
  `${SELECTOR.stagedCard}[aria-label="take back ${cardDefinitionId}"]`
const handCard = (cardDefinitionId) =>
  `button:not(.card-gallery-modal__card):not([aria-pressed]):has(> img[alt="${cardDefinitionId}"])`

function expectThat(condition, message) {
  if (!condition) throw new Error(message)
}

function expectEqual(actual, expected, label) {
  const actualText = JSON.stringify(actual)
  const expectedText = JSON.stringify(expected)
  expectThat(actualText === expectedText, `${label} = ${actualText}, expected ${expectedText}`)
}

const board = (state, seat) => state.players[seat].board
const handOf = (state, seat) => state.players[seat].hand.map((card) => card.defId)

function warriorsIn(state, clearingId, owner) {
  return state.clearings[clearingId].pieces.filter(
    (piece) => piece.kind === 'warrior' && piece.owner === owner,
  ).length
}

/** From clearing, to clearing, then `extraWarriors` more on the count stepper. */
async function pickMove(ui, from, to, extraWarriors) {
  await ui.clearing(from)
  await ui.clearing(to)
  for (let step = 0; step < extraWarriors; step++) {
    await ui.button('>')
  }
  await ui.button('OK')
}

/** What a move draws while it walks: footsteps, and their colour. */
async function watchMarch(ui) {
  const footsteps = await ui.sees(SELECTOR.footstep)
  const footstepColor = await ui.footstepColor()
  await ui.pause(MARCH_WALK_MS)
  return { footsteps, footstepColor }
}

function expectMarch(seen, faction) {
  expectThat(seen.footsteps, 'no footsteps drawn for the move')
  expectEqual(seen.footstepColor, FACTION_COLORS[faction], 'footstep colour')
}

export const ACTION_DOCK_STEPS = [
  {
    title: '1 · Marquise Birdsong: faction dock in the corner; log, items, discard top right (D1 D2)',
    play: async (ui) => {
      await ui.waitForButton('end phase')
      const dock = await ui.dockLook()
      const info = await ui.cornerOf(SELECTOR.infoButtons)
      await ui.hoverButton('end phase')
      const tooltip = await ui.seesText('end phase')
      await ui.pause(TOOLTIP_LOOK_MS)
      return { dock, info, tooltip }
    },
    verify: (state, seen) => {
      expectEqual(state.currentSeat, MARQUISE, 'seat')
      expectEqual(seen.dock.color, FACTION_COLORS.marquise, 'dock frame colour')
      expectThat(seen.dock.tab.includes('birdsong'), `phase tab = ${seen.dock.tab}`)
      expectThat(
        seen.dock.fromRight < CORNER_MARGIN_PIXELS && seen.dock.fromBottom < CORNER_MARGIN_PIXELS,
        `dock not in the bottom right corner: ${JSON.stringify(seen.dock)}`,
      )
      expectThat(
        seen.info.fromRight < CORNER_MARGIN_PIXELS && seen.info.fromTop < CORNER_MARGIN_PIXELS,
        `info buttons not in the top right corner: ${JSON.stringify(seen.info)}`,
      )
      expectThat(seen.tooltip, 'no tooltip names the hovered tile')
      return 'Orange dock bottom right, icon tiles named on hover; log / items / discard top right'
    },
  },
  {
    title: '2 · Cards panel: crafted-card actions of every phase; full rule on hover (D3 D4)',
    play: async (ui) => {
      const tabBefore = await ui.textOfSelector(SELECTOR.cardsTab)
      await ui.click(SELECTOR.cardsTab)
      const rows = await ui.count(SELECTOR.cardRow)
      const readyRows = await ui.count(SELECTOR.readyCardRow)
      const rule = await ui.clampedRule(SELECTOR.cardRule)
      await ui.hover(SELECTOR.cardRule)
      await ui.pause(LOOK_MS)
      await ui.click(SELECTOR.cardsTab)
      return { tabBefore, rows, readyRows, rule }
    },
    verify: (_state, seen) => {
      expectThat(seen.tabBefore.includes('0/1 played'), `Cards tab = ${seen.tabBefore}`)
      expectEqual(seen.rows, 5, 'card action lines')
      expectEqual(seen.readyRows, 1, 'lines ready in Birdsong')
      expectThat(seen.rule.isClamped, 'no rule text is clamped')
      expectThat(seen.rule.title === seen.rule.fullText, 'hover title is not the full rule')
      return `5 lines, only Swap Meet lit in Birdsong; clamped rule carries its full text as hover title (${String(seen.rule.title.length)} chars)`
    },
  },
  {
    title: '3 · Daylight: four tiles wide, budget 3/3; Recruit spent stays, faded (D5 D6)',
    play: async (ui) => {
      await ui.button('end phase')
      await ui.waitForState((state) => state.step === 'craft')
      await ui.button('end phase')
      await ui.waitForButton('recruit')
      const before = await ui.dockLook()
      await ui.hoverButton('march')
      await ui.pause(TOOLTIP_LOOK_MS)
      await ui.button('recruit')
      await ui.waitForState((state) => state.turnScratch.actionsLeft === 2)
      await ui.pause(LOOK_MS)
      const after = await ui.dockLook()
      const spent = await ui.textsOf(SELECTOR.spentTile)
      const undoInDock = await ui.count(SELECTOR.undoTile)
      return { before, after, spent, undoInDock }
    },
    verify: (state, seen) => {
      expectEqual(state.phase, 'daylight', 'phase')
      expectThat(seen.before.tab.includes('3/3'), `budget before = ${seen.before.tab}`)
      expectThat(seen.after.tab.includes('2/3'), `budget after = ${seen.after.tab}`)
      expectEqual(seen.before.gridColumns, DOCK_COLUMNS, 'phase tile columns')
      expectEqual(seen.before.gridWidth, DOCK_GRID_WIDTH_PIXELS, 'phase tile grid width')
      expectEqual(seen.before.gridTiles, ['recruit', 'march', 'build', 'battle'], 'phase tiles')
      expectEqual(seen.spent, ['recruit'], 'spent tiles')
      expectEqual(seen.undoInDock, 1, 'Undo tile in the dock')
      return '4 tiles fill two columns, grid stays four wide; 3/3 → 2/3; Recruit faded in place; Undo in the dock'
    },
  },
  {
    title: '4 · March 2 → 5: three warriors walk in a line on orange footsteps (D7)',
    play: async (ui) => {
      await ui.button('march')
      await pickMove(ui, KEEP_CLEARING, MARCH_DESTINATION, 2)
      // The march has a second move: confirmed without it.
      await ui.button('OK')
      const march = await watchMarch(ui)
      return { march, tab: (await ui.dockLook()).tab }
    },
    verify: (state, seen) => {
      expectMarch(seen.march, 'marquise')
      expectEqual(warriorsIn(state, MARCH_DESTINATION, MARQUISE), 4, 'Cat warriors on 5')
      expectEqual(warriorsIn(state, KEEP_CLEARING, MARQUISE), 0, 'Cat warriors on 2')
      return '3 Cat warriors left the keep one behind the other; footsteps in Marquise orange'
    },
  },
  {
    title: '5 · League: move played from the Cards panel; its lines read "played" (D3)',
    play: async (ui) => {
      await ui.click(SELECTOR.cardsTab)
      await ui.pause(LOOK_MS)
      await ui.clickText(SELECTOR.readyCardRow, 'league: move')
      await ui.button('Boot')
      await pickMove(ui, LEAGUE_ORIGIN, LEAGUE_DESTINATION, 0)
      await ui.pause(MARCH_WALK_MS)
      const tab = await ui.textOfSelector(SELECTOR.cardsTab)
      await ui.click(SELECTOR.cardsTab)
      const playedRows = await ui.count(SELECTOR.playedCardRow)
      await ui.pause(LOOK_MS)
      await ui.click(SELECTOR.cardsTab)
      return { tab, playedRows }
    },
    verify: (state, seen) => {
      expectEqual(state.turnScratch.leagueUsed, true, 'League used')
      expectEqual(state.players[MARQUISE].craftedItems[0].exhausted, true, 'Boot exhausted')
      expectThat(seen.tab.includes('2/3 played'), `Cards tab = ${seen.tab}`)
      expectEqual(seen.playedRows, 2, 'lines struck as played')
      return 'Boot exhausted, warrior moved 10 → 11; Cards tab 2/3 played, both League lines struck'
    },
  },
  {
    title: '6 · Eyrie Birdsong: Add to Decree opens the Decree panel; a picked card is laid in a slot (D1 D12)',
    play: async (ui) => {
      await ui.button('end phase')
      await ui.waitForButton('draw')
      await ui.button('draw')
      await ui.waitForButton('add to decree')
      const dock = await ui.dockLook()
      await ui.button('add to decree')
      await ui.waitFor(SELECTOR.decreePanel)
      const slots = await ui.count(SELECTOR.decreeSlot)
      const ringedTiles = await ui.count(SELECTOR.ringedTile)
      await ui.pause(LOOK_MS)
      await ui.handCard(FOXFOLK_STEEL)
      const offeredSlots = await ui.count(SELECTOR.offeredSlot)
      await ui.pause(LOOK_MS)
      await ui.click(decreeSlot('move'))
      await ui.pause(LOOK_MS)
      return {
        dock,
        slots,
        ringedTiles,
        offeredSlots,
        stagedOnMove: await ui.count(`${decreeSlot('move')} ${SELECTOR.stagedCard}`),
        steelInHand: await ui.count(handCard(FOXFOLK_STEEL)),
      }
    },
    verify: (state, seen) => {
      expectEqual(state.currentSeat, EYRIE, 'seat')
      expectEqual(seen.dock.color, FACTION_COLORS.eyrie, 'dock frame colour')
      expectEqual(state.step, 'decreeAdd', 'step')
      expectEqual(seen.slots, DECREE_COLUMN_COUNT, 'Decree panel slots')
      expectEqual(seen.ringedTiles, 1, 'ringed Add to Decree tile')
      expectEqual(seen.offeredSlots, DECREE_COLUMN_COUNT, 'slots asking for the picked card')
      expectEqual(seen.stagedOnMove, 1, 'cards staged on the move slot')
      expectEqual(seen.steelInHand, 0, 'staged card still drawn in the hand')
      expectEqual(handOf(state, EYRIE).length, 2, 'Eyrie hand on the server')
      return 'Blue dock, tile ringed; four slots over the map, all four ask for the picked card; it lies on move, out of the hand; nothing sent'
    },
  },
  {
    title: '7 · The dock tile puts the Decree panel off and on; the staged card is kept (D13)',
    play: async (ui) => {
      await ui.button('add to decree')
      const panelsOff = await ui.count(SELECTOR.decreePanel)
      const tileCount = await ui.textOfSelector(SELECTOR.stagedCount)
      await ui.pause(LOOK_MS)
      await ui.click(SELECTOR.countedTile)
      await ui.waitFor(SELECTOR.decreePanel)
      await ui.pause(LOOK_MS)
      return {
        panelsOff,
        tileCount,
        stagedOnMove: await ui.count(`${decreeSlot('move')} ${SELECTOR.stagedCard}`),
      }
    },
    verify: (state, seen) => {
      expectEqual(seen.panelsOff, 0, 'panels shown after the tile is clicked')
      expectEqual(seen.tileCount, '1/2', 'staged cards told on the tile')
      expectEqual(seen.stagedOnMove, 1, 'cards staged on the move slot')
      expectEqual(handOf(state, EYRIE).length, 2, 'Eyrie hand on the server')
      return 'Panel off: the tile reads 1/2. Panel on again: Foxfolk Steel still lies on move'
    },
  },
  {
    title: '8 · Cards are dragged: hand → slot, slot → slot, slot → back to the hand (D14)',
    play: async (ui) => {
      const toBuild = await ui.drag(handCard(BAKE_SALE), decreeSlot('build'))
      const stagedOnBuild = await ui.count(`${decreeSlot('build')} ${SELECTOR.stagedCard}`)
      await ui.pause(LOOK_MS)
      await ui.drag(stagedCard(BAKE_SALE), decreeSlot('battle'))
      const stagedOnBattle = await ui.count(`${decreeSlot('battle')} ${SELECTOR.stagedCard}`)
      const stagedInAll = await ui.count(SELECTOR.stagedCard)
      await ui.pause(LOOK_MS)
      await ui.drag(stagedCard(BAKE_SALE), OFF_PANEL_POINT)
      await ui.pause(LOOK_MS)
      return {
        toBuild,
        stagedOnBuild,
        stagedOnBattle,
        stagedInAll,
        stagedAfterReturn: await ui.count(SELECTOR.stagedCard),
        bakeSaleInHand: await ui.count(handCard(BAKE_SALE)),
      }
    },
    verify: (state, seen) => {
      expectThat(seen.toBuild.ghost, 'no card follows the pointer during the drag')
      expectThat(seen.toBuild.slotLit, 'the slot under the dragged card is not lit')
      expectEqual(seen.stagedOnBuild, 1, 'cards on build after the first drop')
      expectEqual(seen.stagedOnBattle, 1, 'cards on battle after the second drop')
      expectEqual(seen.stagedInAll, MAXIMUM_STAGED_CARDS, 'cards staged, two at most')
      expectEqual(seen.stagedAfterReturn, 1, 'cards staged after the drop off the panel')
      expectEqual(seen.bakeSaleInHand, 1, 'Bake Sale back in the hand')
      expectEqual(handOf(state, EYRIE).length, 2, 'Eyrie hand on the server')
      return 'Bake Sale dragged from the hand onto build (slot lit), then to battle, then off the panel: back in the hand'
    },
  },
  {
    title: '9 · Take back empties the panel: nothing was sent (D8)',
    play: async (ui) => {
      await ui.click(SELECTOR.takeBackTile)
      await ui.pause(LOOK_MS)
      return {
        staged: await ui.count(SELECTOR.stagedCard),
        steelInHand: await ui.count(handCard(FOXFOLK_STEEL)),
        confirmOff: await ui.count(`${SELECTOR.confirmTile}:disabled`),
      }
    },
    verify: (state, seen) => {
      expectEqual(seen.staged, 0, 'cards staged after take back')
      expectEqual(seen.steelInHand, 1, 'Foxfolk Steel back in the hand')
      expectEqual(seen.confirmOff, 1, 'Confirm tile off with nothing staged')
      expectEqual(state.step, 'decreeAdd', 'step')
      expectEqual(handOf(state, EYRIE).length, 2, 'Eyrie hand on the server')
      expectEqual(board(state, EYRIE).decree.move.length, 1, 'cards in the move column')
      return 'Both cards back in the hand, Confirm off; server untouched: hand 2, move column 1 card'
    },
  },
  {
    title: '10 · Confirm sends the Decree; Eyrie Daylight dock is the Decree, four columns (D9 D12)',
    play: async (ui) => {
      await ui.drag(handCard(FOXFOLK_STEEL), decreeSlot('move'))
      await ui.pause(LOOK_MS)
      await ui.click(SELECTOR.confirmTile)
      await ui.waitFor(SELECTOR.decree)
      const heads = await ui.count(SELECTOR.decreeHead)
      const marks = await ui.count(SELECTOR.decreeMark)
      const tab = (await ui.dockLook()).tab
      await ui.hoverButton('recruit 0/1')
      await ui.pause(LOOK_MS)
      return { heads, marks, tab }
    },
    verify: (state, seen) => {
      expectEqual(state.step, 'decree', 'step')
      expectEqual(board(state, EYRIE).decree.move.length, 2, 'cards in the move column')
      expectEqual(seen.heads, DECREE_COLUMN_COUNT, 'column medallions')
      expectEqual(seen.marks, 3, 'suit marks')
      expectThat(seen.tab.includes('0/3'), `Decree tally = ${seen.tab}`)
      return 'Recruit, move, battle, build medallions; 3 cards as suits; tab reads 0/3'
    },
  },
  {
    title: '11 · Decree resolved from the columns: recruit, then a move on blue footsteps (D7 D9)',
    play: async (ui) => {
      await ui.button('recruit 0/1')
      await ui.clearingIfAsked(ROOST_CLEARING, 'Decree recruit')
      await ui.waitForState((state) => state.turnScratch.decree?.column === 'move')
      await ui.pause(LOOK_MS)
      const tabAfterRecruit = (await ui.dockLook()).tab
      await ui.button('move: fox')
      await pickMove(ui, ROOST_CLEARING, EYRIE_FIRST_MOVE_DESTINATION, 2)
      const march = await watchMarch(ui)
      const tabAfterMove = (await ui.dockLook()).tab
      return { tabAfterRecruit, march, tabAfterMove }
    },
    verify: (state, seen) => {
      expectThat(seen.tabAfterRecruit.includes('1/3'), `tally after recruit = ${seen.tabAfterRecruit}`)
      expectThat(seen.tabAfterMove.includes('2/3'), `tally after move = ${seen.tabAfterMove}`)
      expectMarch(seen.march, 'eyrie')
      expectEqual(warriorsIn(state, EYRIE_FIRST_MOVE_DESTINATION, EYRIE), 3, 'Eyrie warriors on 4')
      return 'Tally 1/3 then 2/3; the fox card moved 3 warriors 0 → 4 on Eyrie blue footsteps'
    },
  },
  {
    title: '12 · Alliance Evening: one icon per military operation, 2/2 left (D10 D11)',
    play: async (ui) => {
      await ui.button('move: bird')
      await pickMove(ui, ROOST_CLEARING, EYRIE_SECOND_MOVE_DESTINATION, 0)
      // Eyrie Evening and the Alliance Birdsong and Daylight end by themselves.
      await ui.waitForButton('organize')
      const dock = await ui.dockLook()
      const icons = await ui.tileIcons(MILITARY_OPERATIONS)
      for (const operation of MILITARY_OPERATIONS) {
        await ui.hoverButton(operation)
        await ui.pause(TOOLTIP_LOOK_MS)
      }
      return { dock, icons }
    },
    verify: (state, seen) => {
      expectEqual(state.currentSeat, ALLIANCE, 'seat')
      expectEqual(state.step, 'military', 'step')
      expectEqual(seen.dock.color, FACTION_COLORS.alliance, 'dock frame colour')
      expectThat(seen.dock.tab.includes('2/2'), `operations left = ${seen.dock.tab}`)
      expectEqual(new Set(seen.icons).size, MILITARY_OPERATIONS.length, 'distinct operation icons')
      return 'Green dock; move, battle, recruit, organize each drawn with their own icon; tab reads 2/2'
    },
  },
  {
    title: '13 · Military operation Move 9 → 11: green footsteps, 1/2 left (D7 D11)',
    play: async (ui) => {
      await ui.button('move')
      await pickMove(ui, BASE_CLEARING, ALLIANCE_MOVE_DESTINATION, 1)
      const march = await watchMarch(ui)
      return { march, tab: (await ui.dockLook()).tab }
    },
    verify: (state, seen) => {
      expectMarch(seen.march, 'alliance')
      expectEqual(warriorsIn(state, ALLIANCE_MOVE_DESTINATION, ALLIANCE), 2, 'Alliance warriors on 11')
      expectEqual(state.turnScratch.militaryOpsLeft, 1, 'operations left')
      expectThat(seen.tab.includes('1/2'), `operations left = ${seen.tab}`)
      return '2 Alliance warriors walked 9 → 11 on green footsteps; tab counts 1/2 left'
    },
  },
]

export { ANIMATION_START_WAIT_MS }
