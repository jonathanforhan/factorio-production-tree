// Fetches and normalizes the vendored FactorioLab dataset into the GameData model
// defined in types.ts. See public/data/factorio-spa/SOURCE.md for provenance.

import type {
  BeaconDef,
  EffectMap,
  GameData,
  IconDef,
  ItemDef,
  MachineDef,
  ModuleDef,
  ModuleEffect,
  QualityDef,
  RecipeDef,
  RecipeFlag,
} from './types';

const DATA_URL = '/data/factorio-spa/data.json';
const MODULE_EFFECT_KEYS: ModuleEffect[] = ['consumption', 'pollution', 'productivity', 'quality', 'speed'];
export const ICON_SIZE = 64;

interface RawIcon {
  id: string;
  x: number;
  y: number;
  color?: string;
}

interface RawModule {
  consumption?: number;
  pollution?: number;
  productivity?: number;
  quality?: number;
  speed?: number;
  qualityRecord?: Record<string, Partial<Record<ModuleEffect, number>>>;
}

interface RawBeacon {
  effectivity: number;
  modules: number;
  range?: number;
  usage?: number;
  disallowedEffects?: ModuleEffect[];
  profile?: number[];
  qualityRecord?: Record<string, { effectivity?: number; usage?: number }>;
}

interface RawMachine {
  speed?: number;
  modules?: number | true;
  disallowedEffects?: ModuleEffect[];
  fuelCategories?: string[];
  usage?: number;
  drain?: number;
  pollution?: number;
  baseEffect?: Partial<Record<ModuleEffect, number>>;
  qualityRecord?: Record<string, Partial<{ speed: number; usage: number; drain: number; pollution: number }>>;
}

interface RawItem {
  id: string;
  name: string;
  category: string;
  icon?: string;
  iconText?: string;
  machine?: RawMachine;
  module?: RawModule;
  beacon?: RawBeacon;
}

interface RawRecipe {
  id: string;
  name: string;
  category: string;
  icon?: string;
  time: number;
  in?: Record<string, number>;
  out?: Record<string, number>;
  catalyst?: Record<string, number>;
  producers?: string[];
  disallowedEffects?: ModuleEffect[];
  locations?: string[];
  flags?: RecipeFlag[];
}

interface RawPreset {
  id: number;
  machineRank?: string[];
}

export interface RawData {
  version: Record<string, string>;
  categories: { id: string; name: string }[];
  icons: RawIcon[];
  items: RawItem[];
  recipes: RawRecipe[];
  qualities?: QualityDef[];
  defaults?: { beacon?: string; presets?: RawPreset[] };
}

function parseEffects(raw: Partial<Record<ModuleEffect, number>> | undefined): EffectMap {
  const out: EffectMap = {};
  if (!raw) return out;
  for (const key of MODULE_EFFECT_KEYS) {
    const value = raw[key];
    if (typeof value === 'number') out[key] = value;
  }
  return out;
}

function parseModule(item: RawItem): ModuleDef | undefined {
  if (!item.module) return undefined;
  const qualityRecord = item.module.qualityRecord;
  const parsedQualityRecord: Record<string, EffectMap> | undefined = qualityRecord
    ? Object.fromEntries(Object.entries(qualityRecord).map(([q, v]) => [q, parseEffects(v)]))
    : undefined;
  return {
    id: item.id,
    name: item.name,
    icon: item.icon,
    effects: parseEffects(item.module),
    qualityRecord: parsedQualityRecord,
  };
}

function parseBeacon(item: RawItem): BeaconDef | undefined {
  const raw = item.beacon;
  if (!raw) return undefined;
  return {
    id: item.id,
    name: item.name,
    icon: item.icon,
    effectivity: raw.effectivity,
    moduleSlots: raw.modules,
    range: raw.range,
    usage: raw.usage ?? 0,
    disallowedEffects: new Set(raw.disallowedEffects ?? []),
    profile: raw.profile ?? [1],
    qualityRecord: raw.qualityRecord,
  };
}

function parseMachine(item: RawItem): MachineDef | undefined {
  const raw = item.machine;
  if (!raw) return undefined;
  return {
    id: item.id,
    name: item.name,
    icon: item.icon,
    speed: raw.speed ?? 1,
    moduleSlots: raw.modules === true ? 0 : (raw.modules ?? 0),
    disallowedEffects: new Set(raw.disallowedEffects ?? []),
    fuelCategories: raw.fuelCategories,
    usage: raw.usage ?? 0,
    drain: raw.drain ?? 0,
    pollution: raw.pollution ?? 0,
    baseEffect: raw.baseEffect ? parseEffects(raw.baseEffect) : undefined,
    qualityRecord: raw.qualityRecord,
  };
}

function parseItem(raw: RawItem): ItemDef {
  return {
    id: raw.id,
    name: raw.name,
    category: raw.category,
    icon: raw.icon ?? raw.id,
    iconText: raw.iconText,
    machine: parseMachine(raw),
    module: parseModule(raw),
    beacon: parseBeacon(raw),
  };
}

function parseRecipe(raw: RawRecipe): RecipeDef {
  return {
    id: raw.id,
    name: raw.name,
    category: raw.category,
    icon: raw.icon ?? raw.id,
    time: raw.time,
    in: raw.in ?? {},
    out: raw.out ?? {},
    catalyst: raw.catalyst,
    producers: raw.producers ?? [],
    disallowedEffects: new Set(raw.disallowedEffects ?? []),
    locations: raw.locations,
    flags: new Set(raw.flags ?? []),
  };
}

export async function loadGameData(): Promise<GameData> {
  const res = await fetch(DATA_URL);
  if (!res.ok) throw new Error(`Failed to load game data: ${res.status} ${res.statusText}`);
  const raw = (await res.json()) as RawData;
  return parseGameData(raw);
}

/** Pure parse step, split out from the fetch above so it can be exercised directly in tests. */
export function parseGameData(raw: RawData): GameData {
  const items = new Map<string, ItemDef>();
  for (const rawItem of raw.items) items.set(rawItem.id, parseItem(rawItem));

  const recipes = new Map<string, RecipeDef>();
  const recipesByOutput = new Map<string, RecipeDef[]>();
  for (const rawRecipe of raw.recipes) {
    const recipe = parseRecipe(rawRecipe);
    recipes.set(recipe.id, recipe);
    for (const outputId of Object.keys(recipe.out)) {
      const list = recipesByOutput.get(outputId);
      if (list) list.push(recipe);
      else recipesByOutput.set(outputId, [recipe]);
    }
  }

  const icons = new Map<string, IconDef>();
  let iconSheetWidth = 0;
  let iconSheetHeight = 0;
  for (const icon of raw.icons) {
    icons.set(icon.id, icon);
    iconSheetWidth = Math.max(iconSheetWidth, icon.x + ICON_SIZE);
    iconSheetHeight = Math.max(iconSheetHeight, icon.y + ICON_SIZE);
  }

  const categories = new Map(raw.categories.map((c) => [c.id, c]));

  const qualities = [...(raw.qualities ?? [{ id: 'normal', name: 'Normal', level: 0 }])].sort(
    (a, b) => a.level - b.level,
  );

  const minimumPreset = raw.defaults?.presets?.find((p) => p.id === 0);

  return {
    version: raw.version?.base ?? 'unknown',
    items,
    recipes,
    recipesByOutput,
    qualities,
    icons,
    categories,
    defaultMachineRank: minimumPreset?.machineRank ?? [],
    defaultBeaconId: raw.defaults?.beacon ?? 'beacon',
    iconSheetUrl: '/data/factorio-spa/icons.webp',
    iconSheetWidth,
    iconSheetHeight,
  };
}

/**
 * Picks the recipe FactorioLab's own data would treat as "the normal way to make this item":
 * skip recycling loops, prefer genuine resource extraction ('mining') over any alternate, and
 * otherwise prefer a recipe whose id matches the item id (the base-game convention) before
 * falling back to the first remaining candidate. Recipes with no producers can't be built at all
 * (e.g. passive spoilage) so they're excluded unless there is truly nothing else.
 */
export function pickDefaultRecipe(itemId: string, gameData: GameData): RecipeDef | undefined {
  const all = gameData.recipesByOutput.get(itemId);
  if (!all || all.length === 0) return undefined;

  const buildable = all.filter((r) => r.producers.length > 0);
  const pool = buildable.length > 0 ? buildable : all;

  const nonRecycling = pool.filter((r) => !r.flags.has('recycling'));
  const candidates = nonRecycling.length > 0 ? nonRecycling : pool;

  const mining = candidates.filter((r) => r.flags.has('mining'));
  if (mining.length > 0) return mining[0];

  const idMatch = candidates.find((r) => r.id === itemId);
  if (idMatch) return idMatch;

  return candidates[0];
}

/**
 * Picks a producer for a recipe: the user's own preferred machine per family (if it can make this
 * recipe) wins first, then the game's own "minimum" preset ranking, then whatever's first.
 */
export function pickDefaultMachine(
  recipe: RecipeDef,
  gameData: GameData,
  preferredMachineIds: readonly string[] = [],
): string | undefined {
  if (recipe.producers.length === 0) return undefined;
  for (const preferredId of preferredMachineIds) {
    if (recipe.producers.includes(preferredId)) return preferredId;
  }
  for (const rankedId of gameData.defaultMachineRank) {
    if (recipe.producers.includes(rankedId)) return rankedId;
  }
  return recipe.producers[0];
}
