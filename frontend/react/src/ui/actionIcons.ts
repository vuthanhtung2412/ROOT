import type { IconType } from 'react-icons'
import { GiCardDiscard } from 'react-icons/gi'
import {
  LuAnvil,
  LuAxe,
  LuBan,
  LuBedDouble,
  LuBird,
  LuChurch,
  LuCircleDot,
  LuCoins,
  LuCrosshair,
  LuCrown,
  LuFlame,
  LuFootprints,
  LuGraduationCap,
  LuHammer,
  LuHandHelping,
  LuHeartHandshake,
  LuLayers,
  LuPickaxe,
  LuPlay,
  LuRefreshCw,
  LuScrollText,
  LuSearch,
  LuShield,
  LuShoppingCart,
  LuSkipForward,
  LuSkull,
  LuSparkles,
  LuSprout,
  LuStar,
  LuStore,
  LuSwords,
  LuTent,
  LuTrash2,
  LuUserPlus,
  LuUsers,
  LuWind,
  LuWrench,
} from 'react-icons/lu'
import { MdOutlineRemoveShoppingCart } from 'react-icons/md'

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
  // Woodland Alliance
  revolt: LuFlame,
  spreadSympathy: LuHeartHandshake,
  mobilize: LuUsers,
  train: LuGraduationCap,
  militaryOp: LuShield,
  // Vagabond
  refresh: LuRefreshCw,
  slip: LuWind,
  vbMove: LuFootprints,
  vbBattle: LuSwords,
  explore: LuSearch,
  quest: LuScrollText,
  aid: LuHandHelping,
  strike: LuCrosshair,
  repair: LuWrench,
  vbCraft: LuAnvil,
  steal: LuCoins,
  dayLabor: LuPickaxe,
  hideout: LuTent,
  vbRemoveItems: LuTrash2,
  rest: LuBedDouble,
  // Lizard Cult
  crusadeBattle: LuSwords,
  crusadeMove: LuFootprints,
  skipCrusadeBattle: LuSkipForward,
  convert: LuSparkles,
  sanctify: LuChurch,
  ritualBuild: LuSprout,
  ritualRecruit: LuUserPlus,
  ritualScore: LuStar,
  ritualSacrifice: LuSkull,
  // Riverfolk Company
  riverfolkMove: LuFootprints,
  riverfolkBattle: LuSwords,
  riverfolkCraft: LuAnvil,
  riverfolkDraw: LuLayers,
  riverfolkRecruit: LuUserPlus,
  establishTradePost: LuStore,
  setServiceCosts: LuCoins,
}

export function actionIconFor(actionType: string): IconType {
  return ACTION_ICONS[actionType] ?? FALLBACK_ACTION_ICON
}
