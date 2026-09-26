// Pure production math: module/beacon/quality effect stacking, and the standard Factorio
// throughput formulas (machines required, power, pollution, child ingredient rates).

import type { BeaconDef, EffectMap, GameData, MachineDef, ModuleDef, ModuleEffect, RecipeDef } from './types';
import { NORMAL_QUALITY } from './types';

export interface EffectTotals {
  consumption: number;
  pollution: number;
  productivity: number;
  quality: number;
  speed: number;
}

export function zeroEffects(): EffectTotals {
  return { consumption: 0, pollution: 0, productivity: 0, quality: 0, speed: 0 };
}

/** A single module slot's contents - each module is its own item instance with its own quality,
 *  same as in the real game (a Legendary speed module can sit in a Normal-quality assembler). */
export interface ModuleSlotConfig {
  moduleId: string | null;
  qualityId: string;
}

export interface NodeConfig {
  recipe: RecipeDef;
  machineId: string;
  machineQualityId: string;
  modules: ModuleSlotConfig[];
  beaconId: string | null;
  beaconQualityId: string;
  beaconCount: number;
  beaconModuleId: string | null;
  beaconModuleQualityId: string;
}

function applyQualityOverride<T extends object>(
  base: T,
  record: Record<string, Partial<T>> | undefined,
  qualityId: string,
): T {
  const override = qualityId === NORMAL_QUALITY ? undefined : record?.[qualityId];
  return override ? { ...base, ...override } : base;
}

export function effectiveMachineStats(machine: MachineDef, qualityId: string) {
  return applyQualityOverride(
    { speed: machine.speed, usage: machine.usage, drain: machine.drain, pollution: machine.pollution },
    machine.qualityRecord,
    qualityId,
  );
}

export function effectiveBeaconStats(beacon: BeaconDef, qualityId: string) {
  return applyQualityOverride({ effectivity: beacon.effectivity, usage: beacon.usage }, beacon.qualityRecord, qualityId);
}

export function effectiveModuleEffects(module: ModuleDef, qualityId: string): EffectMap {
  return applyQualityOverride(module.effects, module.qualityRecord, qualityId);
}

/** Diminishing-returns sum for `count` beacons affecting one machine (Factorio 2.0 beacon profile). */
export function sumBeaconProfile(profile: number[], count: number): number {
  if (count <= 0 || profile.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < count; i++) sum += profile[Math.min(i, profile.length - 1)];
  return sum;
}

function addEffects(totals: EffectTotals, effects: EffectMap, disallowed: Set<ModuleEffect>, multiplier = 1): void {
  for (const key of Object.keys(effects) as ModuleEffect[]) {
    if (disallowed.has(key)) continue;
    totals[key] += (effects[key] ?? 0) * multiplier;
  }
}

/** Sums module + beacon + machine-baseline effects for one production node into net bonuses. */
export function computeEffects(config: NodeConfig, gameData: GameData): EffectTotals {
  const totals = zeroEffects();
  const machine = gameData.items.get(config.machineId)?.machine;
  if (!machine) return totals;

  const disallowed = new Set<ModuleEffect>([...machine.disallowedEffects, ...config.recipe.disallowedEffects]);

  if (machine.baseEffect) addEffects(totals, machine.baseEffect, disallowed);

  for (const slot of config.modules) {
    const moduleDef = slot.moduleId ? gameData.items.get(slot.moduleId)?.module : undefined;
    if (!moduleDef) continue;
    addEffects(totals, effectiveModuleEffects(moduleDef, slot.qualityId), disallowed);
  }

  if (config.beaconId && config.beaconCount > 0 && config.beaconModuleId) {
    const beacon = gameData.items.get(config.beaconId)?.beacon;
    const beaconModule = gameData.items.get(config.beaconModuleId)?.module;
    if (beacon && beaconModule) {
      const beaconDisallowed = new Set<ModuleEffect>([...beacon.disallowedEffects, ...disallowed]);
      const beaconStats = effectiveBeaconStats(beacon, config.beaconQualityId);
      const profileSum = sumBeaconProfile(beacon.profile, config.beaconCount);
      const multiplier = beaconStats.effectivity * beacon.moduleSlots * profileSum;
      addEffects(
        totals,
        effectiveModuleEffects(beaconModule, config.beaconModuleQualityId),
        beaconDisallowed,
        multiplier,
      );
    }
  }

  return totals;
}

export interface ProductionResult {
  /** Exact (fractional) machine count; round up in the UI when showing "buildings to place". */
  machineCount: number;
  effectiveSpeed: number;
  powerUsageKw: number;
  pollutionPerMinute: number;
}

function boostedOutput(recipe: RecipeDef, itemId: string, productivity: number): number {
  const totalOut = recipe.out[itemId] ?? 0;
  const catalystOut = recipe.catalyst?.[itemId] ?? 0;
  return catalystOut + (totalOut - catalystOut) * (1 + Math.max(0, productivity));
}

export function computeMachineRequirement(
  ratePerSec: number,
  recipe: RecipeDef,
  itemId: string,
  machine: MachineDef,
  machineQualityId: string,
  effects: EffectTotals,
): ProductionResult {
  const machineStats = effectiveMachineStats(machine, machineQualityId);
  const speedMultiplier = Math.max(0.01, 1 + effects.speed);
  const effectiveSpeed = machineStats.speed * speedMultiplier;

  const boostedOut = boostedOutput(recipe, itemId, effects.productivity);
  const cyclesPerSecond = boostedOut > 0 ? ratePerSec / boostedOut : 0;
  const machineCount = effectiveSpeed > 0 ? (cyclesPerSecond * recipe.time) / effectiveSpeed : 0;

  const consumptionMultiplier = Math.max(0.01, 1 + effects.consumption);
  const powerUsageKw = machineStats.usage * consumptionMultiplier * machineCount;
  // machine.pollution is already expressed per minute of active operation.
  const pollutionPerMinute = machineStats.pollution * consumptionMultiplier * machineCount;

  return { machineCount, effectiveSpeed, powerUsageKw, pollutionPerMinute };
}

/** Required rate (items/sec) of one ingredient of `recipe`, given the parent item's target rate. */
export function computeChildRate(
  ratePerSec: number,
  recipe: RecipeDef,
  itemId: string,
  childId: string,
  effects: EffectTotals,
): number {
  const boostedOut = boostedOutput(recipe, itemId, effects.productivity);
  const cyclesPerSecond = boostedOut > 0 ? ratePerSec / boostedOut : 0;

  const grossIn = recipe.in[childId] ?? 0;
  const producedBack = recipe.out[childId] ?? 0; // catalyst-style loops, e.g. sulfuric acid reprocessing
  const netIn = Math.max(0, grossIn - producedBack);

  return cyclesPerSecond * netIn;
}
