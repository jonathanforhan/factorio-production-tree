// Builds the production tree: given a target item + rate, recursively resolves each
// ingredient's own recipe/machine/rate. The tree intentionally re-visits an item at every
// place it's needed (matching the visual "branch" the UI draws) - totals.ts is what merges
// duplicate occurrences back into an accurate global building count.

import { computeChildRate, computeEffects, computeMachineRequirement, zeroEffects, type EffectTotals } from './calc';
import { pickDefaultMachine, pickDefaultRecipe } from './loadData';
import { NORMAL_QUALITY, type GameData, type RecipeDef } from './types';

export interface NodeOverride {
  recipeId?: string;
  machineId?: string;
  quality?: string;
  modules?: (string | null)[];
  beaconId?: string | null;
  beaconCount?: number;
  beaconModuleId?: string | null;
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
  qualityId: string;
  modules: (string | null)[];
  beaconId: string | null;
  beaconCount: number;
  beaconModuleId: string | null;
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
  qualityId: string,
  truncatedCycle: boolean,
): ProductionNode {
  return {
    path,
    itemId,
    ratePerSec,
    recipe,
    machineId: undefined,
    qualityId,
    modules: [],
    beaconId: null,
    beaconCount: 0,
    beaconModuleId: null,
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
  const qualityId = override?.quality ?? NORMAL_QUALITY;
  const recipe = resolveRecipe(itemId, gameData, override?.recipeId);

  if (!recipe || ancestors.has(itemId) || ancestors.size >= MAX_DEPTH) {
    return leafNode(path, itemId, ratePerSec, recipe, qualityId, ancestors.has(itemId));
  }

  const machineId = override?.machineId ?? pickDefaultMachine(recipe, gameData, preferredMachineIds);
  const machine = machineId ? gameData.items.get(machineId)?.machine : undefined;
  if (!machineId || !machine) {
    // e.g. passive recipes like spoilage that have no producing building at all.
    return leafNode(path, itemId, ratePerSec, recipe, qualityId, false);
  }

  const modules = override?.modules ?? new Array(machine.moduleSlots).fill(null);
  const beaconId = override?.beaconId ?? null;
  const beaconCount = override?.beaconCount ?? 0;
  const beaconModuleId = override?.beaconModuleId ?? null;

  const effects = computeEffects(
    { recipe, machineId, qualityId, modules, beaconId, beaconCount, beaconModuleId },
    gameData,
  );
  const { machineCount, powerUsageKw, pollutionPerMinute } = computeMachineRequirement(
    ratePerSec,
    recipe,
    itemId,
    machine,
    qualityId,
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
    qualityId,
    modules,
    beaconId,
    beaconCount,
    beaconModuleId,
    machineCount,
    powerUsageKw,
    pollutionPerMinute,
    effects,
    children,
    isRaw: false,
    truncatedCycle: false,
  };
}
