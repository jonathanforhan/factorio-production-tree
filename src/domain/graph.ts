// Builds the production tree: given a target item + rate, recursively resolves each
// ingredient's own recipe/machine/rate. The tree intentionally re-visits an item at every
// place it's needed (matching the visual "branch" the UI draws) - totals.ts is what merges
// duplicate occurrences back into an accurate global building count.

import {
  computeChildRate,
  computeEffects,
  computeMachineRequirement,
  zeroEffects,
  type EffectTotals,
  type ModuleSlotConfig,
} from './calc';
import { pickDefaultMachine, pickDefaultRecipe } from './loadData';
import { NORMAL_QUALITY, type GameData, type RecipeDef } from './types';

export type { ModuleSlotConfig };

export interface NodeOverride {
  recipeId?: string;
  machineId?: string;
  machineQuality?: string;
  /** Full replacement for every module slot - always sized to the current machine's slot count. */
  modules?: ModuleSlotConfig[];
  beaconId?: string | null;
  beaconQuality?: string;
  beaconCount?: number;
  beaconModuleId?: string | null;
  beaconModuleQuality?: string;
}

export type OverrideMap = Map<string, NodeOverride>;

export interface ProductionNode {
  /** Root-to-node id path (e.g. "automation-science-pack/iron-gear-wheel/iron-plate"). Stable
   *  and unique within one tree - used as the override lookup key and as a React-less "key". */
  path: string;
  itemId: string;
  ratePerSec: number;
  recipe?: RecipeDef;
  machineId?: string;
  machineQualityId: string;
  modules: ModuleSlotConfig[];
  beaconId: string | null;
  beaconQualityId: string;
  beaconCount: number;
  beaconModuleId: string | null;
  beaconModuleQualityId: string;
  machineCount: number;
  powerUsageKw: number;
  pollutionPerMinute: number;
  effects: EffectTotals;
  children: ProductionNode[];
  /** No known way to produce this item at all (dead end - render as a raw input). */
  isRaw: boolean;
  /** Recursion stopped because this item is already its own ancestor on this path. */
  truncatedCycle: boolean;
}

const MAX_DEPTH = 64;

export function resolveRecipe(
  itemId: string,
  gameData: GameData,
  overrideRecipeId: string | undefined,
): RecipeDef | undefined {
  if (overrideRecipeId) {
    const recipe = gameData.recipes.get(overrideRecipeId);
    if (recipe && recipe.out[itemId] !== undefined) return recipe;
  }
  return pickDefaultRecipe(itemId, gameData);
}

function leafNode(
  path: string,
  itemId: string,
  ratePerSec: number,
  recipe: RecipeDef | undefined,
  truncatedCycle: boolean,
): ProductionNode {
  return {
    path,
    itemId,
    ratePerSec,
    recipe,
    machineId: undefined,
    machineQualityId: NORMAL_QUALITY,
    modules: [],
    beaconId: null,
    beaconQualityId: NORMAL_QUALITY,
    beaconCount: 0,
    beaconModuleId: null,
    beaconModuleQualityId: NORMAL_QUALITY,
    machineCount: 0,
    powerUsageKw: 0,
    pollutionPerMinute: 0,
    effects: zeroEffects(),
    children: [],
    isRaw: !recipe,
    truncatedCycle,
  };
}

export function buildProductionTree(
  itemId: string,
  ratePerSec: number,
  gameData: GameData,
  overrides: OverrideMap,
  preferredMachineIds: readonly string[] = [],
  path: string = itemId,
  ancestors: ReadonlySet<string> = new Set(),
): ProductionNode {
  const override = overrides.get(path);
  const recipe = resolveRecipe(itemId, gameData, override?.recipeId);

  if (!recipe || ancestors.has(itemId) || ancestors.size >= MAX_DEPTH) {
    return leafNode(path, itemId, ratePerSec, recipe, ancestors.has(itemId));
  }

  const machineId = override?.machineId ?? pickDefaultMachine(recipe, gameData, preferredMachineIds);
  const machine = machineId ? gameData.items.get(machineId)?.machine : undefined;
  if (!machineId || !machine) {
    // e.g. passive recipes like spoilage that have no producing building at all.
    return leafNode(path, itemId, ratePerSec, recipe, false);
  }

  const machineQualityId = override?.machineQuality ?? NORMAL_QUALITY;
  const modules =
    override?.modules ??
    Array.from({ length: machine.moduleSlots }, () => ({ moduleId: null, qualityId: NORMAL_QUALITY }));
  const beaconId = override?.beaconId ?? null;
  const beaconQualityId = override?.beaconQuality ?? NORMAL_QUALITY;
  const beaconCount = override?.beaconCount ?? 0;
  const beaconModuleId = override?.beaconModuleId ?? null;
  const beaconModuleQualityId = override?.beaconModuleQuality ?? NORMAL_QUALITY;

  const effects = computeEffects(
    {
      recipe,
      machineId,
      machineQualityId,
      modules,
      beaconId,
      beaconQualityId,
      beaconCount,
      beaconModuleId,
      beaconModuleQualityId,
    },
    gameData,
  );
  const { machineCount, powerUsageKw, pollutionPerMinute } = computeMachineRequirement(
    ratePerSec,
    recipe,
    itemId,
    machine,
    machineQualityId,
    effects,
  );

  const nextAncestors = new Set(ancestors);
  nextAncestors.add(itemId);

  const children: ProductionNode[] = [];
  for (const childId of Object.keys(recipe.in)) {
    const childRate = computeChildRate(ratePerSec, recipe, itemId, childId, effects);
    if (childRate <= 1e-9) continue;
    children.push(
      buildProductionTree(
        childId,
        childRate,
        gameData,
        overrides,
        preferredMachineIds,
        `${path}/${childId}`,
        nextAncestors,
      ),
    );
  }

  return {
    path,
    itemId,
    ratePerSec,
    recipe,
    machineId,
    machineQualityId,
    modules,
    beaconId,
    beaconQualityId,
    beaconCount,
    beaconModuleId,
    beaconModuleQualityId,
    machineCount,
    powerUsageKw,
    pollutionPerMinute,
    effects,
    children,
    isRaw: false,
    truncatedCycle: false,
  };
}
