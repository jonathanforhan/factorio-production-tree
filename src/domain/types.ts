// Normalized game-data model, parsed from the vendored FactorioLab dataset
// (public/data/factorio-spa/data.json). See public/data/factorio-spa/SOURCE.md.

export type ModuleEffect = 'consumption' | 'pollution' | 'productivity' | 'quality' | 'speed';

export type EffectMap = Partial<Record<ModuleEffect, number>>;

export interface QualityDef {
  id: string;
  name: string;
  level: number;
}

export interface ModuleDef {
  id: string;
  name: string;
  icon?: string;
  effects: EffectMap;
  qualityRecord?: Record<string, EffectMap>;
}

export interface BeaconDef {
  id: string;
  name: string;
  icon?: string;
  effectivity: number;
  moduleSlots: number;
  range?: number;
  usage: number;
  disallowedEffects: Set<ModuleEffect>;
  /** Diminishing-returns multiplier per beacon, indexed by (count - 1). */
  profile: number[];
  qualityRecord?: Record<string, { effectivity?: number; usage?: number }>;
}

export interface MachineDef {
  id: string;
  name: string;
  icon?: string;
  speed: number;
  moduleSlots: number;
  disallowedEffects: Set<ModuleEffect>;
  fuelCategories?: string[];
  usage: number;
  drain: number;
  pollution: number;
  baseEffect?: EffectMap;
  qualityRecord?: Record<string, Partial<{ speed: number; usage: number; drain: number; pollution: number }>>;
}

export interface ItemDef {
  id: string;
  name: string;
  category: string;
  icon: string;
  iconText?: string;
  machine?: MachineDef;
  module?: ModuleDef;
  beacon?: BeaconDef;
}

export type RecipeFlag =
  | 'mining'
  | 'technology'
  | 'plant'
  | 'burn'
  | 'recycling'
  | 'locked'
  | 'noCostMultiplier'
  | 'infinite'
  | 'showCount';

export interface RecipeDef {
  id: string;
  name: string;
  category: string;
  icon: string;
  time: number;
  in: Record<string, number>;
  out: Record<string, number>;
  catalyst?: Record<string, number>;
  producers: string[];
  disallowedEffects: Set<ModuleEffect>;
  locations?: string[];
  flags: Set<RecipeFlag>;
}

export interface IconDef {
  id: string;
  x: number;
  y: number;
  color?: string;
}

export interface GameData {
  version: string;
  items: Map<string, ItemDef>;
  recipes: Map<string, RecipeDef>;
  recipesByOutput: Map<string, RecipeDef[]>;
  qualities: QualityDef[];
  icons: Map<string, IconDef>;
  categories: Map<string, { id: string; name: string }>;
  /** Preferred machine id per producer type, from the game's own "minimum" preset. */
  defaultMachineRank: string[];
  defaultBeaconId: string;
  iconSheetUrl: string;
  iconSheetWidth: number;
  iconSheetHeight: number;
}

export const NORMAL_QUALITY = 'normal';
