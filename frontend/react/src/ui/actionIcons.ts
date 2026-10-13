import type { IconType } from 'react-icons'
import { FaBed, FaRegDizzy } from 'react-icons/fa'
import { GiCardDiscard, GiRobber, GiTorch } from 'react-icons/gi'
import {
  LuAnvil,
  LuAxe,
  LuBan,
  LuBird,
  LuBomb,
  LuCircleDot,
  LuCoins,
  LuCrosshair,
  LuCrown,
  LuFlag,
  LuFlame,
  LuFootprints,
  LuGraduationCap,
  LuHammer,
  LuHandHelping,
  LuHeartHandshake,
  LuLayers,
  LuMegaphone,
  LuPickaxe,
  LuPlay,
  LuRefreshCw,
  LuRepeat,
  LuScrollText,
  LuSearch,
  LuShield,
  LuShoppingCart,
  LuSkipForward,
  LuSkull,
  LuSprout,
  LuStore,
  LuSwords,
  LuTent,
  LuTrash2,
  LuUserPlus,
  LuUsers,
  LuWind,
  LuWrench,
} from 'react-icons/lu'
import { MdOutlineRemoveShoppingCart, MdPlusOne } from 'react-icons/md'
import { TbHexagonalPyramidPlus } from 'react-icons/tb'
import { TfiReload } from 'react-icons/tfi'

/** Icon of a tray action whose type has no icon of its own. */
export const FALLBACK_ACTION_ICON: IconType = LuCircleDot

/** Tray medallion icon per action type. */
const ACTION_ICONS: Readonly<Record<string, IconType>> = {
  // Shared
  craft: LuAnvil,
  battle: LuSwords,
  march: LuFootprints,
  move: LuFootprints,
  recruit: LuUserPlus,
  build: LuHammer,
  takeDominance: LuCrown,
  activateDominance: LuCrown,
  resolveEvent: LuCircleDot,
  // Answers to a pending event (keys from `trayActionArt`)
  declineEvent: LuBan,
  declineService: MdOutlineRemoveShoppingCart,
  buyService: LuShoppingCart,
  removeHits: LuSkull,
  // Turn control
  endPhase: LuPlay,
  eveningDraw: LuLayers,
  discard: GiCardDiscard,
  spendBird: LuBird,
  // Marquise de Cat
  overwork: LuAxe,
  // Eyrie Dynasties
  decree: LuScrollText,
  addToDecree: LuScrollText,
  turmoil: FaRegDizzy,
  // Woodland Alliance
  revolt: LuFlame,
  spreadSympathy: LuHeartHandshake,
  mobilize: LuUsers,
  train: LuGraduationCap,
  militaryOp: LuShield,
  // Military operations draw as move, battle, recruit or:
  organize: LuFlag,
  // Vagabond
  refresh: LuRefreshCw,
  slip: LuWind,
  vbMove: LuFootprints,
  vbBattle: LuSwords,
  explore: GiTorch,
  quest: LuScrollText,
  aid: LuHandHelping,
  strike: LuCrosshair,
  repair: LuWrench,
  vbCraft: LuAnvil,
  steal: GiRobber,
  dayLabor: LuPickaxe,
  hideout: LuTent,
  vbRemoveItems: LuTrash2,
  rest: FaBed,
  // Lizard Cult
  crusadeBattle: LuSwords,
  crusadeMove: LuFootprints,
  skipCrusadeBattle: LuSkipForward,
  convert: TfiReload,
  sanctify: TbHexagonalPyramidPlus,
  ritualBuild: LuSprout,
  ritualRecruit: LuUserPlus,
  ritualScore: MdPlusOne,
  ritualSacrifice: LuSkull,
  // Riverfolk Company
  riverfolkMove: LuFootprints,
  riverfolkBattle: LuSwords,
  riverfolkCraft: LuAnvil,
  riverfolkDraw: LuLayers,
  riverfolkRecruit: LuUserPlus,
  establishTradePost: LuStore,
  setServiceCosts: LuCoins,
  // Crafted persistent cards
  charmOffensive: LuHeartHandshake,
  eyrieEmigre: LuBird,
  falseOrders: LuScrollText,
  informantsTakeAmbush: LuSearch,
  leagueMove: LuFootprints,
  leagueBattle: LuSwords,
  propagandaBureau: LuMegaphone,
  saboteurs: LuBomb,
  swapMeet: LuRepeat,
}

export function actionIconFor(actionType: string): IconType {
  return ACTION_ICONS[actionType] ?? FALLBACK_ACTION_ICON
}
